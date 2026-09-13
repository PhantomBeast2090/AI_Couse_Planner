# Evaluation Methodology

## Objective

Establish whether the system produces valid plans and characterize how different planning strategies behave under the same problem instances.

## How to Run

```bash
cd server
npm test          # correctness suite (must pass)
npm run benchmark # reproducible comparison, prints a markdown table
```

`npm run benchmark` runs `scripts/benchmark.js` (method documented in `server/benchmark/README.md`). Machine output is written to `server/benchmark/results.json` (gitignored artifact — regenerate, don't quote stale files).

## Benchmark Design

- **Same input for all:** each fixture (fixed courses, constraints, completed set) goes through BFS, DFS, UCS, A* and CSP unchanged.
- **Fixtures:** `chain-6` (strict chain), `branching-7` (branching + hard courses), `mixed-12` (multi-chain with a pre-completed course), `sample-15` (first 15 real dataset courses — verified to form a closed DAG).
- **Constraints (fixed):** `maxCredits: 15`, `maxHardCourses: 2`, `maxCoursesPerSemester: 4`, `maxSemesters: 10`.
- **Repetitions:** 3 runs per cell; the table shows the median wall time. Plans, semester counts, node counts, cost and steps are deterministic (no RNG in the planning path); wall time is machine-specific and must be re-measured locally.

## Evaluation Dimensions

### Correctness

Checked by the shared `server/utils/planValidator.js` (same rules as the tests):

- prerequisite ordering (strictly earlier semester);
- no course scheduled before its prerequisites;
- credit / hard-course / count limits per semester;
- completed courses excluded, no duplicates, no unknown ids.

### Search Efficiency

- execution time (median of 3, indicative only);
- nodes/states explored;
- number of search steps.

### Plan Quality

- number of semesters;
- total planning cost (cumulative difficulty where reported);
- average difficulty per semester;
- credit variance;
- number of heavy semesters (agent `workloadAnalysis` labels: Light < 2, Moderate < 3.5, else Heavy).

### Agent Decision Quality

For each goal (`fastest`, `easiest`, `balanced`, `specialization`), record goal → candidate algorithms → candidate scores → selected algorithm → selected plan. The agent tests assert the winner always holds the max utility score and the selected plan validates.

## Benchmark Table

Measured 2026-09-13 with `npm run benchmark` (Node 20, macOS). Semester/node/cost/step columns are deterministic for these fixtures; the Time column varies by machine — re-run locally instead of quoting it.

| Dataset | Algorithm | Success | Valid | Semesters | Nodes | Cost | Steps |
|---|---|---|---|---|---|---|---|
| chain-6 | BFS | true | true | 6 | 6 | 12 | 12 |
| chain-6 | DFS | true | true | 6 | 6 | 12 | 13 |
| chain-6 | UCS | true | true | 6 | 6 | 12 | 18 |
| chain-6 | A* | true | true | 6 | 7 | 12 | 15 |
| chain-6 | CSP | true | true | 6 | 6 | 12 | 14 |
| branching-7 | BFS | true | true | 3 | 7 | 16 | 10 |
| branching-7 | DFS | true | true | 3 | 7 | 16 | 15 |
| branching-7 | UCS | true | true | 3 | 7 | 16 | 21 |
| branching-7 | A* | true | true | 3 | 4 | 16 | 9 |
| branching-7 | CSP | true | true | 5 | 7 | 16 | 16 |
| mixed-12 | BFS | true | true | 5 | 11 | 31 | 16 |
| mixed-12 | DFS | true | true | 5 | 11 | 31 | 23 |
| mixed-12 | UCS | true | true | 5 | 11 | 31 | 33 |
| mixed-12 | A* | true | true | 5 | 6 | 31 | 13 |
| mixed-12 | CSP | true | true | 8 | 11 | 31 | 24 |
| sample-15 | BFS | true | true | 4 | 13 | 36 | 17 |
| sample-15 | DFS | true | true | 5 | 13 | 36 | 28 |
| sample-15 | UCS | true | true | 4 | 13 | 36 | 39 |
| sample-15 | A* | true | true | 4 | 5 | 36 | 11 |
| sample-15 | CSP | true | true | 5 | 13 | 36 | 28 |

Reading: every planner is valid everywhere; A* explores the fewest states on the branching/mixed/sample fixtures; CSP finds valid but longer plans (first-solution backtracking, no semester minimization) — honest behavioral differences, not a ranking.

## Edge Cases

Each maps to automated tests in `server/tests/`:

- empty course dataset → vacuous success, empty plan;
- cyclic prerequisite graph (incl. self-loop) → `success: false` + error;
- missing/unknown prerequisite id → `success: false` + error;
- all courses completed → empty plan;
- infeasible credit limit (a course alone exceeds `maxCredits`) → fails safely, never hangs;
- deep prerequisite chain (6) → exactly 6 semesters on every planner;
- high-difficulty clusters → hard-course cap respected per semester;
- duplicate course rows → tolerated, planned once;
- multiple valid plans → every planner's output validates.

## Portfolio Value

The benchmark converts claims such as "A* is efficient" into measurable project evidence. The goal is to characterize behavior for this planner, not to declare a universally best algorithm.
