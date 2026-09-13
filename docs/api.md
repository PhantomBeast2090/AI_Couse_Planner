# API Reference

Base URL (local): `http://localhost:5050/api`. All bodies and responses are JSON. Examples below are abbreviated to the fields that matter.

## Planning scope (applies to every planning/graph/simulation route)

The selected program/course defines the planning scope. Planning, graph visualization, algorithm comparison, timeline generation, workload analysis, and scenario planning operate only within that scope.

Every planning request carries an explicit selection — either
`{ "selection": { "programId": "..." } }` or `{ "selection": { "targetCourseId": "..." } }`
(top-level `programId` / `targetCourseId` are accepted as shorthand). The backend resolves the
authoritative scope server-side via `resolvePlanningScope` and never falls back to the full
catalog: missing/invalid selection → `400` with `errorCode` (`SELECTION_REQUIRED`,
`UNKNOWN_PROGRAM`, `UNKNOWN_COURSE`, `MISSING_DEPENDENCIES`, `CYCLIC_SCOPE`).

Successful planning responses include `scope` metadata
(`kind`, `programId`/`targetCourseId`, `selectedName`, `size`, `completed`, `remaining`,
`edgeCount`, `criticalDepth`) plus `validation` from the shared validator. Plans that exceed
8 semesters are returned as structured partials (`success: false`,
`reason: "PLAN_EXCEEDS_8_SEMESTERS"`, first ≤8 semesters kept, overflow listed in
`unplannedCourses`) — never a Semester 9+.

## Planning

### POST `/api/planning/run`

Run one planning algorithm **on the resolved scope**. `algorithm` is case-insensitive (`bfs`, `dfs`, `ucs`, `astar`/`a*`, `csp`); unknown names return `400`.

Request:

```json
{
  "algorithm": "astar",
  "goal": "balanced",
  "constraints": { "maxCredits": 15, "maxHardCourses": 2, "maxCoursesPerSemester": 4 },
  "completedCourseIds": ["cs101"],
  "selection": { "programId": "bsc-cs" }
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
  "coursesAnalyzed": 24,
  "completedCount": 1,
  "scope": { "kind": "program", "programId": "bsc-cs", "size": 24 },
  "validation": { "valid": true, "errors": [] }
}
```

On unsatisfiable input the planner returns `success: false` with `error` and `unplanned` (HTTP stays `200`; `400` is reserved for malformed requests and empty stores).

### POST `/api/planning/compare`

Run two algorithms over the **same resolved scope** (one scope object feeds both candidates, so scope equality is structural) and get a metric summary.

Request:

```json
{
  "algorithmA": "bfs",
  "algorithmB": "astar",
  "goal": "fastest",
  "constraints": {},
  "completedCourseIds": [],
  "selection": { "targetCourseId": "ml401" }
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

Run the goal-based intelligent planning agent **on the resolved scope** (see `docs/intelligent-agent.md`). Every candidate strategy plans the same scoped course set.

Request:

```json
{
  "goal": "balanced",
  "constraints": {},
  "completedCourseIds": ["cs101"],
  "specializationTags": ["AI", "ML"],
  "selection": { "programId": "ai-ml" }
}
```

Response includes `chosenStrategy`, `allStrategiesEvaluated` (`strategy`, `semesters`, `score`, `elapsed`), `semesterPlan`, `workloadAnalysis` (per-semester `avgDifficulty`, `totalCredits`, `hardCount`, `workloadLabel`), `recommendations`, `agentLog` (`PERCEPTION`/`REASONING`/`ACTION`/`DECISION` entries), and `executionTimeMs`. On impossible input: `success: false` plus `error`.

### GET `/api/planning/graph`

Graph data for the d3 visualization. Optional `?programId=` / `?targetCourseId=` returns the scoped subgraph used by planning views (plus `scope` metadata); without params it returns the full catalog overview for dataset browsing only.

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

## Simulation (what-if scenarios, all scope-aware)

Every simulation request carries `selection` and operates only on the resolved scope; fail/exclude ids outside the scope are rejected with `400`.

| Route | Body | Returns |
|---|---|---|
| POST `/api/simulation/fail-course` | `failedCourseId` (required, must be in scope), `completedCourseIds`, `goal`, `constraints`, `selection` | Failed-course info, in-scope blocked courses, delay estimate, and a scoped revised plan. |
| POST `/api/simulation/complete` | `completedCourseIds`, `goal`, `constraints`, `selection` | Scope-relative progress, remaining count, and a scoped revised plan (or graduation message when nothing remains). |
| POST `/api/simulation/what-if` | `scenario`, `completedCourseIds`, `additionalCompletedIds`, `excludeCourseIds` (must be in scope), `goal`, `constraints`, `selection` | Scoped agent result under hypothetical completions/exclusions. |

## Health

`GET /api/health` → `{ status: 'ok', app: 'PathAI', version, coursesLoaded, timestamp }`.

## Degree Programs

Programs are explicit required-course lists (`server/data/programs.js`) — the catalog has no degree field, so tag overlap cannot define a degree.

### GET `/api/programs`

Lists the catalog: `id`, `name`, `description`, `requiredCourses`, `maxSemesters` (8), `maxCoursesPerSemester` (8).

### POST `/api/planning/degree`

Program-scoped timeline. Hard caps: 8 semesters, 8 courses/semester (user `maxCoursesPerSemester` is clamped, never raised). Never emits Semester 9+.

Request:

```json
{
  "programId": "bsc-cs",
  "goal": "balanced",
  "constraints": { "maxCredits": 21, "maxHardCourses": 3, "maxCoursesPerSemester": 8 },
  "completedCourseIds": ["cs101"],
  "specializationTags": []
}
```

Success response: `{ success: true, programId, programName, semesterPlan (≤8), totalSemesters, unplannedCourses: [], autoIncludedPrerequisites, validation, workloadAnalysis, executionTimeMs }`.

Overflow response (`success: false`, HTTP 200): `{ reason: "PLAN_EXCEEDS_8_SEMESTERS", semesterPlan (≤8 partial), unplannedCourses: [{ id, name, reason }], message }`.

Missing `programId` → `400` with the valid id list.
