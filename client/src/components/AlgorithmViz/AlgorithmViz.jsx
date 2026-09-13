import { useState, useEffect, useRef } from 'react';
import { useApp } from '../../store/AppContext';
import { runAlgorithm } from '../../utils/api';

const ALGORITHMS = [
  { id: 'bfs',   label: 'BFS',  full: 'Breadth-First Search',  color: '#00ffff', desc: 'Explores level by level — aims for fewer semesters' },
  { id: 'dfs',   label: 'DFS',  full: 'Depth-First Search',    color: '#0088ff', desc: 'Deep-dives prerequisite chains before branching' },
  { id: 'ucs',   label: 'UCS',  full: 'Uniform Cost Search',   color: '#00ff88', desc: 'Expands lowest-difficulty states first (cost-aware)' },
  { id: 'astar', label: 'A*',   full: 'A* Search',             color: '#ffff00', desc: 'Heuristic search: f(n) = g(n) + h(n), critical-path estimate' },
  { id: 'csp',   label: 'CSP',  full: 'Constraint Satisfaction',color: '#ff8800', desc: 'Backtracking with MRV + LCV heuristics' },
];

const GOALS = ['fastest', 'easiest', 'balanced', 'specialization'];
const STEP_COLORS = { SCHEDULE:'#00ff88', DEFER:'#ff8800', DEADLOCK:'#ff0044', ASTAR_GOAL:'#ffff00', CSP_SUCCESS:'#00ff88', CSP_UNDO:'#ff0088', DFS_VISIT:'#0088ff', UCS_ENQUEUE:'#00ffff' };

