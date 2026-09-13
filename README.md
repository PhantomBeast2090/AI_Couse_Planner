# AI Course Planner

> A goal-based intelligent academic planning system that models university courses as a prerequisite graph and generates semester plans under user-defined objectives and constraints.

## Overview

AI Course Planner combines classical graph-search and constraint-planning techniques with a goal-based intelligent agent. Instead of treating course planning as a simple list-sorting problem, the system represents prerequisites as a directed graph, evaluates multiple planning strategies, scores candidate schedules, and selects a plan aligned with the student's objective.

### What the system does

- Models courses and prerequisites as a directed graph.
- Generates academic plans using **BFS, DFS, Uniform Cost Search (UCS), A\***, and **Constraint Satisfaction Planning (CSP)**.
- Supports planning goals including **fastest**, **easiest**, **balanced**, and **specialization-oriented** schedules.
- Compares candidate algorithms using plan quality and execution metrics.
- Uses a goal-based intelligent agent with explicit **perception → reasoning → action → decision** stages.
- Produces semester-level workload analysis and planning recommendations.
- Exposes planning functionality through a Node.js/Express API.
- Provides a React frontend and graph-oriented visualization layer.

## System Architecture

```text
                         User Inputs
              goal / constraints / completed courses
                               |
                               v
                    +-----------------------+
                    |     Course Graph      |
                    | courses + prerequisites|
                    +-----------+-----------+
                                |
                                v
                    +-----------------------+
                    |  Intelligent Agent    |
                    |-----------------------|
                    | Perception            |
                    | Reasoning             |
                    | Strategy evaluation   |
                    | Utility scoring       |
                    | Decision              |
                    +-----------+-----------+
                                |
             +------------------+------------------+
             |          |          |        |      |
             v          v          v        v      v
            BFS        DFS        UCS      A*     CSP
             |          |          |        |      |
             +----------+----------+--------+------+
                                |
                                v
                    Best valid semester plan
                                |
              +-----------------+------------------+
              |                 |                  |
              v                 v                  v
        Workload analysis   Recommendations   Execution metrics
```

## Algorithms

| Algorithm | Role |
|---|---|
| **BFS** | Breadth-first exploration when minimizing semester depth is important. |
| **DFS** | Depth-first exploration of prerequisite planning paths. |
| **UCS** | Cost-aware planning for difficulty/cost-sensitive objectives. |
| **A\*** | Goal-aware search using a heuristic. |
| **CSP** | Constraint-satisfaction planning under explicit constraints. |
| **Intelligent Agent** | Evaluates candidate strategies and chooses the highest-utility plan. |

## Intelligent Agent

The agent follows a transparent decision pipeline:

1. **Perception** — analyzes graph structure, prerequisites, difficulty, and dependency depth.
2. **Reasoning** — maps the user's objective to candidate planning strategies.
3. **Action** — executes the selected search algorithms.
4. **Utility evaluation** — scores candidate semester plans according to the active objective.
5. **Decision** — returns the highest-scoring plan.
6. **Recommendation** — identifies heavy/light semesters and other planning considerations.

The implementation records these stages in an `agentLog`, making the decision process inspectable rather than opaque.

## Goals and Utility Model

- **Fastest** — favors fewer semesters and higher usable credit loads.
- **Easiest** — favors lower cumulative difficulty and defers difficult courses where appropriate.
- **Balanced** — favors consistent workload and credit distribution.
- **Specialization** — rewards earlier placement of courses matching selected specialization tags.

## Repository Structure

```text
AI_Couse_Planner/
├── client/                 # React + Vite frontend
├── server/
│   ├── algorithms/         # BFS, DFS, UCS, A*, CSP, intelligent agent
│   ├── data/               # Course datasets
│   ├── routes/              # Courses, planning, simulation APIs
│   └── utils/               # Graph and supporting utilities
├── docs/                    # Technical documentation
└── README.md
```

## API Surface

- `POST /api/planning/run` — run a selected algorithm.
- `POST /api/planning/compare` — compare two algorithms.
- `POST /api/planning/agent` — run the intelligent planning agent.
- `GET /api/planning/graph` — retrieve graph nodes, prerequisite edges, and statistics.

## Evaluation

The project should be evaluated as an algorithmic planning system, not only as a UI application:

- prerequisite validity;
- algorithm comparison;
- nodes explored and execution time;
- plan length and cost;
- agent strategy-selection behavior;
- edge cases such as cycles and infeasible constraints.

See [`docs/evaluation.md`](docs/evaluation.md).

## Limitations

This is an academic planning prototype. It does not replace official university advising or automatically validate institutional graduation rules. Output quality depends on the supplied course data, prerequisite graph, difficulty estimates, credit constraints, and configuration.

## Documentation

- [Architecture](docs/architecture.md)
- [Algorithms](docs/algorithms.md)
- [Intelligent Agent](docs/intelligent-agent.md)
- [API Reference](docs/api.md)
- [Evaluation Methodology](docs/evaluation.md)

## Phase 1 Status

**Evidence and engineering upgrade in progress.**

The next technical milestone is automated testing and reproducible benchmark results so that algorithmic claims are supported by measurements rather than descriptions alone.
