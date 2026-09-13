/**
 * PathAI API Client
 * All calls to the Express backend (port 5000)
 */
import axios from 'axios';

const BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5050/api';

const api = axios.create({
  baseURL: BASE,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// ── Courses ────────────────────────────────────────────────
export const getCourses       = ()          => api.get('/courses');
export const getSampleCourses = ()          => api.get('/courses/sample');
export const loadSampleData   = ()          => api.post('/courses/load-sample');
export const loadDefaultData  = ()          => api.post('/courses/load-default');
export const addCourse        = (data)      => api.post('/courses', data);
export const updateCourse     = (id, data)  => api.put(`/courses/${id}`, data);
export const deleteCourse     = (id)        => api.delete(`/courses/${id}`);
export const clearCourses     = ()          => api.post('/courses/clear');

// ── Planning ───────────────────────────────────────────────
export const runAlgorithm = (algorithm, goal, constraints, completedIds) =>
  api.post('/planning/run', { algorithm, goal, constraints, completedCourseIds: completedIds });

export const compareAlgorithms = (algorithmA, algorithmB, goal, constraints, completedIds) =>
  api.post('/planning/compare', { algorithmA, algorithmB, goal, constraints, completedCourseIds: completedIds });

export const runAgent = (goal, constraints, completedIds, specializationTags) =>
  api.post('/planning/agent', { goal, constraints, completedCourseIds: completedIds, specializationTags });

export const getGraphData = () => api.get('/planning/graph');

export const getPrograms = () => api.get('/programs');

export const runDegreePlan = (programId, goal, constraints, completedIds, specializationTags) =>
  api.post('/planning/degree', { programId, goal, constraints, completedCourseIds: completedIds, specializationTags });

// ── Simulation ─────────────────────────────────────────────
export const simulateFailCourse = (failedCourseId, completedIds, goal, constraints) =>
  api.post('/simulation/fail-course', { failedCourseId, completedCourseIds: completedIds, goal, constraints });

export const simulateComplete = (completedIds, goal, constraints) =>
  api.post('/simulation/complete', { completedCourseIds: completedIds, goal, constraints });

export const simulateWhatIf = (payload) =>
  api.post('/simulation/what-if', payload);

// ── Health ─────────────────────────────────────────────────
export const getHealth = () => api.get('/health');

export default api;
