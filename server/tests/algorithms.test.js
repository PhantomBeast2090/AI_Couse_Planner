/**
 * Algorithm correctness tests (node:test).
 *
 * Every planner — BFS, DFS, UCS, A*, CSP — runs the same fixtures and is
 * judged by the same shared validator. Tests assert behavior (valid plans,
 * respected constraints, safe failures), not implementation details.
 */
'use strict';

const assert = require('node:assert/strict');
const { test, describe } = require('node:test');
const { bfsPlanner } = require('../algorithms/bfs');
const { dfsPlanner } = require('../algorithms/dfs');
const { ucsPlanner } = require('../algorithms/ucs');
const { astarPlanner } = require('../algorithms/astar');
const { cspPlanner } = require('../algorithms/csp');
const { validatePlan } = require('../utils/planValidator');
const {
  mkCourse,
  DEFAULT_CONSTRAINTS,
  setOf,
  plannedIds,
  assertSuccessfulPlan,
  assertFailedSafely,
  assertFailurePrefixValid,
} = require('./helpers');

const PLANNERS = {
  BFS: (courses, constraints, completed) => bfsPlanner(courses, constraints, completed),
  DFS: (courses, constraints, completed) => dfsPlanner(courses, constraints, completed),
  UCS: (courses, constraints, completed) => ucsPlanner(courses, constraints, completed),
  'A*': (courses, constraints, completed) => astarPlanner(courses, constraints, completed, 'fastest'),
  CSP: (courses, constraints, completed) => cspPlanner(courses, constraints, completed),
};

/** Semester index (0-based) of a course inside a result plan. */
function semesterIndexOf(result, courseId) {
  const plan = result.semesterPlan || [];
  for (let i = 0; i < plan.length; i++) {
    if ((plan[i].courses || []).some((c) => c.id === courseId)) return i;
  }
  return -1;
}

