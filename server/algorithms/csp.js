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
const { checkTriviallyImpossible } = require('../utils/planValidator');

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

  // Deduplicate by id (first occurrence wins); without this, topologicalSort
  // would report a false cycle whenever the input contains duplicate rows.
  const courseMap = {};
  const deduped = [];
  courses.forEach(c => {
    if (c && typeof c.id === 'string' && !courseMap[c.id]) {
      courseMap[c.id] = c;
      deduped.push(c);
    }
  });
  const completedSet = completedCourses instanceof Set ? completedCourses : new Set();

  // Filter out completed courses
  const remaining = deduped.filter(c => !completedSet.has(c.id));

  // Fail fast on unknown prerequisite ids (isConsistent would also reject
  // them, but an explicit error is clearer and cheaper).
  const knownIds = new Set(deduped.map(c => c.id));
  const unknownPrereqs = [...new Set(
    remaining.flatMap(c => c.prerequisites || []).filter(p => !knownIds.has(p) && !completedSet.has(p))
  )];
  if (unknownPrereqs.length > 0) {
    steps.push({
      action: 'CSP_FAILED',
      message: `Unknown prerequisite id(s): ${unknownPrereqs.join(', ')}`
    });
    return {
      algorithm: 'CSP',
      success: false,
      error: `Unknown prerequisite id(s): ${unknownPrereqs.join(', ')}`,
      unplanned: remaining.map(c => c.id),
      semesterPlan: [],
      nodesExplored: [],
      steps
    };
  }

  // Fail fast when a single remaining course alone violates the limits.
  const impossible = checkTriviallyImpossible(deduped, completedSet, constraints);
  if (impossible) {
    steps.push({ action: 'CSP_FAILED', message: impossible });
    return {
      algorithm: 'CSP',
      success: false,
      error: impossible,
      unplanned: remaining.map(c => c.id),
      semesterPlan: [],
      nodesExplored: [],
      steps
    };
  }

  // Topological sort gives us an ordering hint
  const topoOrder = topologicalSort(remaining);
  if (!topoOrder) {
    return {
      algorithm: 'CSP',
      success: false,
      error: 'Cyclic prerequisites detected',
      unplanned: remaining.map(c => c.id),
      semesterPlan: [],
      nodesExplored: [],
      steps
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

  // Forward checking propagation.
  // Constrains dependents to later semesters and prerequisites of the
  // assigned course to earlier semesters. Returns the narrowed domains,
  // or null when a domain is wiped out (propagated failure).
  function propagate(courseId, sem, currentDomains) {
    const copy = {};
    Object.keys(currentDomains).forEach(k => { copy[k] = [...currentDomains[k]]; });

    const assigned = remaining.find(c => c.id === courseId);

    // All courses that depend on this course must be in sem+1 or later.
    for (const c of remaining) {
      if (c.prerequisites.includes(courseId) && copy[c.id]) {
        copy[c.id] = copy[c.id].filter(s => s > sem);
        if (copy[c.id].length === 0) return null; // domain wipeout
      }
    }
    // All prerequisites of the assigned course must be in sem-1 or earlier.
    if (assigned) {
      for (const prereqId of assigned.prerequisites) {
        if (copy[prereqId]) {
          copy[prereqId] = copy[prereqId].filter(s => s < sem);
          if (copy[prereqId].length === 0) return null; // domain wipeout
        }
      }
    }

    return copy;
  }

  // Check if an assignment is consistent with hard constraints
  function isConsistent(courseId, sem, currentAssignment) {
    const course = courseMap[courseId];
    if (!course) return false;

    // 1. Prerequisites must be in earlier semesters
    for (const prereqId of course.prerequisites) {
      const prereqSem = completedSet.has(prereqId) ? 0 : currentAssignment[prereqId];
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

  // MRV - pick the variable with smallest domain (most constrained).
  // Only "ready" variables are eligible: every prerequisite must already be
  // assigned (or pre-completed). Picking a dependent before its prerequisites
  // are assigned can never satisfy isConsistent, so unrestrained MRV dead-ends
  // on branching graphs (e.g. A -> C <- B) even when valid plans exist.
  // Gating on readiness keeps completeness: every valid assignment has a
  // topological selection order, and a DAG always offers a ready variable.
  function selectUnassignedVariable(currentAssignment, currentDomains) {
    let minLen = Infinity;
    let chosen = null;
    for (const courseId of topoOrder) {
      if (currentAssignment[courseId] !== null) continue;
      const course = courseMap[courseId];
      const ready = (course.prerequisites || []).every(p =>
        completedSet.has(p) || (currentAssignment[p] !== null && currentAssignment[p] !== undefined)
      );
      if (!ready) continue;
      const domLen = (currentDomains[courseId] || []).length;
      if (domLen < minLen) {
        minLen = domLen;
        chosen = courseId;
      }
    }
    if (chosen) return chosen;
    // Fallback for safety: plain MRV (reached only on unsatisfiable input).
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
      success: false,
      error: 'No valid assignment found',
      unplanned: remaining.map(c => c.id),
      semesterPlan: [],
      nodesExplored,
      steps
    };
  }

  // Build semester plan from assignment. Raw CSP semester numbers can be
  // non-contiguous (e.g. 1,3,5), so compress them to 1..k while preserving
  // order — prerequisite "strictly earlier" relations are unaffected.
  const semMap = {};
  Object.entries(result).forEach(([courseId, sem]) => {
    if (!semMap[sem]) semMap[sem] = [];
    semMap[sem].push(courseMap[courseId]);
  });

  const semesterPlan = Object.keys(semMap)
    .map(Number)
    .sort((a, b) => a - b)
    .map((sem, idx) => ({
      semester: idx + 1,
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
    success: true,
    unplanned: [],
    semesterPlan,
    nodesExplored,
    backtrackCount,
    totalSemesters: semesterPlan.length,
    totalCourses: remaining.length,
    steps
  };
}

module.exports = { cspPlanner };
