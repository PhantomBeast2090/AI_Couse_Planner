# Benchmark

Reproducible comparison of BFS, DFS, UCS, A* and CSP on identical problem instances.

## Run

```bash
cd server
npm run benchmark
```

## What it does

`scripts/benchmark.js` runs every algorithm over the same four fixtures
(`chain-6`, `branching-7`, `mixed-12`, `sample-15` — the last is the first 15
courses of the real sample dataset, which form a closed prerequisite DAG)
with identical constraints (`maxCredits: 15`, `maxHardCourses: 2`,
`maxCoursesPerSemester: 4`) and completed sets.

Each algorithm runs 3 times; the table prints the median wall time. Plans,
semester counts, node counts, cost and step counts are deterministic. Wall
time is machine-specific — always re-run locally instead of quoting
someone else's numbers.

## Metrics

Only measured values are reported: success, plan validity (checked with the
shared `planValidator`), semesters, nodes explored, median wall time, total
cost, planning steps. Machine output goes to `benchmark/results.json`
(gitignored build artifact).
