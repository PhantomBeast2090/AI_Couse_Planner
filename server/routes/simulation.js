/**
 * Simulation Routes — What-if scenarios (all scope-aware)
 *
 * POST /api/simulation/fail-course   - Recalculate plan after failing a course
 * POST /api/simulation/complete      - Mark courses as completed, re-optimize
 * POST /api/simulation/what-if       - Generic what-if scenario
 *
 * Every endpoint accepts { selection: { programId | targetCourseId } } (or
 * top-level programId/targetCourseId) and operates ONLY on the resolved
 * scope. Missing/unresolvable selection → 400, never a global fallback.
 * fail/exclude ids outside the scope → 400.
 */

const express = require('express');
const router = express.Router();
const { intelligentAgent } = require('../algorithms/agent');
const { astarPlanner } = require('../algorithms/astar');
const { DEGREE_LIMITS } = require('../data/programs');
const { resolvePlanningScope, finalizeScopedResult } = require('../utils/scopeResolver');
const coursesRouter = require('./courses');

function getCourses() {
  return coursesRouter.getCourseStore();
}

function effectiveConstraints(constraints = {}) {
  const {
    maxCredits = 18,
    maxHardCourses = 2,
    maxCoursesPerSemester = 5,
  } = constraints || {};
  return {
    maxCredits,
    maxHardCourses,
    maxCoursesPerSemester: Math.min(maxCoursesPerSemester, DEGREE_LIMITS.maxCoursesPerSemester),
  };
}

function resolveScopeOr400(req, res, completedIds = []) {
  const body = req.body || {};
  const selection = body.selection || { programId: body.programId, targetCourseId: body.targetCourseId };
  const completed = new Set(completedIds);
  const catalog = getCourses();
  if (catalog.length === 0) {
    res.status(400).json({ error: 'No courses loaded' });
    return null;
  }
  const scope = resolvePlanningScope(selection, catalog, completed);
  if (!scope.ok) {
    res.status(400).json({ error: scope.error.message, errorCode: scope.error.code });
    return null;
  }
  return { scope, completed, effective: effectiveConstraints(body.constraints) };
}

// ── POST /api/simulation/fail-course ──────────────────────────
router.post('/fail-course', (req, res) => {
  const {
    failedCourseId,
    completedCourseIds = [],
    goal = 'balanced'
  } = req.body;

  if (!failedCourseId) {
    return res.status(400).json({ error: 'failedCourseId is required' });
  }

  const resolved = resolveScopeOr400(req, res, completedCourseIds);
  if (!resolved) return;
  const { scope, effective } = resolved;
  const courses = scope.scopedCourses;
  const scopeIds = new Set(scope.scopeCourseIds);

  const courseMap = {};
  courses.forEach(c => { courseMap[c.id] = c; });

  const failedCourse = courseMap[failedCourseId];
  if (!failedCourse) {
    return res.status(404).json({ error: `Course ${failedCourseId} not found in the selected scope` });
  }

  // Courses that are now blocked (depend on failed course)
  const blocked = courses.filter(c =>
    c.prerequisites.includes(failedCourseId) ||
    (c.prerequisites.some(p => {
      // Transitively blocked
      const transBlock = new Set();
      function findBlocked(id) {
        courses.forEach(course => {
          if (course.prerequisites.includes(id) && !transBlock.has(course.id)) {
            transBlock.add(course.id);
            findBlocked(course.id);
          }
        });
      }
      findBlocked(failedCourseId);
      return transBlock.has(c.id);
    }))
  );

  // New completed set: remove failed course from completed
  const newCompleted = new Set(completedCourseIds.filter(id => id !== failedCourseId));

  // Re-run optimization WITHOUT the failed course in completed
  const start = Date.now();
  const revisedPlan = finalizeScopedResult(
    intelligentAgent(courses, effective, newCompleted, goal, []),
    scope, newCompleted, effective
  );
  const elapsed = Date.now() - start;

  // Calculate impact
  const extraSemesters = Math.max(0,
    (revisedPlan.semesterPlan?.length || 0) -
    Math.ceil((courses.length - newCompleted.size) / 4) // rough baseline
  );

  res.json({
    scenario: 'fail-course',
    failedCourse: {
      id: failedCourse.id,
      name: failedCourse.name,
      difficulty: failedCourse.difficulty,
      credits: failedCourse.credits
    },
    impact: {
      directlyBlocked: blocked.map(c => ({ id: c.id, name: c.name })),
      blockedCount: blocked.length,
      estimatedDelay: `${blocked.length > 3 ? '1-2' : blocked.length > 0 ? '1' : '0'} semesters`
    },
    revisedPlan,
    scope: revisedPlan.scope,
    executionTimeMs: elapsed
  });
});

// ── POST /api/simulation/complete ──────────────────────────────
router.post('/complete', (req, res) => {
  const {
    completedCourseIds = [],
    goal = 'balanced'
  } = req.body;

  const resolved = resolveScopeOr400(req, res, completedCourseIds);
  if (!resolved) return;
  const { scope, completed, effective } = resolved;
  const courses = scope.scopedCourses;

  const remaining = courses.filter(c => !completed.has(c.id));

  if (remaining.length === 0) {
    return res.json({
      scenario: 'complete',
      message: 'All courses completed! 🎓',
      completedCount: completedCourseIds.length,
      revisedPlan: { semesterPlan: [], totalSemesters: 0 }
    });
  }

  const start = Date.now();
  const revisedPlan = finalizeScopedResult(
    intelligentAgent(courses, effective, completed, goal, []),
    scope, completed, effective
  );
  const elapsed = Date.now() - start;

  res.json({
    scenario: 'complete',
    completedCount: completedCourseIds.length,
    remainingCount: remaining.length,
    progressPercent: +((completedCourseIds.length / courses.length) * 100).toFixed(1),
    revisedPlan,
    scope: revisedPlan.scope,
    executionTimeMs: elapsed
  });
});

// ── POST /api/simulation/what-if ──────────────────────────────
router.post('/what-if', (req, res) => {
  const {
    scenario = 'custom',
    completedCourseIds = [],
    additionalCompletedIds = [],
    excludeCourseIds = [],
    goal = 'balanced'
  } = req.body;

  const resolved = resolveScopeOr400(req, res, [...completedCourseIds, ...additionalCompletedIds]);
  if (!resolved) return;
  const { scope, effective } = resolved;

  const scopeIds = new Set(scope.scopeCourseIds);
  const outside = (excludeCourseIds || []).filter((id) => !scopeIds.has(id));
  if (outside.length > 0) {
    return res.status(400).json({
      error: `Excluded courses are outside the selected scope: ${outside.join(', ')}`,
      errorCode: 'SCOPE_VIOLATION'
    });
  }

  const courses = scope.scopedCourses.filter(c => !excludeCourseIds.includes(c.id));
  if (courses.length === 0) {
    return res.status(400).json({ error: 'No courses available after exclusions' });
  }

  const allCompleted = new Set([...completedCourseIds, ...additionalCompletedIds]);
  const start = Date.now();
  const subScope = { ...scope, scopedCourses: courses, scopeCourseIds: courses.map((c) => c.id) };
  const result = finalizeScopedResult(
    intelligentAgent(courses, effective, allCompleted, goal, []),
    subScope, allCompleted, effective
  );

  res.json({
    scenario,
    excludedCourses: excludeCourseIds,
    additionalCompleted: additionalCompletedIds,
    result,
    scope: result.scope,
    executionTimeMs: Date.now() - start
  });
});

module.exports = router;