for (const [name, run] of Object.entries(PLANNERS)) {
  describe(`${name} planner`, () => {
    test('simple chain A -> B -> C respects order', () => {
      const courses = [mkCourse('A'), mkCourse('B', ['A']), mkCourse('C', ['B'])];
      const r = run(courses, { ...DEFAULT_CONSTRAINTS }, setOf([]));
      assertSuccessfulPlan(r, courses, setOf([]));
      assert.ok(semesterIndexOf(r, 'A') < semesterIndexOf(r, 'B'), 'A before B');
      assert.ok(semesterIndexOf(r, 'B') < semesterIndexOf(r, 'C'), 'B before C');
    });

    test('branching prerequisites A -> C, B -> C', () => {
      const courses = [mkCourse('A'), mkCourse('B'), mkCourse('C', ['A', 'B'])];
      const r = run(courses, { ...DEFAULT_CONSTRAINTS }, setOf([]));
      assertSuccessfulPlan(r, courses, setOf([]));
      assert.ok(semesterIndexOf(r, 'A') < semesterIndexOf(r, 'C'), 'A before C');
      assert.ok(semesterIndexOf(r, 'B') < semesterIndexOf(r, 'C'), 'B before C');
    });

    test('multiple independent chains', () => {
      const courses = [
        mkCourse('A1'), mkCourse('B1', ['A1']),
        mkCourse('A2'), mkCourse('B2', ['A2']),
      ];
      const r = run(courses, { ...DEFAULT_CONSTRAINTS }, setOf([]));
      assertSuccessfulPlan(r, courses, setOf([]));
    });

    test('deep chain of six forces six semesters', () => {
      const courses = [];
      for (let i = 0; i < 6; i++) {
        courses.push(mkCourse(`N${i}`, i === 0 ? [] : [`N${i - 1}`]));
      }
      const r = run(courses, { ...DEFAULT_CONSTRAINTS }, setOf([]));
      assertSuccessfulPlan(r, courses, setOf([]));
      assert.strictEqual(r.totalSemesters, 6, `chain of 6 needs 6 semesters, got ${r.totalSemesters}`);
    });

    test('courses with no prerequisites share semesters', () => {
      const courses = [mkCourse('A'), mkCourse('B'), mkCourse('C')];
      const r = run(courses, { ...DEFAULT_CONSTRAINTS }, setOf([]));
      assertSuccessfulPlan(r, courses, setOf([]));
      assert.strictEqual(r.totalSemesters, 1, `independent courses fit one semester, got ${r.totalSemesters}`);
    });

    test('completed courses are excluded, partial chains continue', () => {
      const courses = [mkCourse('A'), mkCourse('B', ['A']), mkCourse('C', ['B'])];
      const completed = setOf(['A']);
      const r = run(courses, { ...DEFAULT_CONSTRAINTS }, completed);
      assertSuccessfulPlan(r, courses, completed);
      assert.ok(!plannedIds(r).includes('A'), 'completed course must not be replanned');
      assert.ok(semesterIndexOf(r, 'B') < semesterIndexOf(r, 'C'), 'B before C');
    });

    test('credit limit is respected per semester', () => {
      const courses = [
        mkCourse('A', [], { credits: 3 }),
        mkCourse('B', [], { credits: 3 }),
        mkCourse('C', [], { credits: 3 }),
      ];
      const constraints = { ...DEFAULT_CONSTRAINTS, maxCredits: 3 };
      const r = run(courses, constraints, setOf([]));
      assertSuccessfulPlan(r, courses, setOf([]), constraints);
      assert.strictEqual(r.totalSemesters, 3, `3-credit cap forces 3 semesters, got ${r.totalSemesters}`);
    });

    test('hard-course limit is respected per semester', () => {
      const courses = [
        mkCourse('H1', [], { difficulty: 5 }),
        mkCourse('H2', [], { difficulty: 4 }),
        mkCourse('E1', [], { difficulty: 1 }),
      ];
      const constraints = { ...DEFAULT_CONSTRAINTS, maxHardCourses: 1 };
      const r = run(courses, constraints, setOf([]));
      assertSuccessfulPlan(r, courses, setOf([]), constraints);
      for (const sem of r.semesterPlan) {
        assert.ok(
          (sem.courses || []).filter((c) => c.difficulty >= 4).length <= 1,
          'at most one hard course per semester'
        );
      }
    });

    test('empty course set succeeds vacuously', () => {
      const r = run([], { ...DEFAULT_CONSTRAINTS }, setOf([]));
      assert.strictEqual(r.success, true, `empty input should succeed, got: ${r.error}`);
      assert.deepStrictEqual(r.semesterPlan, []);
      assert.strictEqual(r.totalSemesters, 0);
    });

    test('unknown prerequisite id fails safely', () => {
      const courses = [mkCourse('A', ['GHOST'])];
      const r = run(courses, { ...DEFAULT_CONSTRAINTS }, setOf([]));
      assertFailedSafely(r);
      assertFailurePrefixValid(r, courses, setOf([]));
    });

    test('impossible credit limit fails safely instead of hanging', () => {
      const courses = [mkCourse('BIG', [], { credits: 6 })];
      const constraints = { ...DEFAULT_CONSTRAINTS, maxCredits: 3 };
      const r = run(courses, constraints, setOf([]));
      assertFailedSafely(r);
    });

    test('cyclic prerequisites fail safely', () => {
      const courses = [mkCourse('A', ['B']), mkCourse('B', ['A'])];
      const r = run(courses, { ...DEFAULT_CONSTRAINTS }, setOf([]));
      assertFailedSafely(r);
      assertFailurePrefixValid(r, courses, setOf([]));
    });

    test('self-loop prerequisite fails safely', () => {
      const courses = [mkCourse('A', ['A'])];
      const r = run(courses, { ...DEFAULT_CONSTRAINTS }, setOf([]));
      assertFailedSafely(r);
    });

    test('duplicate course rows never produce duplicate plans', () => {
      const courses = [mkCourse('A'), mkCourse('A'), mkCourse('B', ['A'])];
      const r = run(courses, { ...DEFAULT_CONSTRAINTS }, setOf([]));
      assert.strictEqual(r.success, true, `duplicates should be tolerated, got: ${r.error}`);
      assert.deepStrictEqual(plannedIds(r), ['A', 'B']);
    });

    test('all courses completed yields empty plan', () => {
      const courses = [mkCourse('A'), mkCourse('B', ['A'])];
      const completed = setOf(['A', 'B']);
      const r = run(courses, { ...DEFAULT_CONSTRAINTS }, completed);
      assert.strictEqual(r.success, true);
      assert.deepStrictEqual(r.semesterPlan, []);
    });
  });
}

describe('cross-planner agreement', () => {
  test('all planners produce valid plans on a mixed graph', () => {
    const courses = [
      mkCourse('math101'),
      mkCourse('cs101'),
      mkCourse('math102', ['math101']),
      mkCourse('cs201', ['cs101']),
      mkCourse('cs301', ['cs201', 'math102'], { difficulty: 4 }),
      mkCourse('elec', [], { difficulty: 1, credits: 2 }),
    ];
    for (const [name, run] of Object.entries(PLANNERS)) {
      const r = run(courses, { ...DEFAULT_CONSTRAINTS }, setOf([]));
      assert.strictEqual(r.success, true, `${name} should succeed, got: ${r.error}`);
      const { valid, errors } = validatePlan(r.semesterPlan, courses, setOf([]), DEFAULT_CONSTRAINTS);
      assert.strictEqual(valid, true, `${name} plan invalid: ${errors.join('; ')}`);
    }
  });

  test('all planners agree a cycle is impossible', () => {
    const courses = [
      mkCourse('X', ['Z']),
      mkCourse('Y', ['X']),
      mkCourse('Z', ['Y']),
    ];
    for (const [name, run] of Object.entries(PLANNERS)) {
      const r = run(courses, { ...DEFAULT_CONSTRAINTS }, setOf([]));
      assert.strictEqual(r.success, false, `${name} must report failure on a cycle`);
    }
  });
});
