# Technical Evidence

How to verify this project is real, and where each claim is backed.

## Architecture

See `docs/architecture.md` (Mermaid diagram + module map + request flows). Every box corresponds to files in the repo; the frontend (`client/src`) never embeds planning logic.

## Implementation Ownership

Single-contributor project. History is in git (`git log --oneline`); large generated artifacts (`server/node_modules`, logs) were removed from tracking and are covered by the root `.gitignore`. No certificates, contributors, publications, users or testimonials are claimed anywhere.

## Algorithms

Implementations: `server/algorithms/{bfs,dfs,ucs,astar,csp}.js`, documented per-algorithm (strategy, cost, heuristic, complexity, limits) in `docs/algorithms.md`. Optimality is claimed nowhere — A* is explicitly documented as heuristic/approximate.

## Test Methodology

`docs/testing.md` + `server/tests/`. Run `cd server && npm test`. Tests assert prerequisite validity, constraint respect and safe failure through the shared `server/utils/planValidator.js`, not step-text snapshots.

## Reproducible Benchmark

`docs/evaluation.md` + `server/benchmark/README.md`. Run `cd server && npm run benchmark`. Fixtures and constraints are hardcoded; plans/counts are deterministic, wall time is re-measured locally. Raw output: `server/benchmark/results.json` (regenerated artifact, gitignored).

## Demo

```bash
cd server && npm start        # http://localhost:5050/api/health
cd client && npm run dev      # Vite frontend (expects the API above)
```

Useful screenshots (not yet captured — capture against the local demo, never fabricate):

1. Course graph (d3 force view with groups + difficulty rings).
2. Generated semester plan (timeline with workload labels).
3. Algorithm comparison (metric table + winner badges).
4. Intelligent-agent result (strategy scores + chosen plan + decision log).
5. Workload analysis (credit bars + heavy/moderate/light labels).

## Limitations

Academic-planning prototype: no institutional graduation-rule validation, difficulty/credit metadata are estimates, CSP is budget-bounded (`MAX_BACKTRACKS`), A* is iteration-capped with a greedy fallback, and benchmarks characterize this planner only.
