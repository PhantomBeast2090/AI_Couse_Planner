# Testing

## Setup

Lightweight by design: Node's built-in `node:test` runner plus `node:assert/strict`. No test framework dependency was added.

```bash
cd server
npm test          # runs node --test tests/
```

## Layout

| File | Covers |
|---|---|
| `tests/helpers.js` | `mkCourse` fixture builder, default constraints, `plannedIds`, and the two shared assertions below. |
| `tests/algorithms.test.js` | All five planners on identical fixtures: chains, branching, multi-chain, deep chain (expects exactly 6 semesters), no-prereq packing, completed/partial chains, credit + hard-course caps, empty set, unknown ids, impossible credits, cycles, self-loops, duplicates, all-completed, plus cross-planner agreement tests. |
| `tests/agent.test.js` | Perception (incl. empty/cycle), each `scorePlan` goal preference, strategy-map selection per goal + unknown-goal fallback, argmax decision, plan validity, `agentLog` phases, workload/recommendation shape, failure handling, determinism (same input twice → same choice + plan). |
| `tests/api.test.js` | Real Express app on an ephemeral port: `POST /run` (shape + `400` on unknown algorithm), `POST /compare` (both sides + winner), `POST /agent` (strategy + log + workload), `GET /graph` (nodes/edges/stats), `GET /health`. |
| `tests/simulation.test.js` | Same harness for `POST /simulation/fail-course` (impact + valid revised plan, `400`/`404` paths), `/complete` (progress + valid plan, graduation case), `/what-if` (exclusion replanning + valid plan, empty-after-exclusion `400`). |
| `tests/degree.test.js` | 8-semester regression suite: all catalog programs fit, parallel packing, completed exclusion, 10-chain safe failure (no Semester 9+), program differentiation, failed-course replanning, invalid programs, tight-constraint overflow, plus `GET /programs` and `POST /planning/degree` route tests. |

## Shared Assertions

- `assertSuccessfulPlan(result, courses, completed, constraints)` — `success: true`, exact course coverage (no more, no fewer, none twice), and `planValidator.validatePlan` passes.
- `assertFailedSafely(result)` — `success: false` with an `error` and either `unplanned` ids or an empty plan. Impossible input must never silently return an invalid plan.
- `assertFailurePrefixValid(...)` — any partial prefix returned alongside a failure must itself validate.

## Adding Tests

1. Build courses with `mkCourse('id', ['prereq'], { credits, difficulty, tags })`.
2. Call the planner directly with `(courses, constraints, new Set([...]))`.
3. Assert via the shared helpers — prefer behavior (validity, ordering, limits) over internals (step text, exact heap order).

## Notes

- `server/index.js` binds a port only when run directly (`require.main === module`), so `api.test.js` can import the app without occupying `:5050`.
- If a planner fix changes behavior, update the implementation first and keep the test strict — never weaken an assertion just to make it pass.
