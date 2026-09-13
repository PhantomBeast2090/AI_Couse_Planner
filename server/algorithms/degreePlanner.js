/**
 * Degree timeline planner: program-scoped, 8-semester-capped scheduling.
 *
 * Flow: program -> eligible prerequisite subgraph -> minus completed ->
 * semester-by-semester feasible packing (max 8/semester, max 8 semesters) ->
 * shared timeline validation. Never emits Semester 9+.
 *
 * Ranking reuses existing machinery: prerequisite feasibility via
 * getAvailableCourses, downstream unlock counts via buildAdjacencyList
 * (graphUtils), and the agent's goal semantics (fastest/easiest/balanced/
 * specialization preferences). The five search planners are untouched and
 * remain available for comparison views.
 *
 * Two entry points: planDegreeTimeline resolves a catalog program id;
 * planTimeline plans an explicit eligible set (used by tests for synthetic
 * programs that are not in the catalog).
 */
'use strict';

const {
  getAvailableCourses,
  buildAdjacencyList,
  topologicalSort,
} = require('../utils/graphUtils');
const { checkTriviallyImpossible, validateTimeline } = require('../utils/planValidator');
const { getProgram, buildEligibleSet, DEGREE_LIMITS } = require('../data/programs');

/** Downstream unlock counts within the eligible subgraph (dependents). */
function unlockCounts(eligible) {
  const { adj } = buildAdjacencyList(eligible);
  const counts = {};
  eligible.forEach((c) => {
    const seen = new Set();
    const stack = [...(adj[c.id] || [])];
    while (stack.length > 0) {
      const id = stack.pop();
      if (!seen.has(id)) {
        seen.add(id);
        stack.push(...(adj[id] || []));
      }
    }
    counts[c.id] = seen.size;
  });
  return counts;
}

/**
 * Rank feasible courses: unlock power first (feasibility), then the active
 * goal's preference, then stable id order for determinism. When hard courses
 * pile up beyond future hard capacity (bottleneck), feasible hard courses
 * jump the queue — otherwise they cluster past semester 8.
 */
