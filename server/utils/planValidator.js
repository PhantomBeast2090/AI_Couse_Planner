/**
 * Shared plan validation for the AI Course Planner.
 *
 * Used by planners, tests, and the benchmark so every algorithm is judged
 * by the same correctness rules. No dependencies.
 */

/**
 * Deduplicate courses by id and partition completed ids into known/unknown.
 * First occurrence of a duplicate id wins; later ones are reported.
 */
function normalizeInputs(courses, completedCourses) {
  const seen = new Set();
  const deduped = [];
  const duplicateIds = [];

  (courses || []).forEach((c) => {
    if (!c || typeof c.id !== 'string') return;
    if (seen.has(c.id)) {
      if (!duplicateIds.includes(c.id)) duplicateIds.push(c.id);
      return;
    }
    seen.add(c.id);
    deduped.push(c);
  });

  const knownIds = new Set(deduped.map((c) => c.id));
  const completedArr = completedCourses instanceof Set
    ? [...completedCourses]
    : (completedCourses || []);
  const completedSet = new Set(completedArr.filter((id) => knownIds.has(id)));
  const unknownCompletedIds = completedArr.filter((id) => !knownIds.has(id));

  const unknownPrereqIds = [];
  deduped.forEach((c) => {
    (c.prerequisites || []).forEach((p) => {
      if (!knownIds.has(p) && !unknownPrereqIds.includes(p)) unknownPrereqIds.push(p);
    });
  });

  return { courses: deduped, completedSet, duplicateIds, unknownCompletedIds, unknownPrereqIds };
}

/**
 * Validate a generated semester plan against prerequisite + constraint rules.
 * Returns { valid, errors } — never throws on bad input.
 */
function validatePlan(semesterPlan, courses, completedInput, constraints = {}) {
  const errors = [];
  const {
    maxCredits = 18,
    maxHardCourses = 2,
    maxCoursesPerSemester = 5,
  } = constraints;

  const { courses: deduped, completedSet } = normalizeInputs(courses, completedInput);
  const courseMap = new Map(deduped.map((c) => [c.id, c]));
  const plan = semesterPlan || [];

  const seenPlanned = new Set();
  const completedBySemesterEnd = new Set(completedSet);

  plan.forEach((sem, idx) => {
    const semLabel = `semester ${sem && sem.semester != null ? sem.semester : idx + 1}`;
    const semCourses = (sem && sem.courses) || [];

    if (semCourses.length > maxCoursesPerSemester) {
      errors.push(`${semLabel}: ${semCourses.length} courses exceeds limit ${maxCoursesPerSemester}`);
    }
    const credits = semCourses.reduce((s, c) => s + (c.credits || 0), 0);
    if (credits > maxCredits) {
      errors.push(`${semLabel}: ${credits} credits exceeds limit ${maxCredits}`);
    }
    const hard = semCourses.filter((c) => (c.difficulty || 0) >= 4).length;
    if (hard > maxHardCourses) {
      errors.push(`${semLabel}: ${hard} hard courses exceeds limit ${maxHardCourses}`);
    }

    semCourses.forEach((c) => {
      if (!c || typeof c.id !== 'string') {
        errors.push(`${semLabel}: entry without a valid course id`);
        return;
      }
      if (!courseMap.has(c.id)) {
        errors.push(`${semLabel}: unknown course id "${c.id}"`);
        return;
      }
      if (completedSet.has(c.id)) {
        errors.push(`${semLabel}: course "${c.id}" was already completed`);
      }
      if (seenPlanned.has(c.id)) {
        errors.push(`${semLabel}: course "${c.id}" appears twice`);
      }
      seenPlanned.add(c.id);

      const full = courseMap.get(c.id);
      (full.prerequisites || []).forEach((p) => {
        if (!courseMap.has(p)) {
          errors.push(`course "${c.id}" requires unknown prerequisite "${p}"`);
        } else if (!completedBySemesterEnd.has(p)) {
          errors.push(`course "${c.id}" scheduled before prerequisite "${p}"`);
        }
      });
    });

    semCourses.forEach((c) => {
      if (c && typeof c.id === 'string' && courseMap.has(c.id)) completedBySemesterEnd.add(c.id);
    });
  });

  return { valid: errors.length === 0, errors };
}

