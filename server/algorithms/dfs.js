/**
 * Depth-First Search (DFS) for Course Path Planning
 * 
 * Strategy: Deep-dive into one course chain at a time.
 * Recursively explores prerequisite chains before taking sibling courses.
 * Tends to create long sequential plans - useful for specialization paths.
 */

const { prerequisitesSatisfied } = require('../utils/graphUtils');

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

  // Build course map for quick lookup
  const courseMap = {};
  courses.forEach(c => { courseMap[c.id] = c; });

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
  courses.forEach(course => {
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

  for (const courseId of visitOrder) {
    const course = courseMap[courseId];
    if (!course || completedCourses.has(courseId)) continue;

    // Check if prerequisites are met (they should be, given DFS post-order)
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
    scheduledCompleted.add(course.id);

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

  return {
    algorithm: 'DFS',
    semesterPlan,
    nodesExplored,
    totalSemesters: semesterPlan.length,
    totalCourses: courses.length - completedCourses.size,
    steps
  };
}

module.exports = { dfsPlanner };
