/**
 * Planning Routes — Run AI algorithms on the course store
 *
 * POST /api/planning/run         - Run a specific algorithm
 * POST /api/planning/compare     - Compare two algorithms side-by-side
 * POST /api/planning/agent       - Run the intelligent agent
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
const coursesRouter = require('./courses');

function getCourses() {
  return coursesRouter.getCourseStore();
}

// ── POST /api/planning/run ─────────────────────────────────
router.post('/run', (req, res) => {
  const {
    algorithm = 'bfs',
    goal = 'fastest',
    constraints = {},
    completedCourseIds = []
  } = req.body;

  const courses = getCourses();
  if (courses.length === 0) {
    return res.status(400).json({ error: 'No courses loaded. Please load a dataset first.' });
  }

  const completed = new Set(completedCourseIds);
  const startTime = Date.now();
  let result;

  switch (algorithm.toLowerCase()) {
    case 'bfs':
      result = bfsPlanner(courses, constraints, completed);
      break;
    case 'dfs':
      result = dfsPlanner(courses, constraints, completed);
      break;
    case 'ucs':
      result = ucsPlanner(courses, constraints, completed);
      break;
    case 'astar':
    case 'a*':
      result = astarPlanner(courses, constraints, completed, goal);
      break;
    case 'csp':
      result = cspPlanner(courses, constraints, completed);
      break;
    default:
      return res.status(400).json({ error: `Unknown algorithm: ${algorithm}` });
  }

  const elapsed = Date.now() - startTime;

  res.json({
    ...result,
    executionTimeMs: elapsed,
    coursesAnalyzed: courses.length,
    completedCount: completedCourseIds.length
  });
});

// ── POST /api/planning/compare ─────────────────────────────
router.post('/compare', (req, res) => {
  const {
    algorithmA = 'bfs',
    algorithmB = 'astar',
    goal = 'fastest',
    constraints = {},
    completedCourseIds = []
  } = req.body;

  const courses = getCourses();
  if (courses.length === 0) {
    return res.status(400).json({ error: 'No courses loaded.' });
  }

  const completed = new Set(completedCourseIds);

  function runAlgorithm(name) {
    const start = Date.now();
    let result;
    switch (name.toLowerCase()) {
      case 'bfs': result = bfsPlanner(courses, constraints, completed); break;
      case 'dfs': result = dfsPlanner(courses, constraints, completed); break;
      case 'ucs': result = ucsPlanner(courses, constraints, completed); break;
      case 'astar': case 'a*': result = astarPlanner(courses, constraints, completed, goal); break;
      case 'csp': result = cspPlanner(courses, constraints, completed); break;
      default: result = bfsPlanner(courses, constraints, completed);
    }
    return { ...result, executionTimeMs: Date.now() - start };
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
router.post('/agent', (req, res) => {
  const {
    goal = 'balanced',
    constraints = {},
    completedCourseIds = [],
    specializationTags = []
  } = req.body;

  const courses = getCourses();
  if (courses.length === 0) {
    return res.status(400).json({ error: 'No courses loaded.' });
  }

  const completed = new Set(completedCourseIds);
  const start = Date.now();
  const result = intelligentAgent(courses, constraints, completed, goal, specializationTags);

  res.json({ ...result, executionTimeMs: Date.now() - start });
});

// ── GET /api/planning/graph ────────────────────────────────
router.get('/graph', (req, res) => {
  const courses = getCourses();

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

  res.json({ nodes, edges, stats });
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
