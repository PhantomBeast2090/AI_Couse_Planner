/**
 * Scoped-route overflow tests (node:test).
 *
 * Proves the uniform cap post-check: a scope genuinely needing >8 semesters
 * yields a structured PARTIAL (first 8 semesters + explicit unplanned list)
 * on /run — never Semester 9+.
 */
'use strict';

const assert = require('node:assert/strict');
const http = require('node:http');
const { test, describe, before, after } = require('node:test');

const app = require('../index');
const coursesRouter = require('../routes/courses');
const { mkCourse, DEFAULT_CONSTRAINTS, setOf } = require('./helpers');
const { validateTimeline } = require('../utils/planValidator');

let server;
let baseUrl;

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const payload = body === undefined ? null : JSON.stringify(body);
    const req = http.request(
      { method, hostname: url.hostname, port: url.port, path: url.pathname + url.search, headers: { 'Content-Type': 'application/json' } },
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

before(async () => {
  const chain = [];
  for (let i = 0; i < 10; i++) chain.push(mkCourse(`K${i}`, i === 0 ? [] : [`K${i - 1}`]));
  coursesRouter.setCourseStore(chain);
  await new Promise((resolve) => { server = app.listen(0, '127.0.0.1', resolve); });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

describe('scoped overflow on /run', () => {
  test('10-chain via BFS returns PARTIAL with 8 semesters and explicit unplanned', async () => {
    const { status, json } = await request('POST', '/api/planning/run', {
      algorithm: 'bfs',
      goal: 'fastest',
      constraints: { ...DEFAULT_CONSTRAINTS },
      completedCourseIds: [],
      selection: { targetCourseId: 'K9' },
    });
    assert.strictEqual(status, 200);
    assert.strictEqual(json.success, false);
    assert.strictEqual(json.reason, 'PLAN_EXCEEDS_8_SEMESTERS');
    assert.strictEqual(json.semesterPlan.length, 8);
    assert.ok(json.semesterPlan.every((s) => s.semester <= 8), 'no Semester 9+');
    assert.deepStrictEqual(json.unplannedCourses.map((u) => u.id), ['K8', 'K9']);
    assert.strictEqual(json.scope.size, 10);
    const fullChain = [];
    for (let i = 0; i < 10; i++) fullChain.push(mkCourse(`K${i}`, i === 0 ? [] : [`K${i - 1}`]));
    const { valid, errors } = validateTimeline(json.semesterPlan, {
      courses: fullChain, completedInput: setOf([]), constraints: DEFAULT_CONSTRAINTS,
      programCourseIds: fullChain.map((c) => c.id),
      requiredIds: fullChain.map((c) => c.id),
      unplannedIds: json.unplannedCourses.map((u) => u.id),
    });
    assert.strictEqual(valid, true, `partial prefix must validate: ${errors.join('; ')}`);
  });

  test('unknown target course is rejected without fallback', async () => {
    const { status, json } = await request('POST', '/api/planning/run', {
      algorithm: 'bfs', constraints: {}, completedCourseIds: [],
      selection: { targetCourseId: 'NOPE' },
    });
    assert.strictEqual(status, 400);
    assert.strictEqual(json.errorCode, 'UNKNOWN_COURSE');
  });
});
