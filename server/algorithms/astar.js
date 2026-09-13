/**
 * A* Search for Course Path Planning
 *
 * Strategy: f(n) = g(n) + h(n)
 *   g(n) = cost so far (cumulative difficulty of completed courses)
 *   h(n) = heuristic (longest remaining prerequisite chain length via
 *           calculateCriticalPath — an estimate of semesters still needed)
 *
 * Note on optimality: g (difficulty points) and h (chain length) use
 * different units, the successor generator only samples a few greedy
 * semester configurations, and search is capped at MAX_ITER with a greedy
 * fallback. This is therefore a heuristic, goal-directed search — it is NOT
 * a proven optimal A* in the strict admissibility sense. Do not describe it
 * as guaranteeing minimum total difficulty.
 *
 * Uses a min-heap priority queue on f(n).
 */

const { calculateCriticalPath, topologicalSort } = require('../utils/graphUtils');
const { checkTriviallyImpossible } = require('../utils/planValidator');

// ---- Min-Heap ----
class MinHeap {
  constructor() { this.heap = []; }
  push(item) { this.heap.push(item); this._bubbleUp(this.heap.length - 1); }
  pop() {
    if (this.heap.length === 1) return this.heap.pop();
    const top = this.heap[0];
    this.heap[0] = this.heap.pop();
    this._sinkDown(0);
    return top;
  }
  get size() { return this.heap.length; }
  _bubbleUp(i) {
    while (i > 0) {
      const p = Math.floor((i - 1) / 2);
      if (this.heap[p].f <= this.heap[i].f) break;
      [this.heap[p], this.heap[i]] = [this.heap[i], this.heap[p]];
      i = p;
    }
  }
  _sinkDown(i) {
    const n = this.heap.length;
    while (true) {
      let s = i;
      const l = 2 * i + 1, r = 2 * i + 2;
      if (l < n && this.heap[l].f < this.heap[s].f) s = l;
      if (r < n && this.heap[r].f < this.heap[s].f) s = r;
      if (s === i) break;
      [this.heap[s], this.heap[i]] = [this.heap[i], this.heap[s]];
      i = s;
    }
  }
}

/**
 * Heuristic: estimated remaining semesters needed.
 * Uses critical path (longest prerequisite chain) of remaining courses.
 * This is a rough estimate, not a proven admissible heuristic (see above).
 */
function heuristic(remaining, courses) {
  if (remaining.length === 0) return 0;
  // Sum difficulty of all remaining courses weighted by chain depth
  const memo = {};
  let maxChain = 0;
  remaining.forEach(courseId => {
    const chainLen = calculateCriticalPath(courseId, courses, memo);
    maxChain = Math.max(maxChain, chainLen);
  });
  return maxChain; // estimate: a chain of length N needs at least N semesters
}

/**
 * A* Search planner
 * @param {Array} courses
 * @param {Object} constraints
 * @param {Set} completedCourses
 * @param {String} goal - 'fastest' | 'easiest' | 'balanced'
 */
