/**
 * Single authoritative scope-resolution service.
 *
 * resolvePlanningScope(selection, catalog, completedInput?) is the ONLY place
 * that turns a user selection into a plannable course set. Every planning,
 * graphing, comparison, agent and simulation route must consume its result —
 * nothing downstream may silently fall back to the full catalog.
 *
 * Selection shapes:
 *   { programId }        → program/degree mode (explicit curriculum + closure)
 *   { targetCourseId }   → individual-course mode (target + ancestor closure)
 * Exactly one of the two must be set.
 *
 * Success returns { ok: true, kind, scopedCourses, scopeCourseIds, edges,
 * stats, ... }. Failure returns { ok: false, error: { code, message } } with
 * codes SELECTION_REQUIRED | UNKNOWN_PROGRAM | UNKNOWN_COURSE |
 * MISSING_DEPENDENCIES | CYCLIC_SCOPE. There is deliberately no fallback.
 */
'use strict';

const {
  buildAdjacencyList,
  topologicalSort,
  calculateCriticalPath,
  getAllAncestors,
} = require('./graphUtils');
const { validateTimeline, findUnplanned } = require('./planValidator');
const { buildEligibleSet, getProgram, DEGREE_LIMITS } = require('../data/programs');

const MAX_SLOTS = DEGREE_LIMITS.maxSemesters * DEGREE_LIMITS.maxCoursesPerSemester; // 64

function baseStats(scopedCourses, completedSet) {
  const ids = scopedCourses.map((c) => c.id);
  const completed = ids.filter((id) => completedSet.has(id));
  const edges = [];
  scopedCourses.forEach((c) => {
    (c.prerequisites || []).forEach((p) => edges.push({ source: p, target: c.id }));
  });
  const memo = {};
  let criticalDepth = 0;
  ids.forEach((id) => {
    criticalDepth = Math.max(criticalDepth, calculateCriticalPath(id, scopedCourses, memo));
  });
  const remaining = ids.length - completed.length;
  return {
    total: ids.length,
    completed: completed.length,
    remaining,
    edgeCount: edges.length,
    maxCapacity: MAX_SLOTS,
    semesterLimit: DEGREE_LIMITS.maxSemesters,
    perSemesterLimit: DEGREE_LIMITS.maxCoursesPerSemester,
    criticalDepth,
    overCapacity: remaining > MAX_SLOTS,
    depthExceeded: criticalDepth > DEGREE_LIMITS.maxSemesters,
    edges,
  };
}

