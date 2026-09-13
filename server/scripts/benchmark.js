/**
 * Reproducible algorithm benchmark.
 *
 * Runs the SAME problem instances through BFS, DFS, UCS, A* and CSP and
 * reports only metrics that are actually measured: plan validity, semesters,
 * nodes explored, wall time, total cost, planning steps, success/failure.
 *
 * Usage: npm run benchmark   (from server/)
 *
 * Determinism: fixtures, constraints and completed sets are hardcoded, and
 * every planner is deterministic (no RNG in the planning path), so plans,
 * semester counts and node counts reproduce exactly. Wall time is
 * machine-specific — treat it as indicative and re-run for comparisons.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { performance } = require('node:perf_hooks');

const { bfsPlanner } = require('../algorithms/bfs');
const { dfsPlanner } = require('../algorithms/dfs');
const { ucsPlanner } = require('../algorithms/ucs');
const { astarPlanner } = require('../algorithms/astar');
const { cspPlanner } = require('../algorithms/csp');
const { validatePlan } = require('../utils/planValidator');
const { sampleCourses } = require('../data/sampleCourses');

function c(id, prerequisites = [], overrides = {}) {
  return {
    id,
    name: id,
    credits: 3,
    difficulty: 2,
    tags: [],
    prerequisites,
    ...overrides,
  };
}

const CONSTRAINTS = { maxCredits: 15, maxHardCourses: 2, maxCoursesPerSemester: 4, maxSemesters: 10 };
const COMPLETED = new Set(['math101', 'cs101']);

const INSTANCES = [
  {
    name: 'chain-6',
    courses: ['N0', 'N1', 'N2', 'N3', 'N4', 'N5'].map((id, i) =>
      c(id, i === 0 ? [] : [`N${i - 1}`])),
    completed: new Set(),
  },
  {
    name: 'branching-7',
    courses: [
      c('A'), c('B'), c('C', ['A', 'B']),
      c('D', ['A']), c('E', ['B']),
      c('F', ['C', 'D'], { difficulty: 4 }), c('G', ['E']),
    ],
    completed: new Set(),
  },
  {
    name: 'mixed-12',
    courses: [
      c('m1'), c('m2', ['m1']), c('m3', ['m2'], { difficulty: 4 }),
      c('s1'), c('s2', ['s1']), c('s3', ['s2', 'm2'], { difficulty: 4 }),
      c('e1', [], { difficulty: 1, credits: 2 }), c('e2', [], { difficulty: 1, credits: 2 }),
      c('a1', ['m2', 's2'], { difficulty: 3 }), c('a2', ['a1'], { difficulty: 5 }),
      c('p1', ['a1', 'm3'], { difficulty: 4 }), c('p2', ['p1']),
    ],
    completed: new Set(['e1']),
  },
  {
    // First 15 sample courses form a closed DAG (every prerequisite is inside
    // the slice), giving a realistic-data instance without external input.
    name: 'sample-15',
    courses: sampleCourses.slice(0, 15).map((x) => ({ ...x })),
    completed: new Set(COMPLETED),
  },
];

const ALGORITHMS = {
  BFS: (courses, completed) => bfsPlanner(courses, CONSTRAINTS, completed),
  DFS: (courses, completed) => dfsPlanner(courses, CONSTRAINTS, completed),
  UCS: (courses, completed) => ucsPlanner(courses, CONSTRAINTS, completed),
  'A*': (courses, completed) => astarPlanner(courses, CONSTRAINTS, completed, 'balanced'),
  CSP: (courses, completed) => cspPlanner(courses, CONSTRAINTS, completed),
};

function totalCostOf(result) {
  if (typeof result.totalCost === 'number') return result.totalCost;
  return (result.semesterPlan || []).reduce(
    (s, sem) => s + (sem.courses || []).reduce((a, x) => a + (x.difficulty || 0), 0),
    0
  );
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function runOnce(name, fn, courses, completed) {
  const start = performance.now();
  const result = fn(courses, completed);
  const timeMs = performance.now() - start;
  const { valid } = validatePlan(result.semesterPlan || [], courses, completed, CONSTRAINTS);
  return {
    algorithm: name,
    success: result.success === true,
    // A failed run has no meaningful plan; validity applies to successes.
    valid: result.success === true ? valid : null,
    semesters: (result.semesterPlan || []).length,
    nodes: (result.nodesExplored || []).length,
    timeMs,
    cost: totalCostOf(result),
    steps: (result.steps || []).length,
    error: result.error || null,
  };
}

function main() {
  const REPS = 3;
  const rows = [];

  for (const instance of INSTANCES) {
    for (const [name, fn] of Object.entries(ALGORITHMS)) {
      const reps = [];
      for (let i = 0; i < REPS; i++) {
        reps.push(runOnce(name, fn, instance.courses, instance.completed));
      }
      const first = reps[0];
      rows.push({
        dataset: instance.name,
        algorithm: name,
        success: first.success,
        valid: first.valid,
        semesters: first.semesters,
        nodes: first.nodes,
        timeMsMedian: +median(reps.map((r) => r.timeMs)).toFixed(2),
        cost: first.cost,
        steps: first.steps,
        error: first.error,
      });
    }
  }

  const header = '| Dataset | Algorithm | Success | Valid | Semesters | Nodes | Time (ms, median of 3) | Cost | Steps |';
  const divider = '|---|---|---|---|---|---|---|---|---|';
  const lines = [header, divider];
  for (const r of rows) {
    lines.push(
      `| ${r.dataset} | ${r.algorithm} | ${r.success} | ${r.valid === null ? 'n/a' : r.valid} | ` +
      `${r.semesters} | ${r.nodes} | ${r.timeMsMedian} | ${r.cost} | ${r.steps} |`
    );
  }
  const failures = rows.filter((r) => !r.success);
  if (failures.length > 0) {
    lines.push('');
    lines.push('Failures (no valid plan exists or planner reported an error):');
    for (const f of failures) {
      lines.push(`- ${f.dataset} / ${f.algorithm}: ${f.error}`);
    }
  }
  lines.push('');
  lines.push(
    'Notes: plans, semester counts, node counts, cost and steps are deterministic for these ' +
    'fixtures. Time varies by machine — re-run with `npm run benchmark` for local numbers.'
  );

  const output = lines.join('\n');
  console.log(output);

  const outDir = path.join(__dirname, '..', 'benchmark');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, 'results.json'),
    JSON.stringify({ generatedAt: new Date().toISOString(), constraints: CONSTRAINTS, rows }, null, 2)
  );
}

if (require.main === module) {
  main();
}

module.exports = { main, INSTANCES, CONSTRAINTS };