export default function AlgorithmViz() {
  const { courses, completedCourseIds, constraints, notify } = useApp();
  const [selectedAlg, setSelectedAlg] = useState('bfs');
  const [selectedGoal, setSelectedGoal] = useState('fastest');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(300);
  const intervalRef = useRef(null);
  const stepsRef = useRef([]);

  const alg = ALGORITHMS.find(a => a.id === selectedAlg);

  const handleRun = async () => {
    if (!courses.length) return notify('Load a dataset first', 'error');
    setLoading(true);
    setResult(null);
    setCurrentStep(-1);
    setPlaying(false);
    try {
      const res = await runAlgorithm(selectedAlg, selectedGoal, constraints, completedCourseIds);
      setResult(res.data);
      stepsRef.current = res.data.steps || [];
      notify(`✅ ${selectedAlg.toUpperCase()} complete — ${res.data.totalSemesters} semesters, ${res.data.nodesExplored?.length || 0} nodes explored`, 'success');
    } catch (err) {
      notify(err.response?.data?.error || 'Algorithm failed', 'error');
    }
    setLoading(false);
  };

  const startPlayback = () => {
    if (!stepsRef.current.length) return;
    setPlaying(true);
    setCurrentStep(0);
    intervalRef.current = setInterval(() => {
      setCurrentStep(prev => {
        if (prev >= stepsRef.current.length - 1) {
          setPlaying(false);
          clearInterval(intervalRef.current);
          return prev;
        }
        return prev + 1;
      });
    }, speed);
  };

  const stopPlayback = () => {
    setPlaying(false);
    clearInterval(intervalRef.current);
  };

  useEffect(() => () => clearInterval(intervalRef.current), []);

  const steps = result?.steps || [];
  const visibleSteps = currentStep >= 0 ? steps.slice(0, currentStep + 1) : [];

  // Nodes explored count at current step
  const exploredCount = visibleSteps.filter(s =>
    ['EXPLORE_FRONTIER','DFS_VISIT','UCS_DEQUEUE','ASTAR_EXPAND','CSP_BACKTRACK'].includes(s.action)
  ).length;

  const scheduledCount = visibleSteps.filter(s => s.action === 'SCHEDULE').length;

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      {/* Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Algorithm selector */}
        <div className="tron-card p-4">
          <div className="text-[10px] text-cyan-600 font-mono uppercase tracking-widest mb-3">Select Algorithm</div>
          <div className="space-y-2">
            {ALGORITHMS.map(a => (
              <button key={a.id}
                onClick={() => setSelectedAlg(a.id)}
                className={`w-full text-left p-3 rounded border transition-all
                  ${selectedAlg === a.id
                    ? 'border-current bg-current/10'
                    : 'border-cyan-900/30 hover:border-cyan-700/40'}`}
                style={{ borderColor: selectedAlg === a.id ? a.color : undefined, color: selectedAlg === a.id ? a.color : '#8ab8cc' }}>
                <div className="flex items-center gap-3">
                  <span className="w-10 text-xs font-bold font-mono" style={{ color: a.color }}>{a.label}</span>
                  <div>
                    <div className="text-xs font-mono">{a.full}</div>
                    <div className="text-[10px] opacity-70 font-mono">{a.desc}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Settings + run */}
        <div className="space-y-4">
          <div className="tron-card p-4">
            <div className="text-[10px] text-cyan-600 font-mono uppercase tracking-widest mb-3">Optimization Goal</div>
            <div className="grid grid-cols-2 gap-2">
              {GOALS.map(g => (
                <button key={g} onClick={() => setSelectedGoal(g)}
                  className={`py-2 px-3 rounded border text-xs font-mono uppercase tracking-wider transition-all
                    ${selectedGoal === g
                      ? 'border-cyan-400 bg-cyan-400/10 text-cyan-300'
                      : 'border-cyan-900/30 text-cyan-700 hover:border-cyan-700'}`}>
                  {g}
                </button>
              ))}
            </div>
          </div>

          {/* Stats */}
          {result && (
            <div className="tron-card p-4 grid grid-cols-3 gap-3">
              {[
                { label: 'Semesters', value: result.totalSemesters, color: '#00ffff' },
                { label: 'Explored', value: result.nodesExplored?.length || 0, color: '#0088ff' },
                { label: 'Time (ms)', value: result.executionTimeMs || 0, color: '#00ff88' },
              ].map(s => (
                <div key={s.label} className="text-center">
                  <div className="text-xl font-bold font-mono" style={{ color: s.color }}>{s.value}</div>
                  <div className="text-[10px] text-cyan-700 font-mono uppercase">{s.label}</div>
                </div>
              ))}
            </div>
          )}

          <button onClick={handleRun} disabled={loading}
            className="btn-neon btn-neon-solid w-full py-3 text-sm"
            style={{ borderColor: alg?.color, color: alg?.color }}>
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin">◌</span> RUNNING {selectedAlg.toUpperCase()}...
              </span>
            ) : `▶ RUN ${alg?.label} ALGORITHM`}
          </button>
        </div>
      </div>

      {/* Visualization */}
      {result && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Step-by-step playback */}
          <div className="tron-card p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[10px] text-cyan-600 font-mono uppercase tracking-widest">
                Step Trace ({steps.length} steps)
              </div>
              <div className="flex items-center gap-2">
                <select value={speed} onChange={e => setSpeed(+e.target.value)}
                  className="tron-select text-[10px] py-1 px-2 w-24">
                  <option value={600}>Slow</option>
                  <option value={300}>Normal</option>
                  <option value={100}>Fast</option>
                  <option value={30}>Turbo</option>
                </select>
                {!playing ? (
                  <button onClick={startPlayback} disabled={!steps.length}
                    className="btn-neon text-[10px] py-1 px-3">▶ PLAY</button>
                ) : (
                  <button onClick={stopPlayback} className="btn-neon btn-neon-pink text-[10px] py-1 px-3">■ STOP</button>
                )}
                <button onClick={() => { setCurrentStep(-1); setPlaying(false); }} className="btn-neon text-[10px] py-1 px-2">↺</button>
              </div>
            </div>

            {/* Progress */}
            <div className="neon-bar-track mb-3">
              <div className="neon-bar transition-all duration-300" style={{
                width: steps.length > 0 ? `${((currentStep + 1) / steps.length) * 100}%` : '0%'
              }} />
            </div>
            <div className="text-[10px] font-mono text-cyan-600 mb-3 flex gap-4">
              <span>Step: {Math.max(0, currentStep + 1)}/{steps.length}</span>
              <span className="text-blue-400">Explored: {exploredCount}</span>
              <span className="text-green-400">Scheduled: {scheduledCount}</span>
            </div>

            {/* Steps list */}
            <div className="space-y-0.5 max-h-64 overflow-y-auto pr-1">
              {visibleSteps.slice(-30).map((step, i) => (
                <div key={i}
                  className={`step-item ${i === visibleSteps.length - 1 ? 'active' : ''}
                    ${step.action === 'SCHEDULE' ? 'schedule' : ''}
                    ${step.action === 'DEFER' ? 'defer' : ''}
                    ${['CSP_UNDO','CSP_FAILED'].includes(step.action) ? 'backtrack' : ''}
                    ${['ASTAR_GOAL','CSP_SUCCESS'].includes(step.action) ? 'goal' : ''}`}>
                  <span className="text-[9px] opacity-50 mr-2">[{step.action}]</span>
                  {step.message}
                </div>
              ))}
              {currentStep === -1 && (
                <div className="text-center text-cyan-800 font-mono text-xs pt-8">
                  Press PLAY to animate algorithm steps
                </div>
              )}
            </div>
          </div>

          {/* Semester result */}
          <div className="tron-card p-4">
            <div className="text-[10px] text-cyan-600 font-mono uppercase tracking-widest mb-3">
              Generated Plan — {result.totalSemesters} Semesters
            </div>
            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
              {(result.semesterPlan || []).map((sem, i) => (
                <div key={i} className={`pl-3 semester-${(i % 8) + 1}`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold font-mono text-cyan-300">
                      Semester {sem.semester}
                    </span>
                    <div className="flex gap-2 text-[10px] font-mono">
                      <span className="text-cyan-600">{sem.totalCredits} credits</span>
                      {sem.hardCourseCount > 0 && (
                        <span className="text-orange-400">{sem.hardCourseCount} hard</span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(sem.courses || []).map(c => (
                      <span key={c.id} className="tag tag-cyan text-[9px] py-0.5 px-2">
                        {c.name?.length > 18 ? c.name.slice(0,17)+'…' : c.name}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Nodes explored visualization */}
      {result?.nodesExplored?.length > 0 && (
        <div className="tron-card p-4">
          <div className="text-[10px] text-cyan-600 font-mono uppercase tracking-widest mb-3">
            ◉ Nodes Explored ({result.nodesExplored.length})
          </div>
          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
            {result.nodesExplored.slice(0, 60).map((nodeId, i) => (
              <span key={`${nodeId}-${i}`}
                className="text-[9px] font-mono px-2 py-0.5 rounded border border-cyan-900/40 text-cyan-600"
                style={{
                  animationDelay: `${i * 50}ms`,
                  background: 'rgba(0,255,255,0.04)',
                }}>
                {nodeId}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
