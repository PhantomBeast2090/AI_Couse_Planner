/**
 * Intelligent-agent decision tests (node:test).
 *
 * Covers the actual pipeline in server/algorithms/agent.js:
 * perception -> reasoning (strategy map) -> action (run candidates) ->
 * utility scoring (scorePlan) -> decision (argmax) -> recommendations.
 */
'use strict';

const assert = require('node:assert/strict');
const { test, describe } = require('node:test');
const { intelligentAgent, scorePlan, perceiveEnvironment } = require('../algorithms/agent');
const { validatePlan } = require('../utils/planValidator');
const { mkCourse, DEFAULT_CONSTRAINTS, setOf } = require('./helpers');

function chainCourses() {
  return [mkCourse('A'), mkCourse('B', ['A']), mkCourse('C', ['B'])];
}

function sem(courses, totalCredits) {
  return {
    semester: 1,
    courses,
    totalCredits: totalCredits != null
      ? totalCredits
      : courses.reduce((s, c) => s + c.credits, 0),
    hardCourseCount: courses.filter((c) => c.difficulty >= 4).length,
  };
}

function planCourse(id, difficulty = 2, tags = []) {
  return { id, name: id, credits: 3, difficulty, tags, prerequisites: [] };
}

describe('perception', () => {
  test('empty course set yields zeroed metrics, never NaN', () => {
    const p = perceiveEnvironment([]);
    assert.strictEqual(p.totalCourses, 0);
    assert.strictEqual(p.hasCycles, false);
    assert.ok(Number.isFinite(p.avgPrereqs), 'avgPrereqs must be finite');
    assert.ok(Number.isFinite(p.avgDifficulty), 'avgDifficulty must be finite');
  });

  test('chain depth and averages are measured', () => {
    const p = perceiveEnvironment(chainCourses());
    assert.strictEqual(p.totalCourses, 3);
    assert.strictEqual(p.hasCycles, false);
    assert.ok(p.maxDepth >= 2, `expected chain depth >= 2, got ${p.maxDepth}`);
  });

  test('cycles are detected', () => {
    const p = perceiveEnvironment([mkCourse('A', ['B']), mkCourse('B', ['A'])]);
    assert.strictEqual(p.hasCycles, true);
  });
});

describe('utility scoring (scorePlan)', () => {
  test('fastest prefers fewer semesters', () => {
    const oneSem = [sem([planCourse('A'), planCourse('B'), planCourse('C')])];
    const threeSem = [
      sem([planCourse('A')]),
      sem([planCourse('B')]),
      sem([planCourse('C')]),
    ];
    assert.ok(
      scorePlan(oneSem, 'fastest') > scorePlan(threeSem, 'fastest'),
      'fewer semesters must score higher for fastest'
    );
  });

  test('easiest prefers lower total difficulty', () => {
    const easy = [sem([planCourse('A', 1), planCourse('B', 1)])];
    const hard = [sem([planCourse('A', 5), planCourse('B', 5)])];
    assert.ok(
      scorePlan(easy, 'easiest') > scorePlan(hard, 'easiest'),
      'lower difficulty must score higher for easiest'
    );
  });

  test('balanced prefers even workload', () => {
    const even = [sem([planCourse('A', 2)]), sem([planCourse('B', 2)])];
    const uneven = [sem([planCourse('A', 1)]), sem([planCourse('B', 5)])];
    assert.ok(
      scorePlan(even, 'balanced') > scorePlan(uneven, 'balanced'),
      'even workload must score higher for balanced'
    );
  });

  test('specialization rewards early tagged courses', () => {
    const early = [
      sem([planCourse('A', 2, ['AI'])]),
      sem([planCourse('B')]),
      sem([planCourse('C')]),
    ];
    const late = [
      sem([planCourse('B')]),
      sem([planCourse('C')]),
      sem([planCourse('A', 2, ['AI'])]),
    ];
    assert.ok(
      scorePlan(early, 'specialization', ['AI']) > scorePlan(late, 'specialization', ['AI']),
      'earlier specialization courses must score higher'
    );
  });

  test('empty plan scores worst', () => {
    assert.strictEqual(scorePlan([], 'fastest'), -Infinity);
    assert.strictEqual(scorePlan(null, 'balanced'), -Infinity);
  });
});

describe('reasoning: candidate strategy selection', () => {
  const EXPECTED = {
    fastest: ['astar', 'bfs'],
    easiest: ['astar', 'ucs'],
    balanced: ['astar', 'bfs'],
    specialization: ['astar', 'bfs', 'ucs'],
  };

  for (const [goal, strategies] of Object.entries(EXPECTED)) {
    test(`goal "${goal}" evaluates ${strategies.join(' + ')}`, () => {
      const r = intelligentAgent(chainCourses(), { ...DEFAULT_CONSTRAINTS }, setOf([]), goal, ['AI']);
      assert.strictEqual(r.success, true, `agent should succeed, got: ${r.error}`);
      const evaluated = (r.allStrategiesEvaluated || []).map((s) => s.strategy).sort();
      assert.deepStrictEqual(evaluated, [...strategies].sort());
    });
  }

  test('unknown goal falls back to a default strategy set', () => {
    const r = intelligentAgent(chainCourses(), { ...DEFAULT_CONSTRAINTS }, setOf([]), 'mystery');
    assert.strictEqual(r.success, true);
    assert.ok((r.allStrategiesEvaluated || []).length >= 1);
    assert.ok(r.chosenStrategy, 'a strategy must still be chosen');
  });
});

