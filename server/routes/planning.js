/**
 * Planning Routes — Run AI algorithms on the course store
 *
 * POST /api/planning/run         - Run a specific algorithm
 * POST /api/planning/compare     - Compare two algorithms side-by-side
 * POST /api/planning/agent       - Run the intelligent agent
 * POST /api/planning/degree      - Plan a program-scoped 8-semester timeline
 * GET  /api/planning/graph       - Get graph data for visualization
 */

const express = require('express');
const router = express.Router();
const { bfsPlanner } = require('../algorithms/bfs');
const { dfsPlanner } = require('../algorithms/dfs');
const { ucsPlanner } = require('../algorithms/ucs');
const { astarPlanner } = require('../algorithms/astar');
const { cspPlanner } = require('../algorithms/csp');
const { intelligentAgent } = require('../algorithms/agent');
const { planDegreeTimeline } = require('../algorithms/degreePlanner');
const { listPrograms } = require('../data/programs');
const { DEGREE_LIMITS } = require('../data/programs');
const { resolvePlanningScope, scopeMeta, finalizeScopedResult } = require('../utils/scopeResolver');
const coursesRouter = require('./courses');

function getCourses() {
  return coursesRouter.getCourseStore();
}

/** Clamp user caps to the hard product ceilings (never raised). */
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

/**
 * Resolve the authoritative planning scope from the request. Accepts either
 * { selection: { programId | targetCourseId } } or top-level programId /
 * targetCourseId. Sends 400 and returns null when selection is missing or
 * unresolvable — never falls back to the full dataset.
 */
function resolveScopeOr400(req, res) {
  const body = req.body || {};
  const selection = body.selection || { programId: body.programId, targetCourseId: body.targetCourseId };
  const completed = new Set(body.completedCourseIds || []);
  const catalog = getCourses();
  if (catalog.length === 0) {
    res.status(400).json({ error: 'No courses loaded. Please load a dataset first.' });
    return null;
  }
  const scope = resolvePlanningScope(selection, catalog, completed);
  if (!scope.ok) {
    res.status(400).json({ error: scope.error.message, errorCode: scope.error.code });
    return null;
  }
  return { scope, completed, effective: effectiveConstraints(body.constraints) };
}

// ── POST /api/planning/run ─────────────────────────────────
router.post('/run', (req, res) => {
  const {
    algorithm = 'bfs',
    goal = 'fastest',
  } = req.body;

  const resolved = resolveScopeOr400(req, res);
  if (!resolved) return;
  const { scope, completed, effective } = resolved;
  const courses = scope.scopedCourses;

  const startTime = Date.now();
  let result;

  switch (algorithm.toLowerCase()) {
    case 'bfs':
      result = bfsPlanner(courses, effective, completed);
      break;
    case 'dfs':
      result = dfsPlanner(courses, effective, completed);
      break;
    case 'ucs':
      result = ucsPlanner(courses, effective, completed);
      break;
    case 'astar':
    case 'a*':
      result = astarPlanner(courses, effective, completed, goal);
      break;
    case 'csp':
      result = cspPlanner(courses, effective, completed);
      break;
    default:
      return res.status(400).json({ error: `Unknown algorithm: ${algorithm}` });
  }

  const elapsed = Date.now() - startTime;

  res.json({
    ...finalizeScopedResult(result, scope, completed, effective),
    executionTimeMs: elapsed,
    coursesAnalyzed: scope.scopeCourseIds.length,
    completedCount: (req.body.completedCourseIds || []).length
  });
});

// ── POST /api/planning/compare ─────────────────────────────
// Both candidates solve the SAME resolved scope — scope equality is
// structural (one scope object feeds both runs) and asserted in tests.
router.post('/compare', (req, res) => {
  const {
    algorithmA = 'bfs',
    algorithmB = 'astar',
    goal = 'fastest',
  } = req.body;

  const resolved = resolveScopeOr400(req, res);
  if (!resolved) return;
  const { scope, completed, effective } = resolved;
  const courses = scope.scopedCourses;

  function runAlgorithm(name) {
    const start = Date.now();
    let result;
    switch (name.toLowerCase()) {
      case 'bfs': result = bfsPlanner(courses, effective, completed); break;
      case 'dfs': result = dfsPlanner(courses, effective, completed); break;
      case 'ucs': result = ucsPlanner(courses, effective, completed); break;
      case 'astar': case 'a*': result = astarPlanner(courses, effective, completed, goal); break;
      case 'csp': result = cspPlanner(courses, effective, completed); break;
      default: result = bfsPlanner(courses, effective, completed);
    }
    const finalized = finalizeScopedResult(result, scope, completed, effective);
    return { ...finalized, executionTimeMs: Date.now() - start };
  }

  const resultA = runAlgorithm(algorithmA);
  const resultB = runAlgorithm(algorithmB);

  // Summary comparison metrics
  const comparison = {
    [algorithmA]: {
      semesters: resultA.semesterPlan?.length || 0,
      nodesExplored: resultA.nodesExplored?.length || 0,
      executionTimeMs: resultA.executionTimeMs,
      totalCost: resultA.totalCost || 0,
      stepsCount: resultA.steps?.length || 0
    },
    [algorithmB]: {
      semesters: resultB.semesterPlan?.length || 0,
      nodesExplored: resultB.nodesExplored?.length || 0,
      executionTimeMs: resultB.executionTimeMs,
      totalCost: resultB.totalCost || 0,
      stepsCount: resultB.steps?.length || 0
    },
    winner: {
      fewestSemesters: resultA.semesterPlan?.length <= resultB.semesterPlan?.length ? algorithmA : algorithmB,
      fewestNodesExplored: (resultA.nodesExplored?.length || 0) <= (resultB.nodesExplored?.length || 0) ? algorithmA : algorithmB,
      fastest: resultA.executionTimeMs <= resultB.executionTimeMs ? algorithmA : algorithmB
    }
  };

  res.json({
    algorithmA: resultA,
    algorithmB: resultB,
    comparison
  });
});