function resolvePlanningScope(selection = {}, catalog = [], completedInput = new Set()) {
  const courses = Array.isArray(catalog) ? catalog.filter((c) => c && typeof c.id === 'string') : [];
  const catalogMap = new Map(courses.map((c) => [c.id, c]));
  const completedSet = completedInput instanceof Set ? completedInput : new Set(completedInput || []);
  const { programId = null, targetCourseId = null } = selection || {};

  if ((programId && targetCourseId) || (!programId && !targetCourseId)) {
    return {
      ok: false,
      error: {
        code: 'SELECTION_REQUIRED',
        message: 'Select exactly one program or target course before generating a plan.',
      },
    };
  }

  if (programId) {
    if (typeof programId !== 'string') {
      return { ok: false, error: { code: 'SELECTION_REQUIRED', message: 'programId must be a string.' } };
    }
    const program = getProgram(programId);
    if (!program) {
      return { ok: false, error: { code: 'UNKNOWN_PROGRAM', message: `Unknown program "${programId}".` } };
    }
    const { eligible, autoIncluded, missingRequired } = buildEligibleSet(program, courses);
    if (missingRequired.length > 0) {
      return {
        ok: false,
        error: {
          code: 'MISSING_DEPENDENCIES',
          message: `Program courses missing from catalog: ${missingRequired.join(', ')}.`,
          missing: missingRequired,
        },
      };
    }
    if (topologicalSort(eligible) === null && eligible.length > 0) {
      return { ok: false, error: { code: 'CYCLIC_SCOPE', message: 'Program courses contain a prerequisite cycle.' } };
    }
    const stats = baseStats(eligible, completedSet);
    return {
      ok: true,
      kind: 'program',
      programId: program.id,
      targetCourseId: null,
      selectedName: program.name,
      selectedMeta: { description: program.description },
      scopedCourses: eligible,
      scopeCourseIds: eligible.map((c) => c.id),
      requiredIds: [...program.requiredCourseIds],
      autoIncluded,
      missing: [],
      completedIds: eligible.map((c) => c.id).filter((id) => completedSet.has(id)),
      stats,
    };
  }

  // Individual-course mode: target + genuine prerequisite closure only.
  if (typeof targetCourseId !== 'string' || !catalogMap.has(targetCourseId)) {
    return { ok: false, error: { code: 'UNKNOWN_COURSE', message: `Unknown target course "${targetCourseId}".` } };
  }
  const target = catalogMap.get(targetCourseId);
  const ancestorIds = getAllAncestors(targetCourseId, courses);
  const scopeIds = [...new Set([targetCourseId, ...ancestorIds])];
  const unknownDeps = [];
  scopeIds.forEach((id) => {
    const course = catalogMap.get(id);
    (course.prerequisites || []).forEach((p) => {
      if (!catalogMap.has(p) && !unknownDeps.includes(p)) unknownDeps.push(p);
    });
  });
  if (unknownDeps.length > 0) {
    return {
      ok: false,
      error: {
        code: 'MISSING_DEPENDENCIES',
        message: `Target course has prerequisites missing from catalog: ${unknownDeps.join(', ')}.`,
        missing: unknownDeps,
      },
    };
  }
  const scopedCourses = scopeIds.map((id) => catalogMap.get(id));
  if (topologicalSort(scopedCourses) === null && scopedCourses.length > 0) {
    return { ok: false, error: { code: 'CYCLIC_SCOPE', message: 'Target course scope contains a prerequisite cycle.' } };
  }
  const stats = baseStats(scopedCourses, completedSet);
  return {
    ok: true,
    kind: 'course',
    programId: null,
    targetCourseId,
    selectedName: target.name,
    selectedMeta: { credits: target.credits, difficulty: target.difficulty, tags: target.tags || [] },
    scopedCourses,
    scopeCourseIds: scopeIds,
    requiredIds: scopeIds,
    autoIncluded: ancestorIds,
    missing: [],
    completedIds: scopeIds.filter((id) => completedSet.has(id)),
    stats,
  };
}

/** Scope metadata safe to expose in API responses (no full course blobs). */
function scopeMeta(scope) {
  if (!scope || !scope.ok) return null;
  return {
    kind: scope.kind,
    programId: scope.programId,
    targetCourseId: scope.targetCourseId,
    selectedName: scope.selectedName,
    size: scope.scopeCourseIds.length,
    completed: scope.stats.completed,
    remaining: scope.stats.remaining,
    edgeCount: scope.stats.edgeCount,
    criticalDepth: scope.stats.criticalDepth,
  };
}

/**
 * Shared route post-check: attach scope metadata + validation to any planner
 * result, and enforce the hard caps WITHOUT silent truncation.
 *
 * - planner success + within caps → scoped success + validation.
 * - planner emitted >8 semesters → structured PARTIAL: first 8 semesters
 *   kept, everything beyond reported explicitly in unplannedCourses.
 * - planner failure → passed through with scope + validation attached.
 * - planner emitted a course outside the scope, or a per-semester cap
 *   violation → success:false CONSTRAINT/SCOPE violation (defensive; planners
 *   receive scoped input and clamped caps, so this must not trigger).
 */
