/**
 * API behavior tests (node:test, dependency-free).
 *
 * Spins up the real Express app on an ephemeral port and exercises the
 * planning routes over HTTP. Uses a tiny deterministic fixture store so
 * results are fast and reproducible.
 */
'use strict';

const assert = require('node:assert/strict');
const http = require('node:http');
const { test, describe, before, after } = require('node:test');

const app = require('../index');
const coursesRouter = require('../routes/courses');
const { mkCourse, DEFAULT_CONSTRAINTS } = require('./helpers');

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
        path: url.pathname + url.search,
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

before(async () => {
  coursesRouter.setCourseStore([
    mkCourse('A'),
    mkCourse('B', ['A']),
    mkCourse('C', ['B']),
  ]);
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

describe('planning API', () => {
  // Chain fixture A -> B -> C with target C resolves scope {A, B, C}.
  const SELECTION = { targetCourseId: 'C' };

  test('POST /api/planning/run returns a valid BFS plan', async () => {
    const { status, json } = await request('POST', '/api/planning/run', {
      algorithm: 'bfs',
      goal: 'fastest',
      constraints: { ...DEFAULT_CONSTRAINTS },
      completedCourseIds: [],
      selection: SELECTION,
    });
    assert.strictEqual(status, 200);
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.semesterPlan.length, 3);
    assert.strictEqual(typeof json.executionTimeMs, 'number');
    assert.deepStrictEqual(json.scope, {
      kind: 'course', programId: null, targetCourseId: 'C', selectedName: 'C',
      size: 3, completed: 0, remaining: 3, edgeCount: 2, criticalDepth: 3,
    });
    assert.strictEqual(json.validation.valid, true);
  });

  test('POST /api/planning/run requires a selection (no global fallback)', async () => {
    const { status, json } = await request('POST', '/api/planning/run', {
      algorithm: 'bfs',
      constraints: {},
      completedCourseIds: [],
    });
    assert.strictEqual(status, 400);
    assert.strictEqual(json.errorCode, 'SELECTION_REQUIRED');
  });

  test('POST /api/planning/run rejects unknown algorithms', async () => {
    const { status, json } = await request('POST', '/api/planning/run', {
      algorithm: 'nope',
      constraints: {},
      completedCourseIds: [],
      selection: SELECTION,
    });
    assert.strictEqual(status, 400);
    assert.ok(json.error);
  });

  test('POST /api/planning/compare reports both sides and a winner', async () => {
    const { status, json } = await request('POST', '/api/planning/compare', {
      algorithmA: 'bfs',
      algorithmB: 'astar',
      goal: 'fastest',
      constraints: { ...DEFAULT_CONSTRAINTS },
      completedCourseIds: [],
      selection: SELECTION,
    });
    assert.strictEqual(status, 200);
    assert.ok(json.algorithmA && json.algorithmB, 'both results present');
    assert.ok(json.comparison && json.comparison.winner, 'winner summary present');
    assert.ok(json.comparison.winner.fewestSemesters, 'fewest-semesters winner present');
    // Both candidates solved the SAME scope.
    assert.deepStrictEqual(json.algorithmA.scope, json.algorithmB.scope);
    assert.strictEqual(json.algorithmA.scope.size, 3);
  });

  test('POST /api/planning/agent chooses a strategy with a log', async () => {
    const { status, json } = await request('POST', '/api/planning/agent', {
      goal: 'balanced',
      constraints: { ...DEFAULT_CONSTRAINTS },
      completedCourseIds: [],
      specializationTags: [],
      selection: SELECTION,
    });
    assert.strictEqual(status, 200);
    assert.strictEqual(json.success, true);
    assert.ok(json.chosenStrategy, 'agent must choose a strategy');
    assert.ok(Array.isArray(json.agentLog) && json.agentLog.length > 0, 'agentLog present');
    assert.ok(Array.isArray(json.workloadAnalysis), 'workload analysis present');
    assert.strictEqual(json.scope.targetCourseId, 'C');
  });

  test('GET /api/planning/graph returns nodes, edges, stats', async () => {
    const { status, json } = await request('GET', '/api/planning/graph');
    assert.strictEqual(status, 200);
    assert.strictEqual(json.nodes.length, 3);
    assert.strictEqual(json.edges.length, 2);
    assert.strictEqual(json.stats.totalCourses, 3);
    assert.strictEqual(json.stats.totalEdges, 2);
    assert.strictEqual(json.scope, null);
  });

  test('GET /api/planning/graph scopes nodes and edges to the selection', async () => {
    const { status, json } = await request('GET', '/api/planning/graph?targetCourseId=B');
    assert.strictEqual(status, 200);
    assert.deepStrictEqual(json.nodes.map((n) => n.id).sort(), ['A', 'B']);
    assert.deepStrictEqual(json.edges, [{ source: 'A', target: 'B', id: 'A->B' }]);
    assert.strictEqual(json.scope.size, 2);
    assert.strictEqual(json.scope.targetCourseId, 'B');
  });

  test('GET /api/health reports status', async () => {
    const { status, json } = await request('GET', '/api/health');
    assert.strictEqual(status, 200);
    assert.strictEqual(json.status, 'ok');
  });
});
