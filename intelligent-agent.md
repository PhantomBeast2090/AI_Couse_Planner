# Intelligent Agent

## Purpose

The intelligent agent selects and evaluates planning strategies instead of forcing every user objective through the same algorithm.

## Agent Loop

### 1. Perception

The agent analyzes:

- number of courses;
- average prerequisite count;
- average difficulty;
- cycle presence;
- maximum prerequisite-chain depth;
- graph complexity.

### 2. Reasoning

The requested objective determines candidate strategies:

```text
fastest        -> BFS + A*
easiest        -> UCS + A*
balanced       -> A* + BFS
specialization -> A* + BFS + UCS
```

### 3. Action

Each candidate algorithm is executed against the same course environment, constraints, and completed-course set.

### 4. Utility Evaluation

Candidate plans are scored according to the selected objective:

- fastest: fewer semesters;
- easiest: lower aggregate difficulty;
- balanced: lower workload and credit variance;
- specialization: earlier placement of tagged courses.

### 5. Decision

The highest-scoring candidate becomes the selected plan.

### 6. Explanation / Recommendations

The agent records perception, reasoning, candidate strategies, action results, utility scores, and the selected strategy. It also generates workload warnings and planning tips.

## Technical Qualification

The precise description is **goal-based intelligent planning agent**. The current strategy-selection layer is deterministic and rule-based; it does not learn a policy from historical student behavior.

## Limitations

The agent's decisions depend on explicitly coded objectives, utility functions, course metadata, and constraints.
