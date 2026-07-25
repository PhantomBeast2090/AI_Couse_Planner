/**
 * Uniform Cost Search (UCS) for Course Path Planning
 * 
 * Strategy: Always expand the lowest-cost node.
 * Cost = total difficulty accumulated so far.
 * Finds the EASIEST path through courses (minimum cumulative difficulty).
 * 
 * Uses a min-heap (priority queue) to always process the cheapest state.
 */

const { prerequisitesSatisfied } = require('../utils/graphUtils');

// ---- Min-Heap Priority Queue (manual implementation) ----
class MinHeap {
  constructor() { this.heap = []; }

  push(item) {
    this.heap.push(item);
    this._bubbleUp(this.heap.length - 1);
  }

  pop() {
    const top = this.heap[0];
    const last = this.heap.pop();
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this._sinkDown(0);
    }
    return top;
  }

  get size() { return this.heap.length; }

  _bubbleUp(i) {
    while (i > 0) {
      const parent = Math.floor((i - 1) / 2);
      if (this.heap[parent].cost <= this.heap[i].cost) break;
      [this.heap[parent], this.heap[i]] = [this.heap[i], this.heap[parent]];
      i = parent;
    }
  }

  _sinkDown(i) {
    const n = this.heap.length;
    while (true) {
      let smallest = i;
      const left = 2 * i + 1, right = 2 * i + 2;
      if (left < n && this.heap[left].cost < this.heap[smallest].cost) smallest = left;
      if (right < n && this.heap[right].cost < this.heap[smallest].cost) smallest = right;
      if (smallest === i) break;
      [this.heap[smallest], this.heap[i]] = [this.heap[i], this.heap[smallest]];
      i = smallest;
    }
  }
}

/**
 * UCS-based planner: minimizes cumulative difficulty (easiest path)
 * @param {Array} courses
 * @param {Object} constraints
 * @param {Set} completedCourses
 */
function ucsPlanner(courses, constraints = {}, completedCourses = new Set()) {
  const {
    maxCredits = 18,
    maxHardCourses = 2,
    maxCoursesPerSemester = 5
  } = constraints;

  const courseMap = {};
  courses.forEach(c => { courseMap[c.id] = c; });

  const nodesExplored = [];
  const steps = [];
  const completed = new Set(completedCourses);
  const remaining = courses.filter(c => !completed.has(c.id));
  const semesterPlan = [];
  let totalCost = 0;
  let semesterNum = 0;

  while (remaining.length > 0) {
    semesterNum++;
    // UCS: build a priority queue of available courses, ordered by difficulty (cost)
    const pq = new MinHeap();
    const available = remaining.filter(c => prerequisitesSatisfied(c, completed));

    if (available.length === 0) {
      steps.push({
        action: 'DEADLOCK',
        message: 'No courses can be scheduled - prerequisite deadlock'
      });
      break;
    }

    // Enqueue all available courses
    available.forEach(c => {
      pq.push({ cost: c.difficulty, course: c });
      steps.push({
        action: 'UCS_ENQUEUE',
        courseId: c.id,
        cost: c.difficulty,
        message: `UCS: Enqueue "${c.name}" with cost ${c.difficulty}`
      });
    });

    nodesExplored.push(...available.map(c => c.id));

    // Greedily pick lowest-cost courses for this semester
    const semesterCourses = [];
    let semesterCredits = 0;
    let hardCount = 0;

    while (pq.size > 0) {
      const { cost, course } = pq.pop();

      steps.push({
        action: 'UCS_DEQUEUE',
        courseId: course.id,
        cost,
        message: `UCS: Dequeue "${course.name}" (cost=${cost})`
      });

      const isHard = course.difficulty >= 4;
      if (
        semesterCredits + course.credits <= maxCredits &&
        !(isHard && hardCount >= maxHardCourses) &&
        semesterCourses.length < maxCoursesPerSemester &&
        !semesterCourses.find(c => c.id === course.id)
      ) {
        semesterCourses.push(course);
        semesterCredits += course.credits;
        totalCost += cost;
        if (isHard) hardCount++;

        steps.push({
          action: 'SCHEDULE',
          courseId: course.id,
          courseName: course.name,
          cost,
          totalCost,
          semester: semesterNum,
          message: `Scheduled "${course.name}" (difficulty=${cost}, cumTotal=${totalCost})`
        });
      }
    }

    // Remove from remaining
    semesterCourses.forEach(c => {
      const idx = remaining.findIndex(r => r.id === c.id);
      if (idx > -1) remaining.splice(idx, 1);
      completed.add(c.id);
    });

    if (semesterCourses.length > 0) {
      semesterPlan.push({
        semester: semesterNum,
        courses: semesterCourses,
        totalCredits: semesterCredits,
        hardCourseCount: hardCount,
        semesterCost: semesterCourses.reduce((s, c) => s + c.difficulty, 0)
      });
    }
  }

  return {
    algorithm: 'UCS',
    semesterPlan,
    nodesExplored,
    totalCost,
    totalSemesters: semesterPlan.length,
    totalCourses: courses.length - completedCourses.size,
    steps
  };
}

module.exports = { ucsPlanner };
