/**
 * Degree-timeline regression tests (node:test).
 *
 * Guards the 8-semester product invariant: timelines are program-scoped,
 * capped at 8 semesters / 8 courses each, prerequisite-valid, and honest
 * about overflow (structured failure, never Semester 9+).
 */
'use strict';

const assert = require('node:assert/strict');
const http = require('node:http');
const { test, describe, before, after } = require('node:test');

const { sampleCourses } = require('../data/sampleCourses');
const { PROGRAMS } = require('../data/programs');
const { planDegreeTimeline, planTimeline } = require('../algorithms/degreePlanner');
const { validateTimeline } = require('../utils/planValidator');
const { mkCourse, setOf } = require('./helpers');

// Typical full-time degree load used across timeline tests.
const DEGREE_CONSTRAINTS = {
  maxCredits: 21, maxHardCourses: 3, maxCoursesPerSemester: 8, maxSemesters: 8,
};

function plannedIds(result) {
  return (result.semesterPlan || []).flatMap((s) => s.courses.map((c) => c.id));
}

/** Shared hard-cap assertions for every successful timeline. */
function assertTimelineInvariants(result, eligible, completed, requiredIds, constraints = DEGREE_CONSTRAINTS) {
  assert.strictEqual(result.success, true, `expected success, got ${result.reason}: ${result.message}`);
  assert.ok(result.totalSemesters <= 8, `at most 8 semesters, got ${result.totalSemesters}`);
  for (const sem of result.semesterPlan) {
    assert.ok(sem.semester >= 1 && sem.semester <= 8, `no Semester 9+, found ${sem.semester}`);
    assert.ok(sem.courses.length <= 8, `at most 8 courses per semester, got ${sem.courses.length}`);
  }
  const { valid, errors } = validateTimeline(result.semesterPlan, {
    courses: eligible, completedInput: completed, constraints,
    programCourseIds: eligible.map((c) => c.id), requiredIds, unplannedIds: [],
  });
  assert.strictEqual(valid, true, `timeline invalid: ${errors.join('; ')}`);
}

