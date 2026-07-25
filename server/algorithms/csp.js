/**
 * Constraint Satisfaction Problem (CSP) Solver for Course Planning
 * 
 * Variables: Course assignments to semesters (which semester each course goes in)
 * Domains: Each course can be in semester 1..N
 * 
 * Hard Constraints:
 *   1. Prerequisites must be in an earlier semester
 *   2. Max credits per semester
 *   3. Max hard courses (difficulty >= 4) per semester
 *   4. Max total courses per semester
 * 
 * Techniques used:
 *   - Backtracking search
 *   - Forward checking (constraint propagation)
 *   - Minimum Remaining Values (MRV) heuristic
 *   - Least Constraining Value (LCV) ordering
 */

const { topologicalSort } = require('../utils/graphUtils');

/**
 * CSP Planner: assign courses to semesters using backtracking + propagation
 */
function cspPlanner(courses, constraints = {}, completedCourses = new Set()) {
  const {
    maxCredits = 18,
    maxHardCourses = 2,
    maxCoursesPerSemester = 5,
    maxSemesters = 10
  } = constraints;

  const steps = [];
  const nodesExplored = [];

  // Filter out completed courses
  const remaining = courses.filter(c => !completedCourses.has(c.id));
  const courseMap = {};
  courses.forEach(c => { courseMap[c.id] = c; });

  // Topological sort gives us an ordering hint
  const topoOrder = topologicalSort(remaining);
  if (!topoOrder) {
    return {
      algorithm: 'CSP',
      error: 'Cyclic prerequisites detected',
      semesterPlan: [],
      nodesExplored: [],
      steps: []
    };
  }

  // Initial assignment: all courses unassigned (null)
  const assignment = {};
  remaining.forEach(c => { assignment[c.id] = null; });

  // Domains: each course can potentially go in semester 1..maxSemesters
  const domains = {};
  remaining.forEach(c => {
    domains[c.id] = Array.from({ length: maxSemesters }, (_, i) => i + 1);
  });

  steps.push({
    action: 'CSP_INIT',
    variables: remaining.map(c => c.id),
    message: `CSP initialized with ${remaining.length} variables, domain 1..${maxSemesters}`
  });

  // Forward checking propagation
  function propagate(courseId, sem, currentDomains) {
    const copy = {};
    Object.keys(currentDomains).forEach(k => { copy[k] = [...currentDomains[k]]; });

    // All courses that depend on this course must be in sem+1 or later
    remaining.forEach(c => {
      if (c.prerequisites.includes(courseId) && copy[c.id]) {
        copy[c.id] = copy[c.id].filter(s => s > sem);
        if (copy[c.id].length === 0) {
          return null; // Domain wipeout
        }
      }
      // All prerequisites of this course must be in sem-1 or earlier
      if (courseId === c.id) {
        c.prerequisites.forEach(prereqId => {
          if (copy[prereqId]) {
            copy[prereqId] = copy[prereqId].filter(s => s < sem);
            if (copy[prereqId].length === 0) return null;
          }
        });
      }
    });

    return copy;
  }

  // Check if an assignment is consistent with hard constraints
  function isConsistent(courseId, sem, currentAssignment) {
    const course = courseMap[courseId];
    if (!course) return false;

    // 1. Prerequisites must be in earlier semesters
    for (const prereqId of course.prerequisites) {
      const prereqSem = completedCourses.has(prereqId) ? 0 : currentAssignment[prereqId];
      if (prereqSem === null || prereqSem === undefined || prereqSem >= sem) {
        return false;
      }
    }

    // 2. Count constraints for this semester
    const semCourses = remaining.filter(c =>
      currentAssignment[c.id] === sem && c.id !== courseId
    );
    const semCredits = semCourses.reduce((s, c) => s + c.credits, 0) + course.credits;
    const semHard = semCourses.filter(c => c.difficulty >= 4).length + (course.difficulty >= 4 ? 1 : 0);
    const semCount = semCourses.length + 1;

    if (semCredits > maxCredits) return false;
    if (semHard > maxHardCourses) return false;
    if (semCount > maxCoursesPerSemester) return false;

    return true;
  }

  // MRV - pick the variable with smallest domain (most constrained)
  function selectUnassignedVariable(currentAssignment, currentDomains) {
    let minLen = Infinity;
    let chosen = null;
    for (const courseId of topoOrder) {
      if (currentAssignment[courseId] === null) {
        const domLen = (currentDomains[courseId] || []).length;
        if (domLen < minLen) {
          minLen = domLen;
          chosen = courseId;
        }
      }
    }
    return chosen;
  }

  // LCV - order values to try the least constraining first
  function orderDomainValues(courseId, currentDomains) {
    const vals = currentDomains[courseId] || [];
    // Count how many other variables' domains would be reduced
    return [...vals].sort((a, b) => {
      let countA = 0, countB = 0;
      remaining.forEach(c => {
        if (c.id !== courseId && (currentDomains[c.id] || []).includes(a)) countA++;
        if (c.id !== courseId && (currentDomains[c.id] || []).includes(b)) countB++;
      });
      return countB - countA; // prefer values that keep more options open
    });
  }

  let backtrackCount = 0;
  const MAX_BACKTRACKS = 5000;

  // Recursive backtracking
  function backtrack(currentAssignment, currentDomains) {
    if (backtrackCount > MAX_BACKTRACKS) return null;

    // Check if all assigned
    const allAssigned = Object.values(currentAssignment).every(v => v !== null);
    if (allAssigned) return currentAssignment;

    const courseId = selectUnassignedVariable(currentAssignment, currentDomains);
    if (!courseId) return null;

    nodesExplored.push(courseId);
    const values = orderDomainValues(courseId, currentDomains);

    steps.push({
      action: 'CSP_BACKTRACK',
      courseId,
      trialValues: values,
      backtrackCount,
      message: `CSP: Trying to assign "${courseMap[courseId]?.name}" to semesters [${values.join(',')}]`
    });

    for (const sem of values) {
      if (isConsistent(courseId, sem, currentAssignment)) {
        currentAssignment[courseId] = sem;

        steps.push({
          action: 'CSP_ASSIGN',
          courseId,
          semester: sem,
          message: `CSP: Assigned "${courseMap[courseId]?.name}" → Semester ${sem}`
        });

        const newDomains = propagate(courseId, sem, currentDomains);
        if (newDomains) {
          backtrackCount++;
          const result = backtrack({ ...currentAssignment }, newDomains);
          if (result) return result;
        }

        currentAssignment[courseId] = null;
        steps.push({
          action: 'CSP_UNDO',
          courseId,
          semester: sem,
          message: `CSP: Backtracking, undid assignment of "${courseMap[courseId]?.name}" from Semester ${sem}`
        });
      }
    }

    return null; // All values failed
  }

  const result = backtrack(assignment, domains);

  if (!result) {
    steps.push({
      action: 'CSP_FAILED',
      message: 'CSP: No valid assignment found within constraints'
    });
    return {
      algorithm: 'CSP',
      error: 'No valid assignment found',
      semesterPlan: [],
      nodesExplored,
      steps
    };
  }

  // Build semester plan from assignment
  const semMap = {};
  Object.entries(result).forEach(([courseId, sem]) => {
    if (!semMap[sem]) semMap[sem] = [];
    semMap[sem].push(courseMap[courseId]);
  });

  const semesterPlan = Object.keys(semMap)
    .map(Number)
    .sort((a, b) => a - b)
    .map(sem => ({
      semester: sem,
      courses: semMap[sem],
      totalCredits: semMap[sem].reduce((s, c) => s + c.credits, 0),
      hardCourseCount: semMap[sem].filter(c => c.difficulty >= 4).length
    }));

  steps.push({
    action: 'CSP_SUCCESS',
    totalSemesters: semesterPlan.length,
    backtrackCount,
    message: `CSP SUCCESS! Found valid plan in ${backtrackCount} backtracks across ${semesterPlan.length} semesters`
  });

  return {
    algorithm: 'CSP',
    semesterPlan,
    nodesExplored,
    backtrackCount,
    totalSemesters: semesterPlan.length,
    totalCourses: remaining.length,
    steps
  };
}

module.exports = { cspPlanner };