describe('decision: best candidate wins', () => {
  test('chosen strategy has the highest utility score', () => {
    for (const goal of ['fastest', 'easiest', 'balanced', 'specialization']) {
      const r = intelligentAgent(chainCourses(), { ...DEFAULT_CONSTRAINTS }, setOf([]), goal, ['AI']);
      assert.strictEqual(r.success, true, `${goal}: ${r.error}`);
      const scores = r.allStrategiesEvaluated.map((s) => s.score);
      const best = r.allStrategiesEvaluated.find((s) => s.strategy === r.chosenStrategy);
      assert.ok(best, 'chosen strategy must be among evaluated');
      assert.strictEqual(best.score, Math.max(...scores), `${goal}: winner must hold max score`);
    }
  });

  test('selected plan is prerequisite-valid', () => {
    const courses = [
      mkCourse('math101'),
      mkCourse('cs101'),
      mkCourse('cs201', ['cs101']),
      mkCourse('cs301', ['cs201', 'math101'], { difficulty: 4 }),
    ];
    const r = intelligentAgent(courses, { ...DEFAULT_CONSTRAINTS }, setOf([]), 'balanced');
    assert.strictEqual(r.success, true, r.error);
    const { valid, errors } = validatePlan(r.semesterPlan, courses, setOf([]), DEFAULT_CONSTRAINTS);
    assert.strictEqual(valid, true, `agent plan invalid: ${errors.join('; ')}`);
  });

  test('agent log records perception, reasoning, action, decision', () => {
    const r = intelligentAgent(chainCourses(), { ...DEFAULT_CONSTRAINTS }, setOf([]), 'fastest');
    assert.strictEqual(r.success, true);
    const phases = (r.agentLog || []).map((l) => l.phase);
    for (const expected of ['PERCEPTION', 'REASONING', 'ACTION', 'DECISION']) {
      assert.ok(phases.includes(expected), `agentLog must include ${expected}`);
    }
  });

  test('workload analysis and recommendations are produced', () => {
    const r = intelligentAgent(chainCourses(), { ...DEFAULT_CONSTRAINTS }, setOf([]), 'balanced');
    assert.strictEqual(r.success, true);
    assert.strictEqual(r.workloadAnalysis.length, r.semesterPlan.length);
    for (const w of r.workloadAnalysis) {
      assert.ok(['Light', 'Moderate', 'Heavy'].includes(w.workloadLabel), `bad label ${w.workloadLabel}`);
    }
    assert.ok(Array.isArray(r.recommendations));
  });
});

describe('agent failure handling', () => {
  test('cyclic graph fails safely with an error', () => {
    const r = intelligentAgent(
      [mkCourse('A', ['B']), mkCourse('B', ['A'])],
      { ...DEFAULT_CONSTRAINTS },
      setOf([]),
      'balanced'
    );
    assert.strictEqual(r.success, false);
    assert.ok(r.error);
  });

  test('unknown prerequisite fails safely', () => {
    const r = intelligentAgent(
      [mkCourse('A', ['GHOST'])],
      { ...DEFAULT_CONSTRAINTS },
      setOf([]),
      'balanced'
    );
    assert.strictEqual(r.success, false);
    assert.ok(r.error);
  });

  test('empty course set succeeds with an empty plan', () => {
    const r = intelligentAgent([], { ...DEFAULT_CONSTRAINTS }, setOf([]), 'balanced');
    assert.strictEqual(r.success, true);
    assert.deepStrictEqual(r.semesterPlan, []);
  });

  test('impossible credit limit fails safely', () => {
    const r = intelligentAgent(
      [mkCourse('BIG', [], { credits: 6 })],
      { ...DEFAULT_CONSTRAINTS, maxCredits: 3 },
      setOf([]),
      'fastest'
    );
    assert.strictEqual(r.success, false);
  });
});

describe('agent determinism', () => {
  test('same input yields same choice and plan twice', () => {
    const courses = [
      mkCourse('math101'),
      mkCourse('cs101'),
      mkCourse('cs201', ['cs101']),
      mkCourse('cs301', ['cs201', 'math101'], { difficulty: 4 }),
    ];
    const runOnce = () => intelligentAgent(courses, { ...DEFAULT_CONSTRAINTS }, setOf([]), 'balanced');
    const first = runOnce();
    const second = runOnce();
    assert.strictEqual(first.success, true);
    assert.strictEqual(second.success, true);
    assert.strictEqual(first.chosenStrategy, second.chosenStrategy);
    assert.deepStrictEqual(first.semesterPlan, second.semesterPlan);
  });
});