function astarPlanner(courses, constraints = {}, completedCourses = new Set(), goal = 'fastest') {
  const {
    maxCredits = 18,
    maxHardCourses = 2,
    maxCoursesPerSemester = 5
  } = constraints;

  const courseMap = {};
  const deduped = [];
  courses.forEach(c => {
    if (!courseMap[c.id]) {
      courseMap[c.id] = c;
      deduped.push(c);
    }
  });
  const allIds = deduped.map(c => c.id);

  const nodesExplored = [];
  const steps = [];

  const remainingForCheck = deduped.filter(c => !(completedCourses instanceof Set ? completedCourses.has(c.id) : false));
  // Fail safely on cyclic graphs (calculateCriticalPath is cycle-safe, but no
  // valid plan exists, so report it instead of returning a partial plan).
  if (remainingForCheck.length > 0 && topologicalSort(remainingForCheck) === null) {
    steps.push({ action: 'ASTAR_DEADLOCK', message: 'Cyclic prerequisites detected - no valid ordering exists' });
    return {
      algorithm: 'A*',
      success: false,
      error: 'Cyclic prerequisites detected',
      unplanned: remainingForCheck.map(c => c.id),
      semesterPlan: [],
      nodesExplored: [],
      totalCost: 0,
      totalSemesters: 0,
      totalCourses: courses.length - completedCourses.size,
      steps
    };
  }
  // Fail safely on unknown prerequisite ids.
  const knownIds = new Set(allIds);
  const completedSet = completedCourses instanceof Set ? completedCourses : new Set();
  const unknownPrereqs = [...new Set(
    remainingForCheck.flatMap(c => c.prerequisites || []).filter(p => !knownIds.has(p) && !completedSet.has(p))
  )];
  if (unknownPrereqs.length > 0) {
    steps.push({ action: 'ASTAR_DEADLOCK', message: `Unknown prerequisite id(s): ${unknownPrereqs.join(', ')}` });
    return {
      algorithm: 'A*',
      success: false,
      error: `Unknown prerequisite id(s): ${unknownPrereqs.join(', ')}`,
      unplanned: remainingForCheck.map(c => c.id),
      semesterPlan: [],
      nodesExplored: [],
      totalCost: 0,
      totalSemesters: 0,
      totalCourses: courses.length - completedCourses.size,
      steps
    };
  }
  // Fail fast when a single remaining course alone violates the limits.
  const impossible = checkTriviallyImpossible(deduped, completedCourses, constraints);
  if (impossible) {
    steps.push({ action: 'ASTAR_DEADLOCK', message: impossible });
    return {
      algorithm: 'A*',
      success: false,
      error: impossible,
      unplanned: remainingForCheck.map(c => c.id),
      semesterPlan: [],
      nodesExplored: [],
      totalCost: 0,
      totalSemesters: 0,
      totalCourses: courses.length - completedCourses.size,
      steps
    };
  }

  // State: { completed: Set, semesterPlan: [], g: number }
  // We use A* at the semester-planning level
  // State key = sorted completed course IDs
  const stateKey = (completedSet) => [...completedSet].sort().join(',');

  const initialCompleted = new Set(completedCourses);
  const initialG = 0;
  const initialH = heuristic(
    allIds.filter(id => !initialCompleted.has(id)),
    deduped
  );

  const initState = {
    completed: initialCompleted,
    semesterPlan: [],
    g: initialG,
    h: initialH,
    f: initialG + initialH
  };

  const pq = new MinHeap();
  pq.push(initState);

  const visited = new Map();
  visited.set(stateKey(initialCompleted), 0);

  let bestResult = null;

  steps.push({
    action: 'ASTAR_INIT',
    initialH,
    message: `A* initialized. Heuristic(start) = ${initialH}`
  });

  // For performance, limit expansion iterations
  let iterations = 0;
  const MAX_ITER = 500;

  while (pq.size > 0 && iterations < MAX_ITER) {
    iterations++;
    const state = pq.pop();
    const { completed, semesterPlan, g } = state;

    nodesExplored.push(stateKey(completed).split(',').slice(-3).join(',') + '...');

    steps.push({
      action: 'ASTAR_EXPAND',
      completedCount: completed.size,
      g,
      h: state.h,
      f: state.f,
      message: `A* expand state: ${completed.size} courses done, g=${g}, h=${state.h}, f=${state.f}`
    });

    // Goal check: all courses scheduled
    const remaining = deduped.filter(c => !completed.has(c.id));
    if (remaining.length === 0) {
      bestResult = { semesterPlan, g };
      steps.push({
        action: 'ASTAR_GOAL',
        totalSemesters: semesterPlan.length,
        totalCost: g,
        message: `A* GOAL REACHED! ${semesterPlan.length} semesters, total cost = ${g}`
      });
      break;
    }

    // Generate next semester (successor state)
    const available = remaining.filter(c => {
      const course = courseMap[c.id];
      return course && course.prerequisites.every(p => completed.has(p));
    });

    if (available.length === 0) continue;

    // Generate multiple possible semester configurations (greedy sampling)
    // Sort by different strategies to explore variations
    const configs = generateSemesterConfigs(available, constraints, goal);

    configs.forEach(semesterCourses => {
      if (semesterCourses.length === 0) return;

      const newCompleted = new Set(completed);
      semesterCourses.forEach(c => newCompleted.add(c.id));

      const key = stateKey(newCompleted);
      const semesterCost = semesterCourses.reduce((s, c) => s + c.difficulty, 0);
      const newG = g + semesterCost;

      if (visited.has(key) && visited.get(key) <= newG) return;
      visited.set(key, newG);

      const newRemaining = deduped.filter(c => !newCompleted.has(c.id));
      const newH = heuristic(newRemaining.map(c => c.id), deduped);
      const newF = newG + newH;

      const newPlan = [
        ...semesterPlan,
        {
          semester: semesterPlan.length + 1,
          courses: semesterCourses,
          totalCredits: semesterCourses.reduce((s, c) => s + c.credits, 0),
          hardCourseCount: semesterCourses.filter(c => c.difficulty >= 4).length,
          cost: semesterCost
        }
      ];

      steps.push({
        action: 'ASTAR_ENQUEUE',
        semesterCourses: semesterCourses.map(c => c.id),
        newG,
        newH,
        newF,
        message: `A* enqueue state with ${semesterCourses.map(c => c.name).join(', ')} | f=${newF}`
      });

      pq.push({
        completed: newCompleted,
        semesterPlan: newPlan,
        g: newG,
        h: newH,
        f: newF
      });
    });
  }

  // Fallback: if A* didn't complete (too many states), use greedy result
  if (!bestResult) {
    steps.push({
      action: 'ASTAR_FALLBACK',
      message: 'A* hit iteration limit, using greedy partial result'
    });
    // Greedy fallback over the deduplicated course list.
    bestResult = greedyFallback(deduped, constraints, completedCourses, goal, courseMap);
  }

  const plannedIds = new Set(bestResult.semesterPlan.flatMap(s => s.courses.map(c => c.id)));
  const unplanned = deduped
    .filter(c => !initialCompleted.has(c.id) && !plannedIds.has(c.id))
    .map(c => c.id);
  const success = unplanned.length === 0;

  return {
    algorithm: 'A*',
    success,
    ...(success ? {} : { error: `Could not schedule ${unplanned.length} course(s): prerequisite deadlock, iteration limit, or unsatisfiable constraints` }),
    unplanned,
    semesterPlan: bestResult.semesterPlan,
    nodesExplored,
    totalCost: bestResult.g,
    totalSemesters: bestResult.semesterPlan.length,
    totalCourses: courses.length - completedCourses.size,
    steps
  };
}

