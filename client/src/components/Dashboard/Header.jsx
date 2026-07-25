import { useApp } from '../../store/AppContext';

const TAB_LABELS = {
  dashboard: 'SYSTEM DASHBOARD',
  courses: 'COURSE MANAGER',
  graph: 'PREREQUISITE GRAPH',
  algorithm: 'ALGORITHM VISUALIZER',
  timeline: 'SEMESTER TIMELINE',
  compare: 'ALGORITHM COMPARISON',
  agent: 'INTELLIGENT AGENT',
  whatif: 'WHAT-IF SIMULATOR',
};

export default function Header() {
  const { activeTab, courses, completedCourseIds, loadSample, refreshGraph, dispatch, loadingCourses, applyDefaultSetup } = useApp();

  const handleLoadSample = async () => {
    await loadSample();
    await refreshGraph();
  };

  const handleDefaultSetup = async () => {
    await applyDefaultSetup(courses);
  };

  return (
    <header className="border-b border-cyan-900/40 bg-black/40 backdrop-blur-md px-6 py-3 flex items-center justify-between flex-shrink-0">
      {/* Page title */}
      <div>
        <h1 className="text-sm font-bold tracking-widest text-cyan-300" style={{ fontFamily: 'Orbitron' }}>
          {TAB_LABELS[activeTab] || 'PATHAI'}
        </h1>
        <div className="flex items-center gap-3 mt-0.5">
          <div className="flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${courses.length > 0 ? 'bg-green-400 animate-pulse' : 'bg-red-500'}`} />
            <span className="text-[10px] text-cyan-600 font-mono">
              {courses.length > 0 ? `${courses.length} COURSES LOADED` : 'NO DATA'}
            </span>
          </div>
          {completedCourseIds.length > 0 && (
            <span className="text-[10px] text-cyan-700 font-mono">
              · {completedCourseIds.length} COMPLETED
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        {/* Status indicator */}
        <div className="hidden sm:flex items-center gap-2 text-[10px] font-mono text-cyan-700">
          <span>SYS:</span>
          <span className="text-cyan-400">ONLINE</span>
        </div>

        <div className="w-px h-5 bg-cyan-900/60" />

        <button
          onClick={handleLoadSample}
          disabled={loadingCourses}
          className="btn-neon text-[10px] py-1.5 px-3 flex items-center gap-1.5"
        >
          {loadingCourses ? (
            <span className="animate-pulse">LOADING...</span>
          ) : (
            <>
              <span>⟳</span>
              <span>LOAD DATASET</span>
            </>
          )}
        </button>

        <button
          onClick={handleDefaultSetup}
          disabled={loadingCourses}
          className="btn-neon btn-neon-solid text-[10px] py-1.5 px-3"
        >
          DEFAULT SETUP
        </button>

        <button
          onClick={() => dispatch({ type: 'SET_TAB', payload: 'courses' })}
          className="btn-neon btn-neon-solid text-[10px] py-1.5 px-3"
        >
          + ADD COURSE
        </button>
      </div>
    </header>
  );
}
