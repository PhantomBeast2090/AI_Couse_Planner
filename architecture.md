# Architecture

## High-Level Architecture

```text
React Client
    |
    | HTTP/JSON
    v
Express API
    |
    +--> Course Store
    |
    +--> Planning Routes
             |
             +--> BFS
             +--> DFS
             +--> UCS
             +--> A*
             +--> CSP
             +--> Intelligent Agent
                       |
                       +--> perception
                       +--> strategy selection
                       +--> candidate execution
                       +--> utility scoring
                       +--> decision
    |
    v
Planning Result / Graph Data
```

## Course Graph

A course is represented as a graph node. A prerequisite relationship creates a directed edge:

```text
Prerequisite ---> Course
```

This representation supports dependency traversal, topological analysis, cycle detection, and semester sequencing.

## Backend Responsibilities

- `server/algorithms/` — planning implementations.
- `server/routes/` — HTTP interfaces for algorithms, comparisons, agent execution, and graph data.
- `server/data/` — course datasets.
- `server/utils/` — graph and supporting utilities.

## Frontend Responsibilities

The React application provides the user-facing planning workflow and visualization layer. The frontend communicates with the Express backend rather than embedding the planning algorithms directly in UI components.

## Design Rationale

Separating algorithms from routes and presentation allows each strategy to be inspected and tested independently while the common API enables controlled comparisons.