/**
 * Generate possible semester configurations from available courses
 */
function generateSemesterConfigs(available, constraints, goal) {
  const { maxCredits = 18, maxHardCourses = 2, maxCoursesPerSemester = 5 } = constraints;
  const configs = [];

  // Config 1: Sort by difficulty ascending (easiest first)
  const easiest = [...available].sort((a, b) => a.difficulty - b.difficulty);
  configs.push(selectSemesterCourses(easiest, maxCredits, maxHardCourses, maxCoursesPerSemester));

  // Config 2: Sort by credits descending (most credits first - faster graduation)
  const mostCredits = [...available].sort((a, b) => b.credits - a.credits);
  configs.push(selectSemesterCourses(mostCredits, maxCredits, maxHardCourses, maxCoursesPerSemester));

  // Config 3: Balanced - mix difficulty
  const balanced = [...available].sort((a, b) => a.difficulty - b.difficulty);
  configs.push(selectSemesterCourses(balanced, maxCredits, maxHardCourses, maxCoursesPerSemester));

  return configs.filter(c => c.length > 0);
}

function selectSemesterCourses(sorted, maxCredits, maxHardCourses, maxCoursesPerSemester) {
  const selected = [];
  let credits = 0, hard = 0;
  for (const course of sorted) {
    const isHard = course.difficulty >= 4;
    if (
      credits + course.credits <= maxCredits &&
      !(isHard && hard >= maxHardCourses) &&
      selected.length < maxCoursesPerSemester
    ) {
      selected.push(course);
      credits += course.credits;
      if (isHard) hard++;
    }
  }
  return selected;
}

function greedyFallback(courses, constraints, completedCourses, goal, courseMap) {
  const { maxCredits = 18, maxHardCourses = 2, maxCoursesPerSemester = 5 } = constraints;
  const completed = new Set(completedCourses);
  const remaining = courses.filter(c => !completed.has(c.id));
  const semesterPlan = [];
  let g = 0;

  while (remaining.length > 0) {
    const available = remaining.filter(c =>
      courseMap[c.id]?.prerequisites.every(p => completed.has(p))
    );
    if (available.length === 0) break;

    const sorted = goal === 'easiest'
      ? [...available].sort((a, b) => a.difficulty - b.difficulty)
      : [...available].sort((a, b) => b.credits - a.credits);

    const semCourses = selectSemesterCourses(sorted, maxCredits, maxHardCourses, maxCoursesPerSemester);
    if (semCourses.length === 0) break; // nothing fits: stop instead of looping forever
    const semCost = semCourses.reduce((s, c) => s + c.difficulty, 0);
    g += semCost;
    semCourses.forEach(c => {
      const idx = remaining.findIndex(r => r.id === c.id);
      if (idx > -1) remaining.splice(idx, 1);
      completed.add(c.id);
    });
    semesterPlan.push({
      semester: semesterPlan.length + 1,
      courses: semCourses,
      totalCredits: semCourses.reduce((s, c) => s + c.credits, 0),
      hardCourseCount: semCourses.filter(c => c.difficulty >= 4).length,
      cost: semCost
    });
  }

  return { semesterPlan, g };
}

module.exports = { astarPlanner };
