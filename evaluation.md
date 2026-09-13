# Evaluation Methodology

## Objective

Establish whether the system produces valid plans and characterize how different planning strategies behave under the same problem instances.

## Evaluation Dimensions

### Correctness

A plan should:

- respect prerequisite ordering;
- avoid assigning a course before its prerequisites;
- respect configured credit limits;
- respect hard scheduling constraints;
- account for completed courses.

### Search Efficiency

Record:

- execution time;
- nodes/states explored;
- number of search steps.

### Plan Quality

Record:

- number of semesters;
- total planning cost;
- average difficulty per semester;
- credit variance;
- number of heavy semesters.

### Agent Decision Quality

For each objective, record:

```text
goal
candidate algorithms
candidate scores
selected algorithm
selected plan
```

## Controlled Comparison

For controlled comparisons:

1. Use the same course dataset.
2. Use the same completed-course set.
3. Use the same constraints.
4. Use the same goal where applicable.
5. Record execution metrics for every run.
6. Repeat across multiple graph sizes where possible.

## Benchmark Table

| Dataset | Algorithm | Semesters | Nodes | Time (ms) | Cost | Valid |
|---|---|---:|---:|---:|---:|---|
| small | BFS | — | — | — | — | — |
| small | UCS | — | — | — | — | — |
| small | A* | — | — | — | — | — |
| medium | BFS | — | — | — | — | — |
| medium | UCS | — | — | — | — | — |
| medium | A* | — | — | — | — | — |

Numbers must come from actual runs; do not populate the table with invented results.

## Edge Cases

Test:

- empty course dataset;
- cyclic prerequisite graph;
- missing prerequisite;
- all courses completed;
- infeasible credit limit;
- deep prerequisite chain;
- high-difficulty course clusters;
- multiple equally valid plans.

## Portfolio Value

The benchmark converts claims such as “A* is efficient” into measurable project evidence. The goal is to characterize behavior for this planner, not to declare a universally best algorithm.
