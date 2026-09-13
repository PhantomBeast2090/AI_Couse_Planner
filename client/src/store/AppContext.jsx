/* eslint-disable react-refresh/only-export-components */
/**
 * AppContext — Global State Management for PathAI
 * Stores courses, plan results, UI state & constraint settings
 */
import { createContext, useContext, useReducer, useCallback } from 'react';
import { getCourses, loadSampleData, loadDefaultData, getGraphData, runAlgorithm, runAgent } from '../utils/api';

// ── Initial State ──────────────────────────────────────────
const initialState = {
  // Courses
  courses: [],
  coursesLoaded: false,
  loadingCourses: false,

  // Graph data
  graphData: { nodes: [], edges: [], stats: {} },
  graphLoaded: false,

  // Planning results
  currentPlan: null,
  planLoading: false,
  planError: null,

  // Comparison mode
  comparisonResult: null,
  comparisonLoading: false,

  // Agent
  agentResult: null,
  agentLoading: false,

  // Simulation
  simulationResult: null,
  simulationLoading: false,

  // User settings
  completedCourseIds: [],
  constraints: {
    maxCredits: 18,
    maxHardCourses: 2,
    maxCoursesPerSemester: 5,
    maxSemesters: 10,
  },
  selectedGoal: 'balanced',
  selectedAlgorithm: 'bfs',
  specializationTags: [],

  // Planning scope — single source of truth for what gets planned/graphed.
  // Exactly one of the two may be set; every planning call sends it and the
  // backend resolves the authoritative scope (never the full catalog).
  selectedProgramId: null,
  targetCourseId: null,

  // UI
  activeTab: 'dashboard',
  notification: null,
  datasetVersion: 'sample', // 'sample' | 'default' | 'custom'
};

// ── Default Setup Helper ──────────────────────────────────
function buildDefaultCompletedCourses(courses, range = { min: 10, max: 14 }) {
  if (!Array.isArray(courses) || courses.length === 0) return [];

  const total = courses.length;
  const minTarget = Math.min(range.min ?? 10, total);
  const maxTarget = Math.min(range.max ?? 14, total);
  const target = Math.max(4, Math.floor(minTarget + Math.random() * (maxTarget - minTarget + 1)));

  const completed = new Set();

  const getAvailable = () => courses.filter(c =>
    !completed.has(c.id) &&
    (c.prerequisites || []).every(p => completed.has(p))
  );

  let available = getAvailable();
  let safety = total * 2;

  while (completed.size < target && available.length > 0 && safety-- > 0) {
    const pick = available[Math.floor(Math.random() * available.length)];
    completed.add(pick.id);
    available = getAvailable();
  }

  return Array.from(completed);
}

