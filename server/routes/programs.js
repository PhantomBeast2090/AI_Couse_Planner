/**
 * Degree Program Routes
 * GET  /api/programs - list available degree programs
 */
const express = require('express');
const router = express.Router();
const { listPrograms } = require('../data/programs');

router.get('/', (req, res) => {
  res.json({ programs: listPrograms(), count: listPrograms().length });
});

module.exports = router;
