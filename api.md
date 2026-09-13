# API Reference

## POST `/api/planning/run`

Runs one planning algorithm.

```json
{
  "algorithm": "astar",
  "goal": "balanced",
  "constraints": {},
  "completedCourseIds": []
}
```

Supported algorithms include `bfs`, `dfs`, `ucs`, `astar`, and `csp`.

## POST `/api/planning/compare`

Runs two algorithms over the same planning input.

```json
{
  "algorithmA": "bfs",
  "algorithmB": "astar",
  "goal": "fastest",
  "constraints": {},
  "completedCourseIds": []
}
```

Comparison metrics include semesters, nodes explored, execution time, total cost, and planning steps.

## POST `/api/planning/agent`

Runs the intelligent agent.

```json
{
  "goal": "balanced",
  "constraints": {},
  "completedCourseIds": [],
  "specializationTags": ["AI", "ML"]
}
```

The response includes the chosen strategy, evaluated strategies, semester plan, workload analysis, recommendations, agent log, and execution time.

## GET `/api/planning/graph`

Returns graph nodes, prerequisite edges, course metadata, and graph statistics for visualization.