// ── POST /api/planning/agent ───────────────────────────────
// The agent plans the resolved scope only: every candidate strategy runs on
// the same scoped course set, never the full catalog.
router.post('/agent', (req, res) => {
  const {
    goal = 'balanced',
    specializationTags = []
  } = req.body;

  const resolved = resolveScopeOr400(req, res);
  if (!resolved) return;
  const { scope, completed, effective } = resolved;

  const start = Date.now();
  const result = intelligentAgent(scope.scopedCourses, effective, completed, goal, specializationTags);

  res.json({
    ...finalizeScopedResult(result, scope, completed, effective),
    executionTimeMs: Date.now() - start
  });
});

// ── POST /api/planning/degree ──────────────────────────────
// Program-scoped timeline: at most 8 semesters, at most 8 courses per
// semester. Never emits Semester 9+; overflow yields success:false with
// reason PLAN_EXCEEDS_8_SEMESTERS and an explicit unplanned list.
router.post('/degree', (req, res) => {
  const {
    programId,
    goal = 'balanced',
    constraints = {},
    completedCourseIds = [],
    specializationTags = []
  } = req.body || {};

  if (!programId || typeof programId !== 'string') {
    return res.status(400).json({
      error: 'programId is required',
      programs: listPrograms().map(p => p.id)
    });
  }

  const courses = getCourses();
  if (courses.length === 0) {
    return res.status(400).json({ error: 'No courses loaded.' });
  }

  const start = Date.now();
  const result = planDegreeTimeline(
    courses, programId, constraints, new Set(completedCourseIds), goal, specializationTags
  );
  res.json({ ...result, executionTimeMs: Date.now() - start });
});

// ── GET /api/planning/graph ────────────────────────────────
// Optional ?programId= / ?targetCourseId= returns the scoped subgraph used
// by planning views (plus scope metadata). Without params it returns the
// full catalog overview for dataset browsing only.
router.get('/graph', (req, res) => {
  const catalog = getCourses();
  const { programId, targetCourseId } = req.query || {};
  let courses = catalog;
  let scope = null;

  if (programId || targetCourseId) {
    const resolved = resolvePlanningScope({ programId, targetCourseId }, catalog);
    if (!resolved.ok) {
      return res.status(400).json({ error: resolved.error.message, errorCode: resolved.error.code });
    }
    scope = resolved;
    courses = resolved.scopedCourses;
  }

  // Build nodes and edges for D3 visualization
  const nodes = courses.map(c => ({
    id: c.id,
    name: c.name,
    credits: c.credits,
    difficulty: c.difficulty,
    tags: c.tags,
    prerequisites: c.prerequisites,
    recommendedSemester: c.recommendedSemester || null,
    // Visual properties
    radius: 20 + c.credits * 2,
    color: getDifficultyColor(c.difficulty),
    group: getGroup(c.tags)
  }));

  const edges = [];
  courses.forEach(c => {
    c.prerequisites.forEach(prereqId => {
      edges.push({
        source: prereqId,
        target: c.id,
        id: `${prereqId}->${c.id}`
      });
    });
  });

  // Stats
  const stats = {
    totalCourses: courses.length,
    totalEdges: edges.length,
    totalCredits: courses.reduce((s, c) => s + c.credits, 0),
    avgDifficulty: +(courses.reduce((s, c) => s + c.difficulty, 0) / courses.length).toFixed(2),
    tagDistribution: getTagDistribution(courses),
    difficultyDistribution: getDifficultyDist(courses)
  };

  res.json({ nodes, edges, stats, scope: scope ? scopeMeta(scope) : null });
});

function getDifficultyColor(d) {
  const colors = { 1: '#00ff88', 2: '#88ff00', 3: '#ffff00', 4: '#ff8800', 5: '#ff0044' };
  return colors[d] || '#00ffff';
}

function getGroup(tags) {
  if (tags.includes('AI') || tags.includes('ML')) return 'AI/ML';
  if (tags.includes('Systems')) return 'Systems';
  if (tags.includes('Math')) return 'Math';
  if (tags.includes('Data') || tags.includes('DS')) return 'Data Science';
  if (tags.includes('NLP')) return 'NLP';
  if (tags.includes('CV')) return 'CV';
  if (tags.includes('RL')) return 'RL';
  if (tags.includes('DL')) return 'Deep Learning';
  if (tags.includes('Elective')) return 'Electives';
  if (tags.includes('Capstone')) return 'Capstone';
  return 'CS';
}

function getTagDistribution(courses) {
  const dist = {};
  courses.forEach(c => {
    (c.tags || []).forEach(tag => {
      dist[tag] = (dist[tag] || 0) + 1;
    });
  });
  return dist;
}

function getDifficultyDist(courses) {
  const dist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  courses.forEach(c => { dist[c.difficulty] = (dist[c.difficulty] || 0) + 1; });
  return dist;
}

module.exports = router;