// ── Reducer ────────────────────────────────────────────────
function reducer(state, action) {
  switch (action.type) {
    case 'SET_COURSES':
      return { ...state, courses: action.payload, coursesLoaded: true, loadingCourses: false };
    case 'SET_LOADING_COURSES':
      return { ...state, loadingCourses: action.payload };
    case 'ADD_COURSE':
      return { ...state, courses: [...state.courses, action.payload] };
    case 'UPDATE_COURSE':
      return {
        ...state,
        courses: state.courses.map(c => c.id === action.payload.id ? action.payload : c)
      };
    case 'DELETE_COURSE':
      return { ...state, courses: state.courses.filter(c => c.id !== action.payload) };

    case 'SET_GRAPH_DATA':
      return { ...state, graphData: action.payload, graphLoaded: true };

    case 'SET_PLAN':
      return { ...state, currentPlan: action.payload, planLoading: false, planError: null };
    case 'SET_PLAN_LOADING':
      return { ...state, planLoading: action.payload, planError: null };
    case 'SET_PLAN_ERROR':
      return { ...state, planError: action.payload, planLoading: false };

    case 'SET_COMPARISON':
      return { ...state, comparisonResult: action.payload, comparisonLoading: false };
    case 'SET_COMPARISON_LOADING':
      return { ...state, comparisonLoading: action.payload };

    case 'SET_AGENT_RESULT':
      return { ...state, agentResult: action.payload, agentLoading: false };
    case 'SET_AGENT_LOADING':
      return { ...state, agentLoading: action.payload };

    case 'SET_SIMULATION':
      return { ...state, simulationResult: action.payload, simulationLoading: false };
    case 'SET_SIMULATION_LOADING':
      return { ...state, simulationLoading: action.payload };

    case 'SET_CONSTRAINTS':
      return { ...state, constraints: { ...state.constraints, ...action.payload } };
    case 'SET_GOAL':
      return { ...state, selectedGoal: action.payload };
    case 'SET_ALGORITHM':
      return { ...state, selectedAlgorithm: action.payload };
    case 'TOGGLE_COMPLETED': {
      const id = action.payload;
      const isCompleted = state.completedCourseIds.includes(id);
      return {
        ...state,
        completedCourseIds: isCompleted
          ? state.completedCourseIds.filter(c => c !== id)
          : [...state.completedCourseIds, id]
      };
    }
    case 'SET_COMPLETED':
      return { ...state, completedCourseIds: action.payload };
    case 'SET_SPECIALIZATION_TAGS':
      return { ...state, specializationTags: action.payload };

    // Selection changes invalidate every stale derived result: plans,
    // comparisons, agent output, simulations and graph data belong to the
    // previous scope and must never be shown for the new one.
    case 'SET_PROGRAM':
      return {
        ...state,
        selectedProgramId: action.payload,
        targetCourseId: null,
        currentPlan: null, planError: null,
        comparisonResult: null,
        agentResult: null,
        simulationResult: null,
        graphLoaded: false,
      };
    case 'SET_TARGET_COURSE':
      return {
        ...state,
        targetCourseId: action.payload,
        selectedProgramId: null,
        currentPlan: null, planError: null,
        comparisonResult: null,
        agentResult: null,
        simulationResult: null,
        graphLoaded: false,
      };
    case 'CLEAR_SELECTION':
      return {
        ...state,
        selectedProgramId: null,
        targetCourseId: null,
        currentPlan: null, planError: null,
        comparisonResult: null,
        agentResult: null,
        simulationResult: null,
        graphLoaded: false,
      };

    case 'SET_TAB':
      return { ...state, activeTab: action.payload };
    case 'SET_NOTIFICATION':
      return { ...state, notification: action.payload };
    case 'SET_DATASET_VERSION':
      return { ...state, datasetVersion: action.payload };

    default:
      return state;
  }
}

// ── Selection helpers (pure; the single source of planning truth) ──
// Returns { programId } | { targetCourseId } | null. Null means NO selection
// — callers must block the action, never substitute the full catalog.
export function buildSelection(state) {
  if (state?.selectedProgramId) return { programId: state.selectedProgramId };
  if (state?.targetCourseId) return { targetCourseId: state.targetCourseId };
  return null;
}

export function hasSelection(state) {
  return buildSelection(state) !== null;
}

export function selectionLabel(state) {
  if (state?.selectedProgramId) return `Program: ${state.selectedProgramId}`;
  if (state?.targetCourseId) return `Course: ${state.targetCourseId}`;
  return 'No selection';
}

