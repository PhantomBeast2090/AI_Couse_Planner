/**
 * Build a realistic 8-semester degree track (≈45–48 courses).
 * Ensures prerequisites are included to keep the graph valid.
 */

const DEFAULT_TRACK_IDS = [
  // Math foundation
  'math101', 'math102', 'math103', 'math104', 'math201', 'math202', 'math203',

  // Core CS
  'cs101', 'cs102', 'cs201', 'cs202', 'cs301', 'cs302', 'cs303', 'cs304', 'cs305', 'cs306',

  // Systems
  'sys401', 'sys402', 'sys403',

  // AI/ML specialization
  'ai401', 'ai402', 'ai403', 'ai406',
  'ml401', 'ml402', 'ml403', 'ml404',
  'dl501', 'dl502',
  'nlp501', 'cv501', 'rl501',

  // Electives
  'cs103', 'cs203', 'ai405', 'ele101', 'ele201', 'ele202', 'ele302', 'ele305',

  // Projects / Internship
  'cap601', 'cap602', 'cap603',
];

function buildDefaultTrack(sampleCourses) {
  const courseMap = new Map(sampleCourses.map(c => [c.id, c]));
  const selected = new Set(DEFAULT_TRACK_IDS);

  function addPrereqs(id) {
    const course = courseMap.get(id);
    if (!course) return;
    (course.prerequisites || []).forEach(prereqId => {
      if (!selected.has(prereqId)) {
        selected.add(prereqId);
        addPrereqs(prereqId);
      }
    });
  }

  DEFAULT_TRACK_IDS.forEach(addPrereqs);

  return Array.from(selected)
    .map(id => courseMap.get(id))
    .filter(Boolean)
    .sort((a, b) => {
      const aSem = a.recommendedSemester || 0;
      const bSem = b.recommendedSemester || 0;
      if (aSem !== bSem) return aSem - bSem;
      return a.name.localeCompare(b.name);
    });
}

module.exports = { DEFAULT_TRACK_IDS, buildDefaultTrack };
