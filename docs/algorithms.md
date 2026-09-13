# Algorithms

All planners live in `server/algorithms/` and share one contract:

- **Input:** course list, constraints (`maxCredits`, `maxHardCourses`, `maxCoursesPerSemester`, `maxSemesters` for CSP), completed-course `Set`, and (A*/agent only) a goal.
- **Output:** `{ algorithm, success, error?, unplanned?, semesterPlan, nodesExplored, totalSemesters, steps, ... }`.
- **Rule:** a prerequisite must be completed in a **strictly earlier semester** — never the same one. Every planner is checked against this rule by `server/utils/planValidator.js`, which is also what the test suite uses.

No planner in this project is claimed to be universally optimal. Each one is a different trade-off, and `npm run benchmark` (see `docs/evaluation.md`) measures them on identical instances.

Course object shape (relevant fields):

```js
{ id, name, credits, difficulty: 1-5, prerequisites: [ids], tags: [] }
```

A course with `difficulty >= 4` counts as "hard" for `maxHardCourses`.

---

## BFS — Breadth-First Semester Planner (`bfs.js`)

- **Purpose:** pack each semester with as many currently-available courses as possible, layer by layer.
- **State representation:** `completed` set + `pending` list; the frontier is every pending course whose prerequisites are all completed.
- **Search strategy:** level-by-level expansion. Each iteration computes the frontier, records it in `nodesExplored`/`steps`, then greedily fills one semester (easiest-first within the frontier) respecting credit, hard-course and count limits. Deferred courses are logged with the reason (`credit limit`, `hard course limit`, `course count limit`).
- **Cost function:** none — BFS is cost-blind beyond the greedy easiest-first ordering inside a frontier.
- **Heuristic:** none.
- **Constraints:** all three semester limits, plus completed-course exclusion.
- **Expected behavior:** tends to produce few semesters on wide graphs; a strict chain of *n* yields exactly *n* semesters. Deadlock (empty frontier with pending work) or a no-progress semester ends planning with `success: false`, an error, and the `unplanned` list.
- **Complexity:** each semester scans the pending list — roughly *O(S · V)* for *S* semesters and *V* courses, plus sorting each frontier.
- **Strengths:** simple, predictable, fast; good default for the `fastest` goal.
- **Limitations:** no cost awareness — a hard course is scheduled as readily as an easy one once available; greedy packing is not proven semester-minimal under tight constraints.
- **Why it exists:** baseline layer-by-layer strategy and the agent's candidate for `fastest`/`balanced`.

## DFS — Depth-First Topological Planner (`dfs.js`)

- **Purpose:** baseline traversal that follows prerequisite chains deeply before branching — useful for specialization-style paths.
- **State representation:** `visited` set, post-order `visitOrder` list, then semester bins filled in that order.
- **Search strategy:** recursive DFS over prerequisite edges (prerequisites first, post-order append), giving a topological order; then a single pass packs courses into semesters. A course whose prerequisites are not yet in an earlier semester flushes the current semester first; if still unsatisfied, planning fails safely. Semester courses become "completed" only at semester flush, preserving the strictly-earlier rule.
- **Cost function / heuristic:** none.
- **Constraints:** all three semester limits; cyclic graphs and unknown prerequisite ids are rejected up front with an error.
- **Expected behavior:** valid topological plans; does not minimize semesters or difficulty.
- **Complexity:** *O(V + E)* traversal plus one packing pass.
- **Strengths:** minimal, easy to reason about; deterministic.
- **Limitations:** no optimization of any objective; ordering follows input order among independents.
- **Why it exists:** traversal baseline and a contrast point in comparisons. (A past bug let dependents share a semester with prerequisites; fixed — see tests.)

## Uniform Cost Search (`ucs.js`)