function rankCourses(available, goal, unlocks, specializationTags = [], hardUrgent = false) {
  const tagSet = new Set(specializationTags || []);
  const hasTag = (c) => (c.tags || []).some((t) => tagSet.has(t));
  const isHard = (c) => c.difficulty >= 4;
  return [...available].sort((a, b) => {
    if (hardUrgent && isHard(a) !== isHard(b)) return isHard(a) ? -1 : 1;
    if (unlocks[b.id] !== unlocks[a.id]) return unlocks[b.id] - unlocks[a.id];
    if (goal === 'specialization' && hasTag(a) !== hasTag(b)) return hasTag(a) ? -1 : 1;
    if (goal === 'fastest' && a.credits !== b.credits) return b.credits - a.credits;
    if ((goal === 'easiest' || goal === 'balanced') && a.difficulty !== b.difficulty) {
      return a.difficulty - b.difficulty;
    }
    if (a.difficulty !== b.difficulty) return a.difficulty - b.difficulty;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

function workloadLabel(avg) {
  return avg < 2 ? 'Light' : avg < 3.5 ? 'Moderate' : 'Heavy';
}

function emptyResult(reason, message, extra = {}) {
  return {
    algorithm: 'Degree Planner',
    success: false, reason, message,
    semesterPlan: [], totalSemesters: 0, unplannedCourses: [],
    validation: { valid: false, errors: [message] }, steps: [],
    ...extra,
  };
}

/**
 * Plan a degree timeline for a catalog program id.
 */
function planDegreeTimeline(catalog, programId, constraints = {}, completedCourses = new Set(), goal = 'balanced', specializationTags = []) {
  if (!programId || typeof programId !== 'string') {
    return emptyResult('INVALID_PROGRAM', 'A valid program/degree must be selected.', { programId: programId || null, programName: null });
  }
  const program = getProgram(programId);
  if (!program) {
    return emptyResult('PROGRAM_NOT_FOUND', `Unknown program "${programId}".`, { programId, programName: null });
  }

  const { eligible, autoIncluded, missingRequired } = buildEligibleSet(program, catalog || []);
  if (missingRequired.length > 0) {
    return emptyResult(
      'PROGRAM_COURSES_MISSING',
      `Program courses missing from catalog: ${missingRequired.join(', ')}.`,
      {
        programId, programName: program.name,
        unplannedCourses: missingRequired.map((id) => ({ id, name: id, reason: 'required course missing from catalog' })),
      }
    );
  }

  return planTimeline(
    eligible, program.requiredCourseIds,
    { programId: program.id, programName: program.name, autoIncluded },
    constraints, completedCourses, goal, specializationTags
  );
}

/**
 * Plan a timeline over an explicit eligible course set.
 * @param {Array} eligible - plannable courses (prerequisite-closed)
 * @param {Array} requiredIds - required course ids for coverage checks
 * @param {object} meta - { programId, programName, autoIncluded }
 */
function planTimeline(eligible, requiredIds, meta = {}, constraints = {}, completedCourses = new Set(), goal = 'balanced', specializationTags = []) {
  const {
    maxCredits = 18,
    maxHardCourses = 2,
    maxCoursesPerSemester: userCap = DEGREE_LIMITS.maxCoursesPerSemester,
  } = constraints;
  const perSemesterCap = Math.min(userCap, DEGREE_LIMITS.maxCoursesPerSemester);
  const effective = { maxCredits, maxHardCourses, maxCoursesPerSemester: perSemesterCap };
  const steps = [];
  const base = {
    algorithm: 'Degree Planner',
    programId: meta.programId || null,
    programName: meta.programName || null,
    autoIncludedPrerequisites: meta.autoIncluded || [],
  };
  const fail = (reason, message, rem) => ({
    ...base, success: false, reason, message,
    unplannedCourses: (rem || []).map((c) => ({ id: c.id, name: c.name, reason: message })),
    semesterPlan: [], totalSemesters: 0,
    validation: { valid: false, errors: [message] }, steps,
  });

  const completed = completedCourses instanceof Set ? new Set(completedCourses) : new Set();
  const remaining = (eligible || []).filter((c) => !completed.has(c.id));
  const programIds = (eligible || []).map((c) => c.id);

  if (perSemesterCap < 1) {
    return fail('INVALID_CONSTRAINTS', 'maxCoursesPerSemester must be at least 1.', remaining);
  }
  if (remaining.length === 0) {
    const validation = validateTimeline([], {
      courses: eligible, completedInput: completed, constraints: effective,
      programCourseIds: programIds, requiredIds, unplannedIds: [],
    });
    return {
      ...base, success: true, semesterPlan: [], totalSemesters: 0, unplannedCourses: [],
      message: 'All program courses are already completed.',
      validation, workloadAnalysis: [], steps,
    };
  }

  const impossible = checkTriviallyImpossible(eligible, completed, effective);
  if (impossible) {
    return fail('UNSATISFIABLE_CONSTRAINTS', impossible, remaining);
  }
  if (topologicalSort(remaining) === null) {
    return fail('CYCLIC_PREREQUISITES', 'Program courses contain a prerequisite cycle.', remaining);
  }

  const unlocks = unlockCounts(eligible);
  const scheduled = new Set(completed);
  const semesterPlan = [];

  for (let sem = 1; sem <= DEGREE_LIMITS.maxSemesters; sem++) {
    // scheduled holds completed + already-planned ids, so this is exactly the
    // unscheduled courses whose prerequisites are met in earlier semesters.
    const feasible = getAvailableCourses(remaining, scheduled);

    if (feasible.length === 0) break; // deadlock handled below; partial plan stays honest

    // Bottleneck lookahead: unscheduled hard courses beyond future hard
    // capacity must start now, or they cannot fit before semester 8 ends.
    const hardRemaining = remaining.filter((c) => !scheduled.has(c.id) && c.difficulty >= 4).length;
    const futureHardCapacity = maxHardCourses * (DEGREE_LIMITS.maxSemesters - sem);
    const ranked = rankCourses(feasible, goal, unlocks, specializationTags, hardRemaining > futureHardCapacity);
    const picked = [];
    let credits = 0;
    let hard = 0;
    for (const course of ranked) {
      if (picked.length >= perSemesterCap) break;
      const isHard = course.difficulty >= 4;
      if (credits + course.credits > maxCredits) continue;
      if (isHard && hard >= maxHardCourses) continue;
      picked.push(course);
      credits += course.credits;
      if (isHard) hard++;
    }
    if (picked.length === 0) break; // nothing fits: stop, report honestly

    picked.forEach((c) => scheduled.add(c.id));
    semesterPlan.push({
      semester: sem,
      courses: picked,
      totalCredits: credits,
      hardCourseCount: hard,
    });
    steps.push({
      action: 'DEGREE_SEMESTER',
      semester: sem,
      courses: picked.map((c) => c.id),
      message: `Semester ${sem}: scheduled ${picked.map((c) => c.id).join(', ')}`,
    });
  }

  const plannedIds = new Set(semesterPlan.flatMap((s) => s.courses.map((c) => c.id)));
  const unplanned = remaining.filter((c) => !plannedIds.has(c.id));

  if (unplanned.length > 0) {
    const validation = validateTimeline(semesterPlan, {
      courses: eligible, completedInput: completed, constraints: effective,
      programCourseIds: programIds, requiredIds, unplannedIds: unplanned.map((c) => c.id),
    });
    return {
      ...base, success: false, reason: 'PLAN_EXCEEDS_8_SEMESTERS',
      semesterPlan, totalSemesters: semesterPlan.length,
      unplannedCourses: unplanned.map((c) => ({
        id: c.id, name: c.name,
        reason: (c.prerequisites || []).some((p) => !scheduled.has(p))
          ? 'prerequisites could not be satisfied within 8 semesters'
          : 'no capacity within 8 semesters under current constraints',
      })),
      message: 'The selected course requirements cannot be completed within 8 semesters under the current constraints.',
      validation, workloadAnalysis: workload(semesterPlan), steps,
    };
  }

  const validation = validateTimeline(semesterPlan, {
    courses: eligible, completedInput: completed, constraints: effective,
    programCourseIds: programIds, requiredIds, unplannedIds: [],
  });
  return {
    ...base, success: true, semesterPlan, totalSemesters: semesterPlan.length,
    unplannedCourses: [],
    message: `Planned ${plannedIds.size} courses across ${semesterPlan.length} semesters.`,
    validation, workloadAnalysis: workload(semesterPlan), steps,
  };
}

function workload(semesterPlan) {
  return (semesterPlan || []).map((sem, i) => {
    const avg = sem.courses.length > 0
      ? sem.courses.reduce((s, c) => s + c.difficulty, 0) / sem.courses.length
      : 0;
    return {
      semester: i + 1, avgDifficulty: +avg.toFixed(2),
      totalCredits: sem.totalCredits, hardCount: sem.hardCourseCount,
      workloadLabel: workloadLabel(avg),
    };
  });
}

module.exports = { planDegreeTimeline, planTimeline, DEGREE_LIMITS };
