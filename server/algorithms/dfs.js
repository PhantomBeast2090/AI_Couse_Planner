/**
 * Depth-First Search (DFS) for Course Path Planning
 * 
 * Strategy: Deep-dive into one course chain at a time.
 * Recursively explores prerequisite chains before taking sibling courses.
 * Tends to create long sequential plans - useful for specialization paths.
 */

const { prerequisitesSatisfied, topologicalSort } = require('../utils/graphUtils');
const { checkTriviallyImpossible } = require('../utils/planValidator');

/**
 * DFS-based course planner using recursive backtracking
 * @param {Array} courses - All courses
 * @param {Object} constraints - { maxCredits, maxHardCourses, maxCoursesPerSemester }
 * @param {Set} completedCourses - Already completed course IDs
 * @returns {Object} { semesterPlan, nodesExplored, steps }
 */
function dfsPlanner(courses, constraints = {}, completedCourses = new Set()) {
  const {
    maxCredits = 18,
    maxHardCourses = 2,
    maxCoursesPerSemester = 5
  } = constraints;

  const nodesExplored = [];
  const steps = [];
  const semesterPlan = [];
  const completed = new Set(completedCourses);
  const visited = new Set([...completedCourses]);

  // Deduplicate by id (first occurrence wins) and index for quick lookup.
  const courseMap = {};
  const deduped = [];
  courses.forEach(c => {
    if (!courseMap[c.id]) {
      courseMap[c.id] = c;
      deduped.push(c);
    }
  });

  // Fail fast when a single remaining course alone violates the limits
  // (DFS would otherwise schedule it anyway and emit an invalid plan).
  const impossible = checkTriviallyImpossible(deduped, completedCourses, constraints);
  if (impossible) {
    steps.push({ action: 'DEADLOCK', message: impossible });
    return {
      algorithm: 'DFS',
      success: false,
      error: impossible,
      unplanned: deduped.filter(c => !completed.has(c.id)).map(c => c.id),
      semesterPlan: [],
      nodesExplored: [],
      totalSemesters: 0,
      totalCourses: courses.length - completedCourses.size,
      steps
    };
  }

  // Fail safely on cyclic graphs instead of silently emitting an invalid plan.
  if (topologicalSort(deduped.filter(c => !completed.has(c.id))) === null && deduped.some(c => !completed.has(c.id))) {
    // topologicalSort returns null only when remaining courses contain a cycle
    // (it returns [] for the empty set, which is not a cycle).
    const remainingIds = deduped.filter(c => !completed.has(c.id)).map(c => c.id);
    steps.push({
      action: 'DEADLOCK',
      message: 'Cyclic prerequisites detected - no valid ordering exists',
      remaining: remainingIds
    });
    return {
      algorithm: 'DFS',
      success: false,
      error: 'Cyclic prerequisites detected',
      unplanned: remainingIds,
      semesterPlan: [],
      nodesExplored: [],
      totalSemesters: 0,
      totalCourses: courses.length - completedCourses.size,
      steps
    };
  }

  // Fail safely when a prerequisite id does not match any known course.
  const knownIds = new Set(deduped.map(c => c.id));
  const unknownPrereqs = [...new Set(
    deduped.filter(c => !completed.has(c.id)).flatMap(c => c.prerequisites || []).filter(p => !knownIds.has(p) && !completed.has(p))
  )];
  if (unknownPrereqs.length > 0) {
    const remainingIds = deduped.filter(c => !completed.has(c.id)).map(c => c.id);
    steps.push({
      action: 'DEADLOCK',
      message: `Unknown prerequisite id(s): ${unknownPrereqs.join(', ')}`,
      remaining: remainingIds
    });
    return {
      algorithm: 'DFS',
      success: false,
      error: `Unknown prerequisite id(s): ${unknownPrereqs.join(', ')}`,
      unplanned: remainingIds,
      semesterPlan: [],
      nodesExplored: [],
      totalSemesters: 0,
      totalCourses: courses.length - completedCourses.size,
      steps
    };
  }

  // DFS visit order - build an ordered visit list
  const visitOrder = [];

  function dfs(courseId, depth = 0) {
    if (visited.has(courseId)) return;
    const course = courseMap[courseId];
    if (!course) return;

    visited.add(courseId);
    nodesExplored.push(courseId);

    steps.push({
      action: 'DFS_VISIT',
      courseId,
      courseName: course.name,
      depth,
      message: `DFS visiting "${course.name}" at depth ${depth}`
    });

    // First, DFS into all prerequisites
    course.prerequisites.forEach(prereqId => {
      if (!visited.has(prereqId)) {
        steps.push({
          action: 'DFS_RECURSE',
          from: courseId,
          to: prereqId,
          message: `Going deeper: "${courseMap[prereqId]?.name}" required before "${course.name}"`
        });
        dfs(prereqId, depth + 1);
      }
    });

    // Then add this course (post-order, like proper DFS)
    visitOrder.push(courseId);
  }

  // Run DFS from each unvisited course
  deduped.forEach(course => {
    if (!visited.has(course.id)) {
      dfs(course.id);
    }
  });

  steps.push({
    action: 'DFS_ORDER_COMPLETE',
    order: visitOrder,
    message: `DFS traversal complete. Visit order: ${visitOrder.join(' → ')}`
  });

  // Now schedule courses in DFS topological order, respecting constraints
  let semesterCourses = [];
  let semesterCredits = 0;
  let hardCount = 0;
  const scheduledCompleted = new Set([...completedCourses]);
  let failed = false;

  for (const courseId of visitOrder) {
    const course = courseMap[courseId];
    if (!course || completedCourses.has(courseId)) continue;

    // Check if prerequisites are met (they should be, given DFS post-order).
    // If not, flush the current semester and re-check; if still unmet the
    // input is unsatisfiable (e.g. violated ordering), so fail safely
    // instead of scheduling a prerequisite violation.
    if (!prerequisitesSatisfied(course, scheduledCompleted)) {
      // Push to next semester
      if (semesterCourses.length > 0) {
        semesterCourses.forEach(c => scheduledCompleted.add(c.id));
        semesterPlan.push({
          semester: semesterPlan.length + 1,
          courses: semesterCourses,
          totalCredits: semesterCredits,
          hardCourseCount: hardCount
        });
        semesterCourses = [];
        semesterCredits = 0;
        hardCount = 0;
      }
      if (!prerequisitesSatisfied(course, scheduledCompleted)) {
        failed = true;
        steps.push({
          action: 'DEADLOCK',
          courseId: course.id,
          message: `Cannot schedule "${course.name}" - prerequisites cannot be satisfied`
        });
        break;
      }
    }

    const isHard = course.difficulty >= 4;
    const wouldExceedCredits = semesterCredits + course.credits > maxCredits;
    const wouldExceedHard = isHard && hardCount >= maxHardCourses;
    const wouldExceedCount = semesterCourses.length >= maxCoursesPerSemester;

    if (wouldExceedCredits || wouldExceedHard || wouldExceedCount) {
      // Start a new semester
      semesterCourses.forEach(c => scheduledCompleted.add(c.id));
      semesterPlan.push({
        semester: semesterPlan.length + 1,
        courses: semesterCourses,
        totalCredits: semesterCredits,
        hardCourseCount: hardCount
      });
      semesterCourses = [];
      semesterCredits = 0;
      hardCount = 0;

      steps.push({
        action: 'NEW_SEMESTER',
        semester: semesterPlan.length + 1,
        message: `Starting Semester ${semesterPlan.length + 1} due to constraint overflow`
      });
    }

    semesterCourses.push(course);
    semesterCredits += course.credits;
    if (isHard) hardCount++;
    // NOTE: the course is deliberately NOT added to scheduledCompleted here.
    // A prerequisite must be completed in a strictly earlier semester, so
    // semester courses only become "completed" when the semester is flushed
    // (see both flush sites above). Marking them immediately would let a
    // dependent join the same semester as its prerequisite — an invalid plan.

    steps.push({
      action: 'SCHEDULE',
      courseId: course.id,
      courseName: course.name,
      semester: semesterPlan.length + 1,
      message: `Scheduled "${course.name}" in Semester ${semesterPlan.length + 1}`
    });
  }

  // Flush last semester
  if (semesterCourses.length > 0) {
    semesterPlan.push({
      semester: semesterPlan.length + 1,
      courses: semesterCourses,
      totalCredits: semesterCredits,
      hardCourseCount: hardCount
    });
  }

  const plannedIds = new Set(semesterPlan.flatMap(s => s.courses.map(c => c.id)));
  const unplanned = deduped.filter(c => !completedCourses.has(c.id) && !plannedIds.has(c.id)).map(c => c.id);
  const success = !failed && unplanned.length === 0;

  return {
    algorithm: 'DFS',
    success,
    ...(success ? {} : { error: failed ? 'Could not satisfy prerequisites for all courses' : `Could not schedule ${unplanned.length} course(s)` }),
    unplanned,
    semesterPlan,
    nodesExplored,
    totalSemesters: semesterPlan.length,
    totalCourses: courses.length - completedCourses.size,
    steps
  };
}

module.exports = { dfsPlanner };