- **Purpose:** cost-aware planning where cost is course difficulty — prefers easy courses first.
- **State representation:** per-semester priority queue (hand-written binary min-heap) over currently-available courses keyed by `difficulty`, plus accumulated `totalCost`.
- **Search strategy:** each semester, enqueue all available courses, dequeue cheapest-first, and schedule each if it fits the limits. Mirrors BFS structurally but orders by cost instead of ease-sorted frontier order.
- **Cost function:** `g = Σ difficulty` of scheduled courses (per-course dequeue cost = that course's difficulty).
- **Heuristic:** none.
- **Constraints:** all three semester limits; deadlock and no-progress semesters fail safely with `success: false`.
- **Expected behavior:** easy courses appear earlier; `totalCost` (cumulative difficulty) is reported.
- **Complexity:** heap operations add a log factor per available course each semester.
- **Strengths:** difficulty-sensitive without extra configuration; the agent's candidate for `easiest`.
- **Limitations:** greedy per-semester selection is not a proven global difficulty minimum; ignores semester-count pressure.
- **Why it exists:** the cost-aware counterpart to BFS and the agent's `easiest` workhorse.

## A* (`astar.js`)

- **Purpose:** goal-directed semester-level search combining accumulated cost with a remaining-work estimate.
- **State representation:** search states are `{ completed, semesterPlan, g, h, f }` where the state key is the sorted completed-id list; a min-heap orders states by `f`.
- **Search strategy:** pop the lowest-`f` state; if all courses are scheduled, that plan wins. Otherwise generate up to three successor semester configurations (greedy packs sorted easiest-first / most-credits-first / balanced) and enqueue them. Capped at `MAX_ITER = 500` expansions, then a greedy fallback completes the plan.
- **Cost function:** `g` = cumulative difficulty scheduled so far.
- **Heuristic:** `h` = longest remaining prerequisite-chain length (`calculateCriticalPath`, cycle-safe). It estimates *semesters* remaining while `g` counts *difficulty* — deliberately documented as a heuristic blend, **not** an admissible optimal A*.
- **Constraints:** all three semester limits; cycles, unknown ids and trivially impossible limits are rejected up front.
- **Expected behavior:** sensible goal-aligned plans; the `goal` argument biases successor generation (`easiest` sorts easy-first, otherwise credits-first). May return partial plans with `success: false` past the iteration cap.
- **Complexity:** bounded by `MAX_ITER` heap expansions; each expansion evaluates chain depths with memoization.
- **Strengths:** the only planner that looks ahead (chain depth) and adapts to the goal.
- **Limitations:** successor sampling is greedy (not exhaustive), `g`/`h` units differ, and the iteration cap means optimality is explicitly **not** claimed.
- **Why it exists:** the agent's primary candidate for every goal and the most instructive search implementation in the repo.

## CSP — Constraint Satisfaction Planner (`csp.js`)

- **Purpose:** treat scheduling as an assignment problem: each course (variable) is assigned a semester (domain `1..maxSemesters`) subject to hard constraints.
- **State representation:** `assignment` map (`courseId → semester | null`) plus per-variable domains.
- **Search strategy:** backtracking with forward checking (dependents pushed later, prerequisites pulled earlier, with domain-wipeout detection), **readiness-gated MRV** variable ordering (most-constrained *ready* course first — a course is eligible only once its prerequisites are assigned — with topological tiebreak) and **LCV** value ordering (least-constraining semester first). Bounded by `MAX_BACKTRACKS = 5000`.
- **Hard constraints:** (1) prerequisites in strictly earlier semesters, (2) `maxCredits`, (3) `maxHardCourses`, (4) `maxCoursesPerSemester`.
- **Expected behavior:** returns a valid assignment when one exists within budget; raw semester numbers are compressed to contiguous `1..k` (order-preserving, so validity is unaffected). Failure returns `success: false` with the reason (cycle, unknown id, or no assignment in budget).
- **Complexity:** worst-case exponential in the number of courses (standard for backtracking); MRV/LCV and propagation prune heavily on realistic chains.
- **Strengths:** the only planner that reasons about constraints declaratively; naturally expresses "find any valid schedule".
- **Limitations:** no optimization objective (first valid assignment wins, not the fewest semesters); needs the backtrack budget on large graphs.
- **Why it exists:** the constraint-reasoning counterpart to the search planners, and the strictest validity check in comparisons.

## Intelligent Agent (`agent.js`)

Documented separately in `docs/intelligent-agent.md`. In short: a deterministic, rule-based **goal-based planning agent** that perceives the graph, maps the goal to candidate strategies, runs them, scores plans with `scorePlan`, and returns the argmax plus workload analysis and recommendations. It uses no LLM or learned policy.

## Planned Evaluation

Run `npm run benchmark` (method in `docs/evaluation.md`). It reports, per dataset × algorithm: success, validity (shared validator), semesters, nodes explored, median wall time, total cost, steps. Do not declare any algorithm universally best — characterize behavior on these instances only.
