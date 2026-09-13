/**
 * Breadth-First Search (BFS) for Course Path Planning
 * 
 * Strategy: Explore all courses at the current "depth" (semester level)
 * before moving deeper. Assigns courses layer by layer.
 *
 * Layer-by-layer packing tends to keep semester counts low on wide graphs,
 * but greedy packing under tight constraints is not proven semester-minimal.
 */

const { prerequisitesSatisfied, getAvailableCourses } = require('../utils/graphUtils');
const { checkTriviallyImpossible } = require('../utils/planValidator');

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
  // Deduplicate by id (first occurrence wins) so duplicate input rows
  // can never produce a plan containing the same course twice.
  const seenIds = new Set();
  const pending = courses.filter(c => {
    if (completed.has(c.id) || seenIds.has(c.id)) return false;
    seenIds.add(c.id);
    return true;
  });
  const nodesExplored = [];
  const steps = [];
  let iteration = 0;
  let deadlock = false;

  // Fail fast when a single remaining course alone violates the limits.
  const impossible = checkTriviallyImpossible(courses, completedCourses, constraints);
  if (impossible) {
    steps.push({ step: 0, action: 'DEADLOCK', message: impossible });
    return {
      algorithm: 'BFS',
      success: false,
      error: impossible,
      unplanned: pending.map(c => c.id),
      semesterPlan: [],
      nodesExplored: [],
      totalSemesters: 0,
      totalCourses: courses.length - completedCourses.size,
      steps
    };
  }

  // BFS: process all available courses level-by-level
  while (pending.length > 0) {
    iteration++;
    // BFS frontier: all currently available courses
    const frontier = pending.filter(c => prerequisitesSatisfied(c, completed));

    if (frontier.length === 0) {
      // Deadlock - prerequisites cannot be satisfied
      deadlock = true;
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

    // No progress: the frontier exists but nothing fits the constraints.
    // Break instead of looping forever; the caller sees success=false.
    if (semesterCourses.length === 0) {
      deadlock = true;
      steps.push({
        step: iteration,
        action: 'DEADLOCK',
        message: 'No available course fits the semester constraints - planning cannot progress',
        remaining: pending.map(c => c.id)
      });
      break;
    }

    if (semesterCourses.length > 0) {
      semesterPlan.push({
        semester: semesterPlan.length + 1,
        courses: semesterCourses,
        totalCredits: semesterCredits,
        hardCourseCount: hardCount
      });
    }
  }

  const unplanned = pending.map(c => c.id);
  const success = !deadlock && unplanned.length === 0;

  return {
    algorithm: 'BFS',
    success,
    ...(success ? {} : { error: unplanned.length === 0 ? 'No courses to plan' : `Could not schedule ${unplanned.length} course(s): prerequisite deadlock or unsatisfiable constraints` }),
    unplanned,
    semesterPlan,
    nodesExplored,
    totalSemesters: semesterPlan.length,
    totalCourses: courses.length - completedCourses.size,
    steps
  };
}

module.exports = { bfsPlanner };
