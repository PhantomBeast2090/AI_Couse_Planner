/**
 * Simulation-route behavior tests (node:test, dependency-free).
 *
 * Exercises the existing POST /api/simulation/* endpoints over HTTP against
 * the real Express app with a tiny deterministic fixture (chain A -> B -> C).
 * Wherever a revised plan is returned with success=true, it must validate
 * under the same shared rules as the planners.
 */
'use strict';

const assert = require('node:assert/strict');
const http = require('node:http');
const { test, describe, before, after } = require('node:test');

const app = require('../index');
const coursesRouter = require('../routes/courses');
const { validatePlan } = require('../utils/planValidator');
const { mkCourse, DEFAULT_CONSTRAINTS, setOf } = require('./helpers');

const FIXTURE = [mkCourse('A'), mkCourse('B', ['A']), mkCourse('C', ['B'])];

let server;
let baseUrl;

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const payload = body === undefined ? null : JSON.stringify(body);
    const req = http.request(
      {
        method,
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        headers: { 'Content-Type': 'application/json' },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          let json = null;
          try {
            json = data ? JSON.parse(data) : null;
          } catch {
            // leave json as null; assertions below will fail loudly
          }
          resolve({ status: res.statusCode, json });
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function assertValidRevisedPlan(revisedPlan, courses, completedIds, constraints = DEFAULT_CONSTRAINTS) {
  assert.strictEqual(revisedPlan.success, true, `revised plan should succeed, got: ${revisedPlan.error}`);
  const { valid, errors } = validatePlan(
    revisedPlan.semesterPlan, courses, setOf(completedIds), constraints
  );
  assert.strictEqual(valid, true, `revised plan invalid: ${errors.join('; ')}`);
}

before(async () => {
  coursesRouter.setCourseStore(FIXTURE.map((c) => ({ ...c })));
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

describe('simulation API', () => {
  test('fail-course reports impact and returns a valid revised plan', async () => {
    const { status, json } = await request('POST', '/api/simulation/fail-course', {
      failedCourseId: 'B',
      completedCourseIds: ['A', 'B'],
      goal: 'balanced',
      constraints: { ...DEFAULT_CONSTRAINTS },
    });
    assert.strictEqual(status, 200);
    assert.strictEqual(json.scenario, 'fail-course');
    assert.strictEqual(json.failedCourse.id, 'B');
    assert.strictEqual(json.impact.blockedCount, 1);
    assert.deepStrictEqual(json.impact.directlyBlocked.map((c) => c.id), ['C']);
    assert.strictEqual(typeof json.executionTimeMs, 'number');
    // Failed course B is back in the plan; A stays completed.
    assertValidRevisedPlan(json.revisedPlan, FIXTURE, ['A']);
    const planned = json.revisedPlan.semesterPlan.flatMap((s) => s.courses.map((c) => c.id));
    assert.ok(planned.includes('B'), 'failed course must be replanned');
    assert.ok(!planned.includes('A'), 'completed course must not be replanned');
  });

  test('fail-course requires failedCourseId', async () => {
    const { status, json } = await request('POST', '/api/simulation/fail-course', {
      completedCourseIds: [],
    });
    assert.strictEqual(status, 400);
    assert.ok(json.error);
  });

  test('fail-course returns 404 for unknown courses', async () => {
    const { status, json } = await request('POST', '/api/simulation/fail-course', {
      failedCourseId: 'GHOST',
      completedCourseIds: [],
    });
    assert.strictEqual(status, 404);
    assert.ok(json.error);
  });

  test('complete-course reports progress and returns a valid revised plan', async () => {
    const { status, json } = await request('POST', '/api/simulation/complete', {
      completedCourseIds: ['A'],
      goal: 'balanced',
      constraints: { ...DEFAULT_CONSTRAINTS },
    });
    assert.strictEqual(status, 200);
    assert.strictEqual(json.scenario, 'complete');
    assert.strictEqual(json.completedCount, 1);
    assert.strictEqual(json.remainingCount, 2);
    assert.strictEqual(json.progressPercent, 33.3);
    assertValidRevisedPlan(json.revisedPlan, FIXTURE, ['A']);
  });

  test('complete-course with everything done celebrates graduation', async () => {
    const { status, json } = await request('POST', '/api/simulation/complete', {
      completedCourseIds: ['A', 'B', 'C'],
      goal: 'balanced',
      constraints: { ...DEFAULT_CONSTRAINTS },
    });
    assert.strictEqual(status, 200);
    assert.strictEqual(json.scenario, 'complete');
    assert.ok(json.message, 'expected a graduation message');
    assert.deepStrictEqual(json.revisedPlan.semesterPlan, []);
  });

  test('what-if with an excluded leaf course returns a valid plan', async () => {
    const { status, json } = await request('POST', '/api/simulation/what-if', {
      scenario: 'skip-elective',
      completedCourseIds: [],
      additionalCompletedIds: ['A'],
      excludeCourseIds: ['C'],
      goal: 'balanced',
      constraints: { ...DEFAULT_CONSTRAINTS },
    });
    assert.strictEqual(status, 200);
    assert.strictEqual(json.scenario, 'skip-elective');
    assert.deepStrictEqual(json.excludedCourses, ['C']);
    const remaining = FIXTURE.filter((c) => c.id !== 'C');
    assertValidRevisedPlan(json.result, remaining, ['A']);
  });

  test('what-if excluding everything fails safely', async () => {
    const { status, json } = await request('POST', '/api/simulation/what-if', {
      completedCourseIds: [],
      excludeCourseIds: ['A', 'B', 'C'],
    });
    assert.strictEqual(status, 400);
    assert.ok(json.error);
  });
});
