# API Reference

Base URL (local): `http://localhost:5050/api`. All bodies and responses are JSON. Examples below are abbreviated to the fields that matter.

## Planning

### POST `/api/planning/run`

Run one planning algorithm. `algorithm` is case-insensitive (`bfs`, `dfs`, `ucs`, `astar`/`a*`, `csp`); unknown names return `400`.

Request:

```json
{
  "algorithm": "astar",
  "goal": "balanced",
  "constraints": { "maxCredits": 15, "maxHardCourses": 2, "maxCoursesPerSemester": 4 },
  "completedCourseIds": ["cs101"]
}
```

Response (planner result plus timing/context):

```json
{
  "algorithm": "A*",
  "success": true,
  "unplanned": [],
  "semesterPlan": [{ "semester": 1, "courses": ["..."], "totalCredits": 9, "hardCourseCount": 0 }],
  "nodesExplored": ["..."],
  "totalCost": 6,
  "totalSemesters": 3,
  "steps": [{ "action": "ASTAR_EXPAND", "message": "..." }],
  "executionTimeMs": 4,
  "coursesAnalyzed": 45,
  "completedCount": 1
}
```

On unsatisfiable input the planner returns `success: false` with `error` and `unplanned` (HTTP stays `200`; `400` is reserved for malformed requests and empty stores).

### POST `/api/planning/compare`

Run two algorithms over the **same** input and get a metric summary.

Request:

```json
{
  "algorithmA": "bfs",
  "algorithmB": "astar",
  "goal": "fastest",
  "constraints": {},
  "completedCourseIds": []
}
```

Response:

```json
{
  "algorithmA": { "algorithm": "BFS", "semesterPlan": ["..."], "executionTimeMs": 2 },
  "algorithmB": { "algorithm": "A*", "semesterPlan": ["..."], "executionTimeMs": 5 },
  "comparison": {
    "bfs":   { "semesters": 6, "nodesExplored": 18, "executionTimeMs": 2, "totalCost": 0, "stepsCount": 40 },
    "astar": { "semesters": 6, "nodesExplored": 6,  "executionTimeMs": 5, "totalCost": 36, "stepsCount": 25 },
    "winner": { "fewestSemesters": "bfs", "fewestNodesExplored": "astar", "fastest": "bfs" }
  }
}
```

### POST `/api/planning/agent`

Run the goal-based intelligent planning agent (see `docs/intelligent-agent.md`).

Request:

```json
{
  "goal": "balanced",
  "constraints": {},
  "completedCourseIds": ["cs101"],
  "specializationTags": ["AI", "ML"]
}
```

Response includes `chosenStrategy`, `allStrategiesEvaluated` (`strategy`, `semesters`, `score`, `elapsed`), `semesterPlan`, `workloadAnalysis` (per-semester `avgDifficulty`, `totalCredits`, `hardCount`, `workloadLabel`), `recommendations`, `agentLog` (`PERCEPTION`/`REASONING`/`ACTION`/`DECISION` entries), and `executionTimeMs`. On impossible input: `success: false` plus `error`.

### GET `/api/planning/graph`

Graph data for the d3 visualization.

Response (illustrative values measured from the bundled 82-course dataset):

```json
{
  "nodes": [{ "id": "cs101", "name": "...", "credits": 3, "difficulty": 1, "tags": ["CS"], "prerequisites": [], "radius": 26, "color": "#00ff88", "group": "CS" }],
  "edges": [{ "source": "cs101", "target": "cs201", "id": "cs101->cs201" }],
  "stats": { "totalCourses": 82, "totalEdges": 132, "totalCredits": 246, "avgDifficulty": 3.46, "tagDistribution": {}, "difficultyDistribution": {} }
}
```

## Courses

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/courses` | List the active in-memory store. |
| POST | `/api/courses` | Add a course (`name`, `credits`, `difficulty` required). Rejects unknown prerequisites (`400`) and prerequisite cycles (`400`). |
| PUT | `/api/courses/:id` | Update a course (id is immutable). |
| DELETE | `/api/courses/:id` | Remove a course; refused (`400`) while other courses depend on it. |
| GET | `/api/courses/sample` | Read the bundled sample dataset without loading it. |
| POST | `/api/courses/load-sample` | Load the full sample dataset into the store. |
| POST | `/api/courses/load-default` | Load the curated degree-track subset. |
| POST | `/api/courses/clear` | Empty the store. |

## Simulation (what-if scenarios)

| Route | Body | Returns |
|---|---|---|
| POST `/api/simulation/fail-course` | `failedCourseId` (required), `completedCourseIds`, `goal`, `constraints` | Failed-course info, directly/transitively blocked courses, delay estimate, and a revised agent plan. |
| POST `/api/simulation/complete` | `completedCourseIds`, `goal`, `constraints` | Progress percent, remaining count, and a revised agent plan (or graduation message when nothing remains). |
| POST `/api/simulation/what-if` | `scenario`, `completedCourseIds`, `additionalCompletedIds`, `excludeCourseIds`, `goal`, `constraints` | Agent result under hypothetical completions/exclusions. |

## Health

`GET /api/health` → `{ status: 'ok', app: 'PathAI', version, coursesLoaded, timestamp }`.