/**
 * Courses that were expected but never scheduled and never completed.
 */
function findUnplanned(courses, semesterPlan, completedInput) {
  const { courses: deduped, completedSet } = normalizeInputs(courses, completedInput);
  const planned = new Set();
  (semesterPlan || []).forEach((sem) => {
    ((sem && sem.courses) || []).forEach((c) => {
      if (c && c.id) planned.add(c.id);
    });
  });
  return deduped.map((c) => c.id).filter((id) => !planned.has(id) && !completedSet.has(id));
}

/**
 * Cheap pre-check for inputs no planner can satisfy: a remaining course that
 * alone exceeds maxCredits, a hard course when maxHardCourses is 0, or a
 * per-semester course cap below 1. Returns an error string or null.
 */
function checkTriviallyImpossible(courses, completedInput, constraints = {}) {
  const {
    maxCredits = 18,
    maxHardCourses = 2,
    maxCoursesPerSemester = 5,
  } = constraints;
  const { courses: deduped, completedSet } = normalizeInputs(courses, completedInput);
  const remaining = deduped.filter((c) => !completedSet.has(c.id));
  if (remaining.length > 0 && maxCoursesPerSemester < 1) {
    return 'maxCoursesPerSemester < 1 makes planning impossible';
  }
  for (const c of remaining) {
    if ((c.credits || 0) > maxCredits) {
      return `course "${c.id}" (${c.credits} credits) exceeds maxCredits ${maxCredits}`;
    }
    if ((c.difficulty || 0) >= 4 && maxHardCourses < 1) {
      return `course "${c.id}" is hard but maxHardCourses is ${maxHardCourses}`;
    }
  }
  return null;
}

/**
 * Validate a degree timeline against the hard product rules.
 *
 * Beyond validatePlan it checks: semester count cap, per-semester course
 * cap, contiguous 1..k numbering (so "Semester 9+" cannot hide), program
 * membership, and required-course coverage (every required non-completed
 * course is either planned or explicitly listed as unplanned).
 */
function validateTimeline(timeline, options = {}) {
  const {
    courses = [],
    completedInput = new Set(),
    constraints = {},
    programCourseIds = null,
    requiredIds = [],
    unplannedIds = [],
    maxSemesters = 8,
    maxCoursesPerSemester = 8,
  } = options;

  const errors = [];
  const plan = (timeline && timeline.semesterPlan) || timeline || [];

  const base = validatePlan(plan, courses, completedInput, constraints);
  errors.push(...base.errors);

  if (plan.length > maxSemesters) {
    errors.push(`timeline has ${plan.length} semesters, limit is ${maxSemesters}`);
  }
  plan.forEach((sem, idx) => {
    const count = ((sem && sem.courses) || []).length;
    if (count > maxCoursesPerSemester) {
      errors.push(`semester ${idx + 1}: ${count} courses exceeds limit ${maxCoursesPerSemester}`);
    }
    if (sem && sem.semester !== undefined && sem.semester !== idx + 1) {
      errors.push(`semester numbering must be contiguous 1..k, found ${sem.semester} at position ${idx + 1}`);
    }
  });

  if (programCourseIds) {
    const allowed = new Set(programCourseIds);
    plan.forEach((sem, idx) => {
      ((sem && sem.courses) || []).forEach((c) => {
        if (c && c.id && !allowed.has(c.id)) {
          errors.push(`semester ${idx + 1}: course "${c.id}" is outside the selected program`);
        }
      });
    });
  }

  if (requiredIds.length > 0) {
    const { completedSet } = normalizeInputs(courses, completedInput);
    const planned = new Set();
    plan.forEach((sem) => {
      ((sem && sem.courses) || []).forEach((c) => {
        if (c && c.id) planned.add(c.id);
      });
    });
    const unplanned = new Set(unplannedIds);
    requiredIds.forEach((id) => {
      if (!completedSet.has(id) && !planned.has(id) && !unplanned.has(id)) {
        errors.push(`required course "${id}" is neither planned, completed, nor reported unplanned`);
      }
    });
  }

  return { valid: errors.length === 0, errors };
}

module.exports = { normalizeInputs, validatePlan, findUnplanned, checkTriviallyImpossible, validateTimeline };
