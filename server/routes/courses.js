/**
 * Course CRUD Routes
 * GET  /api/courses           - list all courses
 * POST /api/courses           - add a course
 * PUT  /api/courses/:id       - update a course
 * DELETE /api/courses/:id     - remove a course
 * GET  /api/courses/sample      - get sample dataset
 * POST /api/courses/load-sample - load sample dataset into active store
 * POST /api/courses/load-default - load default degree-track dataset
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { sampleCourses } = require('../data/sampleCourses');
const { buildDefaultTrack } = require('../utils/defaultTrack');

// In-memory store (shared via module-level ref)
let courseStore = [];

// ── GET /api/courses/sample ──────────────────────────────────
router.get('/sample', (req, res) => {
  res.json({ courses: sampleCourses, count: sampleCourses.length });
});

// ── POST /api/courses/load-sample ────────────────────────────
router.post('/load-sample', (req, res) => {
  courseStore = sampleCourses.map(c => ({ ...c }));
  res.json({ message: 'Sample dataset loaded', count: courseStore.length, courses: courseStore });
});

// ── POST /api/courses/load-default ──────────────────────────
router.post('/load-default', (req, res) => {
  const defaultCourses = buildDefaultTrack(sampleCourses);
  courseStore = defaultCourses.map(c => ({ ...c }));
  res.json({
    message: 'Default degree-track dataset loaded',
    count: courseStore.length,
    courses: courseStore
  });
});

// ── GET /api/courses ──────────────────────────────────────────
router.get('/', (req, res) => {
  res.json({ courses: courseStore, count: courseStore.length });
});

// ── POST /api/courses ─────────────────────────────────────────
router.post('/', (req, res) => {
  const { name, credits, difficulty, tags, prerequisites } = req.body;

  if (!name || !credits || !difficulty) {
    return res.status(400).json({ error: 'name, credits, and difficulty are required' });
  }

  // Validate prerequisites exist
  const invalidPrereqs = (prerequisites || []).filter(
    prereqId => !courseStore.find(c => c.id === prereqId)
  );
  if (invalidPrereqs.length > 0) {
    return res.status(400).json({
      error: `Prerequisites not found: ${invalidPrereqs.join(', ')}`
    });
  }

  // Cycle detection: ensure adding this wouldn't create a cycle
  const newId = 'c_' + uuidv4().slice(0, 8);
  const tempStore = [
    ...courseStore,
    { id: newId, name, credits, difficulty, tags: tags || [], prerequisites: prerequisites || [] }
  ];

  const { topologicalSort } = require('../utils/graphUtils');
  if (!topologicalSort(tempStore)) {
    return res.status(400).json({ error: 'Adding this course would create a cyclic prerequisite dependency' });
  }

  const newCourse = {
    id: newId,
    name,
    credits: parseInt(credits),
    difficulty: parseInt(difficulty),
    tags: tags || [],
    prerequisites: prerequisites || [],
    color: '#00ffff',
    createdAt: new Date().toISOString()
  };

  courseStore.push(newCourse);
  res.status(201).json({ course: newCourse });
});

// ── PUT /api/courses/:id ──────────────────────────────────────
router.put('/:id', (req, res) => {
  const idx = courseStore.findIndex(c => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Course not found' });

  const updated = { ...courseStore[idx], ...req.body, id: req.params.id };
  courseStore[idx] = updated;
  res.json({ course: updated });
});

// ── DELETE /api/courses/:id ───────────────────────────────────
router.delete('/:id', (req, res) => {
  const id = req.params.id;

  // Check if other courses depend on this
  const dependents = courseStore.filter(c => c.prerequisites.includes(id));
  if (dependents.length > 0) {
    return res.status(400).json({
      error: `Cannot delete: ${dependents.length} course(s) depend on this`,
      dependents: dependents.map(c => c.name)
    });
  }

  const idx = courseStore.findIndex(c => c.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Course not found' });

  courseStore.splice(idx, 1);
  res.json({ message: 'Course deleted' });
});

// ── POST /api/courses/clear ───────────────────────────────────
router.post('/clear', (req, res) => {
  courseStore = [];
  res.json({ message: 'Course store cleared' });
});

// Export store accessor for other routes
router.getCourseStore = () => courseStore;
router.setCourseStore = (courses) => { courseStore = courses; };

module.exports = router;