// ── Context ────────────────────────────────────────────────
const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // ── Actions ──────────────────────────────────────────────

  const notify = useCallback((message, type = 'info') => {
    dispatch({ type: 'SET_NOTIFICATION', payload: { message, type } });
    setTimeout(() => dispatch({ type: 'SET_NOTIFICATION', payload: null }), 4000);
  }, []);

  const loadCourses = useCallback(async () => {
    dispatch({ type: 'SET_LOADING_COURSES', payload: true });
    try {
      const res = await getCourses();
      dispatch({ type: 'SET_COURSES', payload: res.data.courses });
    } catch (err) {
      notify('Failed to load courses: ' + (err.response?.data?.error || err.message), 'error');
      dispatch({ type: 'SET_LOADING_COURSES', payload: false });
    }
  }, [notify]);

  const loadSample = useCallback(async () => {
    dispatch({ type: 'SET_LOADING_COURSES', payload: true });
    try {
      const res = await loadSampleData();
      dispatch({ type: 'SET_COURSES', payload: res.data.courses });
      dispatch({ type: 'SET_DATASET_VERSION', payload: 'sample' });
      notify(`✅ Loaded ${res.data.count} courses from sample dataset`, 'success');
      return res;
    } catch (err) {
      notify('Failed to load sample dataset: ' + (err.response?.data?.error || err.message), 'error');
      dispatch({ type: 'SET_LOADING_COURSES', payload: false });
    }
  }, [notify]);

  const refreshGraph = useCallback(async (selection) => {
    try {
      const res = await getGraphData(selection);
      dispatch({ type: 'SET_GRAPH_DATA', payload: res.data });
    } catch {
      // silently fail for graph
    }
  }, []);

  const runPlan = useCallback(async (algorithm, goal, constraints, completedIds, selection) => {
    dispatch({ type: 'SET_PLAN_LOADING', payload: true });
    try {
      const res = await runAlgorithm(algorithm, goal, constraints, completedIds, selection);
      dispatch({ type: 'SET_PLAN', payload: res.data });
      notify(`✅ ${algorithm.toUpperCase()} plan computed — ${res.data.totalSemesters} semesters`, 'success');
      return res.data;
    } catch (err) {
      const msg = err.response?.data?.error || err.message;
      dispatch({ type: 'SET_PLAN_ERROR', payload: msg });
      notify('Planning failed: ' + msg, 'error');
    }
  }, [notify]);

  const runAgentPlan = useCallback(async (goal, constraints, completedIds, tags, selection) => {
    dispatch({ type: 'SET_AGENT_LOADING', payload: true });
    try {
      const res = await runAgent(goal, constraints, completedIds, tags, selection);
      dispatch({ type: 'SET_AGENT_RESULT', payload: res.data });
      notify(`🤖 Agent selected "${res.data.chosenStrategy}" — ${res.data.totalSemesters} semesters`, 'success');
      return res.data;
    } catch (err) {
      dispatch({ type: 'SET_AGENT_LOADING', payload: false });
      notify('Agent failed: ' + (err.response?.data?.error || err.message), 'error');
    }
  }, [notify]);

  const applyDefaultSetup = useCallback(async () => {
    dispatch({ type: 'SET_LOADING_COURSES', payload: true });
    try {
      const res = await loadDefaultData();
      const source = res?.data?.courses || [];
      if (!source.length) {
        notify('Unable to load default setup. Is the server running?', 'error');
        dispatch({ type: 'SET_LOADING_COURSES', payload: false });
        return null;
      }

      dispatch({ type: 'SET_COURSES', payload: source });
      dispatch({ type: 'SET_DATASET_VERSION', payload: 'default' });
      dispatch({
        type: 'SET_CONSTRAINTS',
        payload: {
          maxCredits: 22,
          maxHardCourses: 2,
          maxCoursesPerSemester: 7,
          maxSemesters: 8,
        }
      });
      dispatch({ type: 'SET_GOAL', payload: 'balanced' });

      const selected = buildDefaultCompletedCourses(source, { min: 10, max: 14 });
      dispatch({ type: 'SET_COMPLETED', payload: selected });

      await refreshGraph();
      notify(`Default setup loaded — ${source.length} courses, ${selected.length} marked completed`, 'success');
      return selected;
    } catch (err) {
      notify('Default setup failed: ' + (err.response?.data?.error || err.message), 'error');
      dispatch({ type: 'SET_LOADING_COURSES', payload: false });
      return null;
    }
  }, [notify, refreshGraph]);

  const value = {
    ...state,
    dispatch,
    notify,
    loadCourses,
    loadSample,
    refreshGraph,
    runPlan,
    runAgentPlan,
    applyDefaultSetup,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
};
