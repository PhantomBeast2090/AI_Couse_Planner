/**
 * PathAI Server Entry Point
 * Node.js + Express API for Intelligent Academic Course Path Optimizer
 */

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const coursesRouter = require('./routes/courses');
const planningRouter = require('./routes/planning');
const simulationRouter = require('./routes/simulation');
const { sampleCourses } = require('./data/sampleCourses');

const app = express();
const PORT = process.env.PORT || 5050;

// ── Middleware ────────────────────────────────────────────────
app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (/^https?:\/\/localhost(:\d+)?$/.test(origin) || /^https?:\/\/127\.0\.0\.1(:\d+)?$/.test(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

// ── Auto-load sample dataset on startup ──────────────────────
coursesRouter.setCourseStore(sampleCourses.map(c => ({ ...c })));
console.log(`✅ Auto-loaded ${sampleCourses.length} courses from sample dataset`);

// ── Routes ────────────────────────────────────────────────────
app.use('/api/courses', coursesRouter);
app.use('/api/planning', planningRouter);
app.use('/api/simulation', simulationRouter);

// ── Health check ──────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'PathAI',
    version: '1.0.0',
    coursesLoaded: coursesRouter.getCourseStore().length,
    timestamp: new Date().toISOString()
  });
});

// ── 404 handler ────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// ── Error handler ──────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

// ── Start server ──────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 PathAI server running at http://localhost:${PORT}`);
  console.log(`   API docs: http://localhost:${PORT}/api/health`);
  console.log(`   Courses:  http://localhost:${PORT}/api/courses`);
  console.log(`   Graph:    http://localhost:${PORT}/api/planning/graph\n`);
});

module.exports = app;
