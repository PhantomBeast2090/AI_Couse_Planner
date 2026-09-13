# Algorithms

## BFS

Breadth-first search is useful when the search objective is closely related to minimizing depth, such as finding a plan that reaches completion in fewer semester transitions.

## DFS

Depth-first search explores one planning path deeply before backtracking. It is useful as a baseline traversal strategy but does not inherently optimize shortest or lowest-cost plans.

## Uniform Cost Search

UCS expands the lowest accumulated-cost state first. In this project, cost can represent planning burden such as course difficulty or other configured cost signals.

## A*

A* combines accumulated cost with a heuristic estimate:

```text
f(n) = g(n) + h(n)
```

The implementation also receives the planning goal so search behavior can be aligned with the requested objective.

## CSP

Constraint Satisfaction Planning treats scheduling as an assignment problem subject to rules such as prerequisites and semester limits.

## Intelligent Agent

The intelligent agent is a meta-level decision layer. It evaluates candidate strategies and selects among them:

```text
perceive -> reason -> act -> evaluate -> decide
```

This makes the agent a goal-based decision system built on top of classical planning algorithms.

## Planned Evaluation

All algorithms should eventually be evaluated on identical datasets and constraints using:

- number of semesters;
- nodes/states explored;
- execution time;
- total planning cost;
- plan validity;
- number of search steps.

Do not claim one algorithm is universally best without benchmark evidence.
