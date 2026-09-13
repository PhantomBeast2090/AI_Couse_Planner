/**
 * Degree program catalog for the AI Course Planner.
 *
 * ASSUMPTION (documented, not silent): the course dataset carries no
 * degree/program field — courses only have overlapping topic tags (e.g. a
 * course can be both 'CS' and 'AI'), which cannot define a degree. Programs
 * are therefore defined here as explicit required-course id lists against
 * the catalog in server/data/sampleCourses.js.
 *
 * To add or change a degree, edit PROGRAMS below. Every id must exist in the
 * catalog; prerequisite ancestors missing from the list are auto-included by
 * the degree planner and reported (a plan can never skip a prerequisite).
 */

const PROGRAMS = [
  {
    id: 'bsc-cs',
    name: 'BSc Computer Science',
    description: 'Core CS degree: math foundations, programming, algorithms, systems and a capstone.',
    requiredCourseIds: [
      'math101', 'math102', 'math103', 'math201', 'math202', 'math203',
      'cs101', 'cs102', 'cs201', 'cs202', 'cs203', 'cs301', 'cs302', 'cs303', 'cs304',
      'sys401', 'sys402',
      'ds401',
      'ai401',
      'ml401',
      'ele101', 'ele201', 'ele305',
      'cap601',
    ],
  },
  {
    id: 'ai-ml',
    name: 'AI & Machine Learning Specialization',
    description: 'Math-heavy AI track: ML foundations, reasoning, deep learning, NLP and a capstone.',
    requiredCourseIds: [
      'math101', 'math102', 'math103', 'math104', 'math201', 'math202', 'math203', 'math303',
      'cs101', 'cs102', 'cs201', 'cs202', 'cs301', 'cs304',
      'ai401', 'ai402', 'ai403',
      'ml401', 'ml402', 'ml403',
      'dl501', 'dl502',
      'nlp501',
      'cap601',
    ],
  },
  {
    id: 'data-science',
    name: 'Data Science',
    description: 'Data track: statistics, databases, ML and data engineering foundations.',
    requiredCourseIds: [
      'math101', 'math102', 'math201', 'math202', 'math203',
      'cs101', 'cs102', 'cs201', 'cs202', 'cs301', 'cs303',
      'ml401', 'ml402',
      'ds401', 'ds402', 'ds403', 'ds404',
      'ele101', 'ele302',
    ],
  },
];

/** Hard product limits for every degree timeline. */
const DEGREE_LIMITS = {
  maxSemesters: 8,
  maxCoursesPerSemester: 8,
};

function listPrograms() {
  return PROGRAMS.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    requiredCourses: p.requiredCourseIds.length,
    maxSemesters: DEGREE_LIMITS.maxSemesters,
    maxCoursesPerSemester: DEGREE_LIMITS.maxCoursesPerSemester,
  }));
}

function getProgram(programId) {
  return PROGRAMS.find((p) => p.id === programId) || null;
}

/**
 * Resolve the plannable course set for a program against a catalog.
 * Returns { eligible, autoIncluded, missingRequired } where eligible already
 * contains the prerequisite closure (required + auto-included ancestors).
 */
function buildEligibleSet(program, catalog) {
  const catalogMap = new Map((catalog || []).map((c) => [c.id, c]));
  const eligible = new Map();
  const autoIncluded = [];
  const missingRequired = [];

  const addWithAncestors = (id, isRequired) => {
    const course = catalogMap.get(id);
    if (!course) {
      if (isRequired) missingRequired.push(id);
      return;
    }
    if (eligible.has(id)) return;
    (course.prerequisites || []).forEach((p) => addWithAncestors(p, false));
    eligible.set(id, course);
    if (!isRequired) autoIncluded.push(id);
  };

  program.requiredCourseIds.forEach((id) => addWithAncestors(id, true));

  return { eligible: [...eligible.values()], autoIncluded, missingRequired };
}

module.exports = { PROGRAMS, DEGREE_LIMITS, listPrograms, getProgram, buildEligibleSet };
