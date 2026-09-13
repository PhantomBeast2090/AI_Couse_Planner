/**
 * Shared fixtures and assertions for planner tests (node:test).
 *
 * Every planner is judged by the same rules via planValidator, so tests
 * assert behavior — prerequisite validity, constraint respect, safe failure —
 * not implementation details.
 */
'use strict';

const assert = require('node:assert/strict');
const { validatePlan } = require('../utils/planValidator');

function mkCourse(id, prerequisites = [], overrides = {}) {
  return {
    id,
    name: id,
    credits: 3,
    difficulty: 2,
    tags: [],
    prerequisites: [...prerequisites],
    ...overrides,
  };
}

const DEFAULT_CONSTRAINTS = {
  maxCredits: 18,
  maxHardCourses: 2,
  maxCoursesPerSemester: 5,
  maxSemesters: 10,
};

function setOf(ids) {
  return new Set(ids || []);
}

/** All course ids that should be scheduled (not pre-completed). */
function expectedPlannedIds(courses, completed) {
  const done = completed instanceof Set ? completed : new Set(completed || []);
  return courses.map((c) => c.id).filter((id) => !done.has(id)).sort();
}

function plannedIds(result) {
  return (result.semesterPlan || []).flatMap((s) => s.courses.map((c) => c.id)).sort();
}

/**
 * Assert a successful result: every expected course planned exactly once,
 * prerequisites ordered, constraints respected.
 */
function assertSuccessfulPlan(result, courses, completed, constraints = DEFAULT_CONSTRAINTS) {
  assert.strictEqual(result.success, true, `expected success, got error: ${result.error}`);
  assert.deepStrictEqual(plannedIds(result), expectedPlannedIds(courses, completed));
  const { valid, errors } = validatePlan(result.semesterPlan, courses, completed, constraints);
  assert.strictEqual(valid, true, `plan invalid: ${errors.join('; ')}`);
}

/** Assert safe failure: flagged as failure with an error, never silent. */
function assertFailedSafely(result) {
  assert.strictEqual(result.success, false, 'expected success=false for unsatisfiable input');
  assert.ok(result.error, 'expected an error message');
  assert.ok(
    (result.unplanned || []).length > 0 || (result.semesterPlan || []).length === 0,
    'failed results must report unplanned courses or an empty plan'
  );
}

/**
 * Assert that a failed result carries no misleading partial plan: when a
 * partial prefix is returned it must itself be prerequisite-valid.
 */
function assertFailurePrefixValid(result, courses, completed, constraints = DEFAULT_CONSTRAINTS) {
  const plan = result.semesterPlan || [];
  if (plan.length === 0) return;
  const { valid, errors } = validatePlan(plan, courses, completed, constraints);
  assert.strictEqual(valid, true, `failure prefix must still be valid: ${errors.join('; ')}`);
}

module.exports = {
  mkCourse,
  DEFAULT_CONSTRAINTS,
  setOf,
  plannedIds,
  expectedPlannedIds,
  assertSuccessfulPlan,
  assertFailedSafely,
  assertFailurePrefixValid,
};