describe('degree timelines stay within 8 semesters', () => {
  for (const program of PROGRAMS) {
    test(`${program.id} plans in <= 8 semesters`, () => {
      const r = planDegreeTimeline(sampleCourses, program.id, { ...DEGREE_CONSTRAINTS }, setOf([]), 'balanced');
      const { eligible } = require('../data/programs').buildEligibleSet(
        program, sampleCourses
      );
      assertTimelineInvariants(r, eligible, setOf([]), program.requiredCourseIds);
    });
  }

  test('parallel courses pack efficiently (20 independent -> <= 3 semesters)', () => {
    const eligible = Array.from({ length: 20 }, (_, i) => mkCourse(`P${i}`));
    const r = planTimeline(eligible, eligible.map((c) => c.id),
      { programId: 'syn', programName: 'syn' }, { ...DEGREE_CONSTRAINTS }, setOf([]), 'fastest');
    assertTimelineInvariants(r, eligible, setOf([]), eligible.map((c) => c.id));
    assert.ok(r.totalSemesters <= 3, `20 courses at 8/sem fit 3 semesters, got ${r.totalSemesters}`);
  });

  test('completed courses are excluded from the timeline', () => {
    const program = PROGRAMS[0];
    const completed = setOf([program.requiredCourseIds[0], program.requiredCourseIds[1]]);
    const r = planDegreeTimeline(sampleCourses, program.id, { ...DEGREE_CONSTRAINTS }, completed, 'balanced');
    const { buildEligibleSet } = require('../data/programs');
    const { eligible } = buildEligibleSet(program, sampleCourses);
    assertTimelineInvariants(r, eligible, completed, program.requiredCourseIds);
    const ids = plannedIds(r);
    for (const id of completed) {
      assert.ok(!ids.includes(id), `completed course ${id} must not be replanned`);
    }
  });

  test('chain longer than 8 semesters fails safely, never emits Semester 9+', () => {
    const eligible = [];
    for (let i = 0; i < 10; i++) {
      eligible.push(mkCourse(`C${i}`, i === 0 ? [] : [`C${i - 1}`]));
    }
    const r = planTimeline(eligible, eligible.map((c) => c.id),
      { programId: 'syn', programName: 'syn' }, { ...DEGREE_CONSTRAINTS }, setOf([]), 'fastest');
    assert.strictEqual(r.success, false);
    assert.strictEqual(r.reason, 'PLAN_EXCEEDS_8_SEMESTERS');
    assert.ok(r.semesterPlan.length <= 8, 'partial plan capped at 8 semesters');
    for (const sem of r.semesterPlan) {
      assert.ok(sem.semester <= 8, `no Semester 9+, found ${sem.semester}`);
    }
    assert.ok(r.unplannedCourses.length > 0, 'overflow courses explicitly reported');
    assert.ok(r.message.length > 0, 'human-readable message present');
    // The partial prefix itself must still be valid.
    const { valid, errors } = validateTimeline(r.semesterPlan, {
      courses: eligible, completedInput: setOf([]), constraints: DEGREE_CONSTRAINTS,
      programCourseIds: eligible.map((c) => c.id),
      requiredIds: eligible.map((c) => c.id),
      unplannedIds: r.unplannedCourses.map((u) => u.id),
    });
    assert.strictEqual(valid, true, `failure prefix must be valid: ${errors.join('; ')}`);
  });

  test('different programs yield different eligible sets and timelines', () => {
    const a = planDegreeTimeline(sampleCourses, 'bsc-cs', { ...DEGREE_CONSTRAINTS }, setOf([]), 'balanced');
    const b = planDegreeTimeline(sampleCourses, 'data-science', { ...DEGREE_CONSTRAINTS }, setOf([]), 'balanced');
    assert.strictEqual(a.success, true);
    assert.strictEqual(b.success, true);
    const idsA = new Set(plannedIds(a));
    const idsB = new Set(plannedIds(b));
    assert.ok([...idsA].some((id) => !idsB.has(id)), 'programs must differ (bsc-cs has unique courses)');
    assert.ok([...idsB].some((id) => !idsA.has(id)), 'programs must differ (data-science has unique courses)');
  });

  test('failed course (removed from completed) is replanned into a valid later semester', () => {
    // Chain A -> B -> C with only A completed: B "failed", must come back.
    const eligible = [mkCourse('A'), mkCourse('B', ['A']), mkCourse('C', ['B'])];
    const r = planTimeline(eligible, ['A', 'B', 'C'],
      { programId: 'syn', programName: 'syn' }, { ...DEGREE_CONSTRAINTS }, setOf(['A']), 'balanced');
    assertTimelineInvariants(r, eligible, setOf(['A']), ['A', 'B', 'C']);
    const ids = plannedIds(r);
    assert.ok(ids.includes('B'), 'failed course B must be replanned');
    const order = {};
    r.semesterPlan.forEach((s) => s.courses.forEach((c) => { order[c.id] = s.semester; }));
    assert.ok(order.B < order.C, 'replanned B must precede dependent C');
  });

  test('empty and unknown program selections fail safely', () => {
    for (const bad of [null, '', 'no-such-degree']) {
      const r = planDegreeTimeline(sampleCourses, bad, { ...DEGREE_CONSTRAINTS }, setOf([]), 'balanced');
      assert.strictEqual(r.success, false, `program ${JSON.stringify(bad)} must fail`);
      assert.ok(r.reason === 'INVALID_PROGRAM' || r.reason === 'PROGRAM_NOT_FOUND', `got ${r.reason}`);
      assert.deepStrictEqual(r.semesterPlan, []);
    }
  });

  test('tight constraints produce structured overflow, not silent truncation', () => {
    // ai-ml is provably infeasible at 2 hard courses/semester (9 hard courses
    // need 9 slots but only 8 fit once chains force them late).
    const r = planDegreeTimeline(sampleCourses, 'ai-ml',
      { maxCredits: 18, maxHardCourses: 2, maxCoursesPerSemester: 8 }, setOf([]), 'balanced');
    assert.strictEqual(r.success, false);
    assert.strictEqual(r.reason, 'PLAN_EXCEEDS_8_SEMESTERS');
    assert.strictEqual(r.message, 'The selected course requirements cannot be completed within 8 semesters under the current constraints.');
    assert.ok(r.semesterPlan.length <= 8);
  });
});

// ── HTTP layer ──────────────────────────────────────────────
let server;
let baseUrl;

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const payload = body === undefined ? null : JSON.stringify(body);
    const req = http.request(
      { method, hostname: url.hostname, port: url.port, path: url.pathname, headers: { 'Content-Type': 'application/json' } },
      (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          let json = null;
          try { json = data ? JSON.parse(data) : null; } catch { /* fail loudly below */ }
          resolve({ status: res.statusCode, json });
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

describe('degree API', () => {
  before(async () => {
    const app = require('../index');
    const coursesRouter = require('../routes/courses');
    coursesRouter.setCourseStore(sampleCourses.map((c) => ({ ...c })));
    await new Promise((resolve) => { server = app.listen(0, '127.0.0.1', resolve); });
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  test('GET /api/programs lists the catalog', async () => {
    const { status, json } = await request('GET', '/api/programs');
    assert.strictEqual(status, 200);
    assert.strictEqual(json.count, 3);
    assert.deepStrictEqual(json.programs.map((p) => p.id).sort(), ['ai-ml', 'bsc-cs', 'data-science']);
  });

  test('POST /api/planning/degree returns a capped, valid timeline', async () => {
    const { status, json } = await request('POST', '/api/planning/degree', {
      programId: 'bsc-cs',
      goal: 'balanced',
      constraints: { ...DEGREE_CONSTRAINTS },
      completedCourseIds: [],
    });
    assert.strictEqual(status, 200);
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.programId, 'bsc-cs');
    assert.ok(json.totalSemesters <= 8);
    assert.ok(typeof json.executionTimeMs === 'number');
  });

  test('POST /api/planning/degree rejects missing programId', async () => {
    const { status, json } = await request('POST', '/api/planning/degree', { goal: 'balanced' });
    assert.strictEqual(status, 400);
    assert.ok(json.error);
    assert.ok(Array.isArray(json.programs), 'response lists valid program ids');
  });
});
