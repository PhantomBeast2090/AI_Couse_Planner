/**
 * Scope-resolution tests (node:test).
 *
 * resolvePlanningScope is the single function turning a user selection into
 * a plannable course set. These tests pin its contract: exactly-one
 * selection, program curriculum + closure, target-course ancestor closure,
 * unrelated exclusion, scoped edges, stats, determinism — and never a
 * silent global fallback.
 */
'use strict';

const assert = require('node:assert/strict');
const { test, describe } = require('node:test');

const { sampleCourses } = require('../data/sampleCourses');
const { PROGRAMS } = require('../data/programs');
const { resolvePlanningScope, scopeMeta } = require('../utils/scopeResolver');
const { mkCourse, setOf } = require('./helpers');

function chainFixture() {
  return [
    mkCourse('A'), mkCourse('B', ['A']), mkCourse('C', ['B']),
    mkCourse('X'), mkCourse('Y', ['X']),
  ];
}

describe('selection validation (no global fallback)', () => {
  test('missing selection fails with SELECTION_REQUIRED', () => {
    for (const bad of [{}, { programId: null, targetCourseId: null }, null, undefined]) {
      const r = resolvePlanningScope(bad, chainFixture(), setOf([]));
      assert.strictEqual(r.ok, false);
      assert.strictEqual(r.error.code, 'SELECTION_REQUIRED');
    }
  });

  test('both program and course set fails', () => {
    const r = resolvePlanningScope({ programId: 'bsc-cs', targetCourseId: 'C' }, chainFixture(), setOf([]));
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.error.code, 'SELECTION_REQUIRED');
  });

  test('unknown program fails with UNKNOWN_PROGRAM', () => {
    const r = resolvePlanningScope({ programId: 'nope' }, sampleCourses, setOf([]));
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.error.code, 'UNKNOWN_PROGRAM');
  });

  test('unknown target course fails with UNKNOWN_COURSE', () => {
    const r = resolvePlanningScope({ targetCourseId: 'GHOST' }, chainFixture(), setOf([]));
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.error.code, 'UNKNOWN_COURSE');
  });

  test('missing prerequisite inside scope fails, never ignored', () => {
    const courses = [mkCourse('A', ['GHOST'])];
    const r = resolvePlanningScope({ targetCourseId: 'A' }, courses, setOf([]));
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.error.code, 'MISSING_DEPENDENCIES');
  });

  test('cyclic scope fails safely', () => {
    const courses = [mkCourse('A', ['B']), mkCourse('B', ['A'])];
    const r = resolvePlanningScope({ targetCourseId: 'A' }, courses, setOf([]));
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.error.code, 'CYCLIC_SCOPE');
  });
});

describe('program scope', () => {
  test('every catalog program resolves to its curriculum + closure', () => {
    for (const program of PROGRAMS) {
      const r = resolvePlanningScope({ programId: program.id }, sampleCourses, setOf([]));
      assert.strictEqual(r.ok, true, `${program.id}: ${r.error?.message}`);
      assert.strictEqual(r.kind, 'program');
      for (const id of program.requiredCourseIds) {
        assert.ok(r.scopeCourseIds.includes(id), `${program.id} scope must include required ${id}`);
      }
      // Closure: every scoped prerequisite is itself in scope.
      const inScope = new Set(r.scopeCourseIds);
      r.scopedCourses.forEach((c) => {
        (c.prerequisites || []).forEach((p) => {
          assert.ok(inScope.has(p), `${c.id} prerequisite ${p} must be in scope`);
        });
      });
    }
  });

  test('program scope excludes unrelated catalog courses', () => {
    const r = resolvePlanningScope({ programId: 'data-science' }, sampleCourses, setOf([]));
    assert.strictEqual(r.ok, true);
    assert.ok(r.scopeCourseIds.length < sampleCourses.length, 'scope must be smaller than the catalog');
    assert.ok(!r.scopeCourseIds.includes('sys401'), 'systems course must not leak into data-science');
  });
});

describe('individual-course scope', () => {
  test('target resolves to itself plus the full ancestor closure', () => {
    const courses = [
      mkCourse('A'), mkCourse('B'),
      mkCourse('C', ['A', 'B']),
      mkCourse('D', ['C']),
      mkCourse('X'), // unrelated
    ];
    const r = resolvePlanningScope({ targetCourseId: 'D' }, courses, setOf([]));
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.kind, 'course');
    assert.deepStrictEqual([...r.scopeCourseIds].sort(), ['A', 'B', 'C', 'D']);
  });

  test('scoped edges reference only scoped nodes', () => {
    const r = resolvePlanningScope({ targetCourseId: 'C' }, chainFixture(), setOf([]));
    assert.strictEqual(r.ok, true);
    const inScope = new Set(r.scopeCourseIds);
    r.stats.edges.forEach((e) => {
      assert.ok(inScope.has(e.source), `edge source ${e.source} must be scoped`);
      assert.ok(inScope.has(e.target), `edge target ${e.target} must be scoped`);
    });
    assert.strictEqual(r.stats.edgeCount, r.stats.edges.length);
  });
});

describe('scope stats and metadata', () => {
  test('stats reflect completed/remaining/capacity/depth', () => {
    const r = resolvePlanningScope({ targetCourseId: 'C' }, chainFixture(), setOf(['A']));
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.stats.total, 3);
    assert.strictEqual(r.stats.completed, 1);
    assert.strictEqual(r.stats.remaining, 2);
    assert.strictEqual(r.stats.maxCapacity, 64);
    assert.strictEqual(r.stats.overCapacity, false);
    assert.strictEqual(r.stats.criticalDepth, 3);
    assert.strictEqual(r.stats.depthExceeded, false);
    assert.deepStrictEqual(r.completedIds, ['A']);
  });

  test('over-capacity and deep chains are flagged, not hidden', () => {
    // 70-course chain: the target's closure holds all 70, exceeding the
    // 64-slot maximum capacity.
    const wide = [];
    for (let i = 0; i < 70; i++) wide.push(mkCourse(`W${i}`, i === 0 ? [] : [`W${i - 1}`]));
    const r = resolvePlanningScope({ targetCourseId: 'W69' }, wide, setOf([]));
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.stats.remaining, 70);
    assert.strictEqual(r.stats.overCapacity, true);

    const deep = [];
    for (let i = 0; i < 10; i++) deep.push(mkCourse(`D${i}`, i === 0 ? [] : [`D${i - 1}`]));
    const rd = resolvePlanningScope({ targetCourseId: 'D9' }, deep, setOf([]));
    assert.strictEqual(rd.ok, true);
    assert.strictEqual(rd.stats.criticalDepth, 10);
    assert.strictEqual(rd.stats.depthExceeded, true);
  });

  test('scopeMeta exposes metadata without course blobs', () => {
    const r = resolvePlanningScope({ targetCourseId: 'C' }, chainFixture(), setOf([]));
    assert.deepStrictEqual(scopeMeta(r), {
      kind: 'course', programId: null, targetCourseId: 'C', selectedName: 'C',
      size: 3, completed: 0, remaining: 3, edgeCount: 2, criticalDepth: 3,
    });
    assert.strictEqual(scopeMeta({ ok: false }), null);
  });

  test('resolution is deterministic', () => {
    const first = resolvePlanningScope({ programId: 'bsc-cs' }, sampleCourses, setOf([]));
    const second = resolvePlanningScope({ programId: 'bsc-cs' }, sampleCourses, setOf([]));
    assert.deepStrictEqual(first, second);
  });
});
