/**
 * Simulation Routes — What-if scenarios
 *
 * POST /api/simulation/fail-course   - Recalculate plan after failing a course
 * POST /api/simulation/complete      - Mark courses as completed, re-optimize
 * POST /api/simulation/what-if       - Generic what-if scenario
 */

const express = require('express');
const router = express.Router();
const { intelligentAgent } = require('../algorithms/agent');
const { astarPlanner } = require('../algorithms/astar');
const coursesRouter = require('./courses');

function getCourses() {
  return coursesRouter.getCourseStore();
}

// ── POST /api/simulation/fail-course ──────────────────────────
router.post('/fail-course', (req, res) => {
  const {
    failedCourseId,
    completedCourseIds = [],
    goal = 'balanced',
    constraints = {}
  } = req.body;

  if (!failedCourseId) {
    return res.status(400).json({ error: 'failedCourseId is required' });
  }

  const courses = getCourses();
  if (courses.length === 0) {
    return res.status(400).json({ error: 'No courses loaded' });
  }

  const courseMap = {};
  courses.forEach(c => { courseMap[c.id] = c; });

  const failedCourse = courseMap[failedCourseId];
  if (!failedCourse) {
    return res.status(404).json({ error: `Course ${failedCourseId} not found` });
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
  const revisedPlan = intelligentAgent(courses, constraints, newCompleted, goal, []);
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
    executionTimeMs: elapsed
  });
});

// ── POST /api/simulation/complete ──────────────────────────────
router.post('/complete', (req, res) => {
  const {
    completedCourseIds = [],
    goal = 'balanced',
    constraints = {}
  } = req.body;

  const courses = getCourses();
  if (courses.length === 0) {
    return res.status(400).json({ error: 'No courses loaded' });
  }

  const completed = new Set(completedCourseIds);
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
  const revisedPlan = intelligentAgent(courses, constraints, completed, goal, []);
  const elapsed = Date.now() - start;

  res.json({
    scenario: 'complete',
    completedCount: completedCourseIds.length,
    remainingCount: remaining.length,
    progressPercent: +((completedCourseIds.length / courses.length) * 100).toFixed(1),
    revisedPlan,
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
    goal = 'balanced',
    constraints = {}
  } = req.body;

  const courses = getCourses().filter(c => !excludeCourseIds.includes(c.id));
  if (courses.length === 0) {
    return res.status(400).json({ error: 'No courses available after exclusions' });
  }

  const allCompleted = new Set([...completedCourseIds, ...additionalCompletedIds]);
  const start = Date.now();
  const result = intelligentAgent(courses, constraints, allCompleted, goal, []);

  res.json({
    scenario,
    excludedCourses: excludeCourseIds,
    additionalCompleted: additionalCompletedIds,
    result,
    executionTimeMs: Date.now() - start
  });
});

module.exports = router;
