/**
 * Breadth-First Search (BFS) for Course Path Planning
 * 
 * Strategy: Explore all courses at the current "depth" (semester level)
 * before moving deeper. Assigns courses layer by layer.
 * 
 * This ensures the SHORTEST number of semesters is found.
 */

const { prerequisitesSatisfied, getAvailableCourses } = require('../utils/graphUtils');

/**
 * BFS-based semester planner
 * @param {Array} courses - All courses
 * @param {Object} constraints - { maxCredits, maxHardCourses, maxCoursesPerSemester }
 * @param {Set} completedCourses - Already completed course IDs
 * @returns {Object} { semesterPlan, nodesExplored, steps }
 */
function bfsPlanner(courses, constraints = {}, completedCourses = new Set()) {
  const {
    maxCredits = 18,
    maxHardCourses = 2,   // difficulty >= 4
    maxCoursesPerSemester = 5
  } = constraints;

  const semesterPlan = [];
  const completed = new Set(completedCourses);
  const pending = courses.filter(c => !completed.has(c.id));
  const nodesExplored = [];
  const steps = [];
  let iteration = 0;

  // BFS: process all available courses level-by-level
  while (pending.length > 0) {
    iteration++;
    // BFS frontier: all currently available courses
    const frontier = pending.filter(c => prerequisitesSatisfied(c, completed));

    if (frontier.length === 0) {
      // Deadlock - prerequisites cannot be satisfied
      steps.push({
        step: iteration,
        action: 'DEADLOCK',
        message: 'Cannot schedule remaining courses - prerequisite deadlock',
        remaining: pending.map(c => c.id)
      });
      break;
    }

    // Record exploration
    nodesExplored.push(...frontier.map(c => c.id));
    steps.push({
      step: iteration,
      action: 'EXPLORE_FRONTIER',
      frontier: frontier.map(c => c.id),
      message: `BFS Level ${iteration}: Found ${frontier.length} available courses`
    });

    // Greedily fill this semester respecting constraints
    const semesterCourses = [];
    let semesterCredits = 0;
    let hardCount = 0;

    // Sort frontier by difficulty (easier first) for balanced scheduling
    const sorted = [...frontier].sort((a, b) => a.difficulty - b.difficulty);

    for (const course of sorted) {
      const isHard = course.difficulty >= 4;
      const wouldExceedCredits = semesterCredits + course.credits > maxCredits;
      const wouldExceedHard = isHard && hardCount >= maxHardCourses;
      const wouldExceedCount = semesterCourses.length >= maxCoursesPerSemester;

      if (!wouldExceedCredits && !wouldExceedHard && !wouldExceedCount) {
        semesterCourses.push(course);
        semesterCredits += course.credits;
        if (isHard) hardCount++;

        steps.push({
          step: iteration,
          action: 'SCHEDULE',
          courseId: course.id,
          courseName: course.name,
          semester: semesterPlan.length + 1,
          message: `Scheduled "${course.name}" in Semester ${semesterPlan.length + 1}`
        });
      } else {
        steps.push({
          step: iteration,
          action: 'DEFER',
          courseId: course.id,
          courseName: course.name,
          reason: wouldExceedCredits ? 'credit limit' : wouldExceedHard ? 'hard course limit' : 'course count limit',
          message: `Deferred "${course.name}" - constraint violation`
        });
      }
    }

    // Remove scheduled courses from pending and mark completed
    semesterCourses.forEach(c => {
      const idx = pending.indexOf(c);
      if (idx > -1) pending.splice(idx, 1);
      completed.add(c.id);
    });

    if (semesterCourses.length > 0) {
      semesterPlan.push({
        semester: semesterPlan.length + 1,
        courses: semesterCourses,
        totalCredits: semesterCredits,
        hardCourseCount: hardCount
      });
    }
  }

  return {
    algorithm: 'BFS',
    semesterPlan,
    nodesExplored,
    totalSemesters: semesterPlan.length,
    totalCourses: courses.length - completedCourses.size,
    steps
  };
}

module.exports = { bfsPlanner };