function finalizeScopedResult(result, scope, completedInput, effective) {
  const scoped = scope.scopedCourses;
  const scopeIds = new Set(scope.scopeCourseIds);
  const byId = new Map(scoped.map((c) => [c.id, c]));
  const completed = completedInput instanceof Set ? completedInput : new Set(completedInput || []);
  const plan = (result && result.semesterPlan) || [];

  const plannedInOrder = [];
  plan.forEach((sem) => ((sem && sem.courses) || []).forEach((c) => {
    if (c && c.id && !plannedInOrder.includes(c.id)) plannedInOrder.push(c.id);
  }));
  const outside = plannedInOrder.filter((id) => !scopeIds.has(id));
  const overSemesters = plan.slice(DEGREE_LIMITS.maxSemesters);
  const overCourses = plan.some((sem) => ((sem && sem.courses) || []).length > effective.maxCoursesPerSemester);

  const validate = (keptPlan, unplannedIds) => validateTimeline(keptPlan, {
    courses: scoped,
    completedInput: completed,
    constraints: effective,
    programCourseIds: scope.scopeCourseIds,
    requiredIds: scope.requiredIds,
    unplannedIds,
    maxSemesters: DEGREE_LIMITS.maxSemesters,
    maxCoursesPerSemester: effective.maxCoursesPerSemester,
  });
  const nameOf = (id) => (byId.get(id) || {}).name || id;
  const toUnplanned = (ids, reason) => ids.map((id) => ({ id, name: nameOf(id), reason }));

  if (outside.length > 0) {
    const unplannedIds = [...new Set([...(result.unplanned || []), ...findUnplanned(scoped, plan, completed)])];
    return {
      ...result, success: false, reason: 'SCOPE_VIOLATION',
      error: `Planner emitted courses outside the selected scope: ${outside.join(', ')}.`,
      unplannedCourses: toUnplanned(unplannedIds, 'not safely placeable within scope and limits'),
      scope: scopeMeta(scope), validation: validate(plan, unplannedIds),
    };
  }

  if (overCourses) {
    const unplannedIds = [...new Set([...(result.unplanned || []), ...findUnplanned(scoped, plan, completed)])];
    return {
      ...result, success: false, reason: 'CONSTRAINT_VIOLATION',
      error: 'A semester exceeds the per-semester course limit.',
      unplannedCourses: toUnplanned(unplannedIds, 'not safely placeable within scope and limits'),
      scope: scopeMeta(scope), validation: validate(plan, unplannedIds),
    };
  }

  if (overSemesters.length > 0) {
    const kept = plan.slice(0, DEGREE_LIMITS.maxSemesters);
    const dropped = [];
    overSemesters.forEach((sem) => ((sem && sem.courses) || []).forEach((c) => {
      if (c && c.id && !dropped.includes(c.id)) dropped.push(c.id);
    }));
    const restUnplanned = [...new Set([...(result.unplanned || []), ...findUnplanned(scoped, kept, completed)])];
    const unplannedIds = [...new Set([...dropped, ...restUnplanned])];
    return {
      ...result, success: false, reason: result.reason || 'PLAN_EXCEEDS_8_SEMESTERS',
      error: result.error || undefined,
      message: 'The selected scope cannot be completed within 8 semesters under the current constraints.',
      semesterPlan: kept, totalSemesters: kept.length,
      unplanned: unplannedIds,
      unplannedCourses: toUnplanned(unplannedIds, 'beyond 8-semester limit'),
      scope: scopeMeta(scope), validation: validate(kept, unplannedIds),
    };
  }

  if (!result.success) {
    const unplannedIds = [...new Set([...(result.unplanned || []), ...findUnplanned(scoped, plan, completed)])];
    return {
      ...result,
      unplanned: unplannedIds,
      unplannedCourses: result.unplannedCourses || toUnplanned(unplannedIds, (result.error || result.reason) || 'no valid placement found'),
      scope: scopeMeta(scope), validation: validate(plan, unplannedIds),
    };
  }

  const unplannedIds = [...new Set([...(result.unplanned || []), ...findUnplanned(scoped, plan, completed)])];
  return {
    ...result,
    unplanned: unplannedIds,
    unplannedCourses: result.unplannedCourses || [],
    scope: scopeMeta(scope), validation: validate(plan, unplannedIds),
  };
}

module.exports = { resolvePlanningScope, scopeMeta, finalizeScopedResult, MAX_SLOTS };
