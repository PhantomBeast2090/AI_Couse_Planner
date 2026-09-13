# Intelligent Agent

## Purpose

The intelligent agent (`server/algorithms/agent.js`) selects and evaluates planning strategies instead of forcing every objective through the same algorithm. It is a deterministic, rule-based **goal-based intelligent planning agent**: it perceives the course graph, reasons about which strategies fit the goal, executes them, scores the candidates with an explicit utility function, and decides by argmax. It uses **no LLM, no generative model, and no learned policy** — the "intelligence" is the explicit perceive → reason → act → score → decide loop, and every stage is recorded in `agentLog`.

## Agent Loop

### 1. Perception — `perceiveEnvironment(courses)`

Analyzes the graph and returns plain metrics:

- `totalCourses`, `avgPrereqs`, `avgDifficulty`;
- `hasCycles` (via `topologicalSort`);
- `maxDepth` (longest prerequisite chain);
- `isComplexGraph` (`avgPrereqs > 2 || maxDepth > 5`).

Empty input yields zeroed metrics (never `NaN`); cyclic input stops the agent immediately with an error. Perception currently informs logging and recommendations; candidate selection is driven by the goal map below.

### 2. Reasoning — goal → candidate strategies

```text
fastest        -> BFS + A*
easiest        -> UCS + A*
balanced       -> A* + BFS
specialization -> A* + BFS + UCS
```

Unknown goals fall back to `['astar', 'bfs']`. The mapping is a fixed table (`strategyMap`), chosen for transparency over cleverness.

### 3. Action — run every candidate on the resolved scope

Each candidate planner runs against the **same scoped courses**, constraints and completed set, timed with `Date.now()`. Candidates are the real planners (`bfsPlanner`, `ucsPlanner`, `astarPlanner`), not simulations. The agent never sees the full catalog — routes hand it the resolved scope only.

### 4. Utility Evaluation — `scorePlan(plan, goal, tags)`

Higher is better; an empty plan scores `-Infinity` so failed candidates can never win:

- **fastest:** `100 − 10·semesters + 2·avgCredits` — fewer semesters and fuller loads win.
- **easiest:** `200 − totalDifficulty + later-semester bonus` — lower aggregate difficulty wins; hard load placed later is penalized less.
- **balanced:** `100 − 20·difficultyVariance − 2·creditVariance` — even semesters win.
- **specialization:** `Σ (semestersRemaining)·5` per tagged course — earlier tagged courses win.
- **default:** `100 − 5·semesters − 10·variance`.

### 5. Decision — argmax

Candidates are sorted by score descending; the top one becomes `chosenStrategy` and its plan the output. If **all** candidates fail, the agent returns `success: false` with the underlying error instead of an empty "plan". Ties resolve deterministically (stable sort keeps strategy-map order).

### 6. Explanation / Recommendations

The response carries:

- `agentLog` — `PERCEPTION` (graph metrics), `REASONING` (goal + strategies), one `ACTION` entry per candidate (semesters, utility, elapsed ms), `DECISION` (winner + score);
- `workloadAnalysis` — per-semester `avgDifficulty`, `totalCredits`, `hardCount`, and a `Light / Moderate / Heavy` label (thresholds 2.0 / 3.5);
- `recommendations` — heavy-semester warnings, light-semester tips, long-plan advice for `fastest`, high-difficulty warnings.

## Deterministic vs Decision Layer

| Deterministic algorithms | Agent decision layer |
|---|---|
| BFS / UCS / A* / CSP search, `scorePlan` arithmetic, stable argmax | Goal → strategy-map lookup, candidate selection, recommendation text |

The only randomness in the product is the frontend's "default setup" completed-course picker (`AppContext.jsx`); the agent and all planners are RNG-free, and the test suite asserts identical choice + plan across repeated runs.

## Limitations

Decisions are only as good as the coded utility functions, course metadata (credits/difficulty/tags are estimates), constraints, and the fixed strategy map. The agent does not learn from outcomes and does not validate institutional graduation rules.
