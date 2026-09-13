import { useState } from 'react';
import { useApp, buildSelection, hasSelection } from '../../store/AppContext';
import { simulateFailCourse, simulateComplete } from '../../utils/api';
import ScopePicker, { ScopeLine } from '../shared/ScopePicker';

const SEM_COLORS = ['#00ffff','#0088ff','#00ff88','#ffff00','#ff8800','#ff0088','#aa44ff','#00ffaa'];

export default function WhatIfSimulator() {
  const { courses, completedCourseIds, constraints, notify, selectedProgramId, targetCourseId } = useApp();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [activeTab, setActiveTab] = useState('fail');

  // Form states
  const [failCourseId, setFailCourseId] = useState('');
  const [simCompletedIds, setSimCompletedIds] = useState([]);
  const [completeSelectId, setCompleteSelectId] = useState('');

  // Auto-fill defaults
  const availableToFail = courses.filter(c => !completedCourseIds.includes(c.id));
  const availableToComplete = courses.filter(c => !completedCourseIds.includes(c.id));
  const courseMap = Object.fromEntries(courses.map(c => [c.id, c]));

  const selection = buildSelection({ selectedProgramId, targetCourseId });
  const selectionReady = hasSelection({ selectedProgramId, targetCourseId });

  const handleFailSimulation = async () => {
    if (!failCourseId) return notify('Select a course to fail', 'error');
    if (!selectionReady) return notify('Select a program or target course first', 'error');
    setLoading(true);
    try {
      const res = await simulateFailCourse(failCourseId, completedCourseIds, 'balanced', constraints, selection);
      setResult(res.data);
      notify(`Simulated failing: ${res.data.failedCourse?.name}`, 'info');
    } catch (err) {
      notify(err.response?.data?.error || 'Simulation failed', 'error');
    }
    setLoading(false);
  };

  const handleCompleteSimulation = async () => {
    if (simCompletedIds.length === 0) return notify('Select courses to complete', 'error');
    if (!selectionReady) return notify('Select a program or target course first', 'error');
    setLoading(true);
    try {
      const mergedCompleted = [...new Set([...completedCourseIds, ...simCompletedIds])];
      const res = await simulateComplete(mergedCompleted, 'balanced', constraints, selection);
      setResult(res.data);
      notify(`Simulated completing ${simCompletedIds.length} extra courses`, 'success');
    } catch (err) {
      notify(err.response?.data?.error || 'Simulation failed', 'error');
    }
    setLoading(false);
  };

  const toggleSimComplete = (id) => {
    setSimCompletedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const plan = result?.revisedPlan?.semesterPlan || [];

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <ScopePicker />
      {/* Simulation Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Fail Course Simulator */}
        <div className={`tron-card p-5 border-l-2 transition-all ${activeTab === 'fail' ? 'border-l-orange-500' : 'border-l-transparent opacity-70'} cursor-pointer`}
          onClick={() => { setActiveTab('fail'); setResult(null); }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="text-2xl text-orange-500">⚠</div>
            <div>
              <div className="text-sm font-bold text-cyan-300 font-mono">FAIL COURSE SIMULATOR</div>
              <div className="text-[10px] text-cyan-700 font-mono">What happens if I fail a prerequisite?</div>
            </div>
          </div>

          <div className="space-y-3">
            <select className="tron-select w-full" value={failCourseId} onChange={e => setFailCourseId(e.target.value)}
              onClick={e => e.stopPropagation()}>
              <option value="">-- Select a course you might fail --</option>
              {availableToFail.map(c => <option key={c.id} value={c.id}>{c.name} ({c.id})</option>)}
            </select>
            <button onClick={(e) => { e.stopPropagation(); handleFailSimulation(); }} disabled={loading || !failCourseId || !selectionReady}
              className="btn-neon w-full py-2" style={{ color: '#ff8800', borderColor: '#ff8800' }}>
              {loading && activeTab === 'fail' ? 'SIMULATING...' : 'RUN FAIL SIMULATION'}
            </button>
          </div>
        </div>

        {/* Fast-Track Simulator */}
        <div className={`tron-card p-5 border-l-2 transition-all ${activeTab === 'complete' ? 'border-l-green-500' : 'border-l-transparent opacity-70'} cursor-pointer`}
          onClick={() => { setActiveTab('complete'); setResult(null); }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="text-2xl text-green-500">⚡</div>
            <div>
              <div className="text-sm font-bold text-cyan-300 font-mono">FAST-TRACK SIMULATOR</div>
              <div className="text-[10px] text-cyan-700 font-mono">What if I take these extra courses this summer?</div>
            </div>
          </div>

          <div className="space-y-3">
            <select
              className="tron-select w-full"
              value={completeSelectId}
              onChange={e => {
                const id = e.target.value;
                if (!id) return;
                setSimCompletedIds(prev => prev.includes(id) ? prev : [...prev, id]);
                setCompleteSelectId('');
              }}
              onClick={e => e.stopPropagation()}
            >
              <option value="">-- Add a course to complete --</option>
              {availableToComplete.map(c => (
                <option key={c.id} value={c.id}>{c.name} ({c.id})</option>
              ))}
            </select>

            <div className="min-h-12 border border-cyan-900/30 rounded p-2 flex flex-wrap gap-2" onClick={e => e.stopPropagation()}>
              {simCompletedIds.length === 0 && (
                <span className="text-[10px] font-mono text-cyan-700">No courses selected</span>
              )}
              {simCompletedIds.map(id => (
                <div key={id} className="flex items-center gap-1 tag tag-green text-[9px]">
                  <span>{courseMap[id]?.name || id}</span>
                  <button type="button" onClick={() => toggleSimComplete(id)} className="text-red-400 hover:text-red-300 ml-1">✕</button>
                </div>
              ))}
            </div>
            <button onClick={(e) => { e.stopPropagation(); handleCompleteSimulation(); }} disabled={loading || simCompletedIds.length === 0 || !selectionReady}
              className="btn-neon w-full py-2" style={{ color: '#00ff88', borderColor: '#00ff88' }}>
              {loading && activeTab === 'complete' ? 'SIMULATING...' : 'RUN FAST-TRACK SIMULATION'}
            </button>
          </div>
        </div>
      </div>

      {/* Results */}
      {result && (
        <div className="animate-[fadeIn_0.5s_ease]">
          {/* Impact Banner */}
          {result.scenario === 'fail-course' && (
            <div className="tron-card p-4 mb-4 border-l-2 border-l-red-500 bg-red-900/10">
              <h3 className="text-xs font-bold text-red-400 uppercase tracking-widest font-mono mb-2">Simulation Impact</h3>
              <div className="flex gap-6 text-sm font-mono">
                <div>
                  <div className="text-[10px] text-cyan-600">Failed</div>
                  <div className="text-red-300">{result.failedCourse?.name}</div>
                </div>
                <div>
                  <div className="text-[10px] text-cyan-600">Blocked Courses</div>
                  <div className="text-orange-400">{result.impact?.blockedCount}</div>
                </div>
                <div>
                  <div className="text-[10px] text-cyan-600">Estimated Delay</div>
                  <div className="text-red-400">{result.impact?.estimatedDelay}</div>
                </div>
              </div>

              {result.impact?.directlyBlocked?.length > 0 && (
                <div className="mt-3">
                  <div className="text-[9px] text-cyan-700 font-mono mb-1">Directly blocks:</div>
                  <div className="flex flex-wrap gap-1">
                    {result.impact.directlyBlocked.map(b => (
                      <span key={b.id} className="tag tag-orange text-[9px]">{b.name}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {result.scenario === 'complete' && (
            <div className="tron-card p-4 mb-4 border-l-2 border-l-green-500 bg-green-900/10">
              <h3 className="text-xs font-bold text-green-400 uppercase tracking-widest font-mono mb-2">Fast-Track Impact</h3>
              <div className="flex gap-6 text-[10px] font-mono">
                <div>
                  <div className="text-cyan-600">Total Completed</div>
                  <div className="text-green-300 text-lg">{result.completedCount}</div>
                </div>
                <div>
                  <div className="text-cyan-600">Remaining</div>
                  <div className="text-cyan-300 text-lg">{result.remainingCount}</div>
                </div>
                <div>
                  <div className="text-cyan-600">Progress</div>
                  <div className="text-green-400 text-lg">{result.progressPercent}%</div>
                </div>
              </div>
            </div>
          )}

          {/* Revised Timeline */}
          <div className="tron-card p-5">
            <div className="flex justify-between items-center mb-1">
              <div className="text-[10px] text-cyan-600 font-mono uppercase tracking-widest">
                Revised Optimal Timeline
              </div>
              <div className="text-xs font-mono text-cyan-300">
                {result.revisedPlan?.totalSemesters || 0} semesters
              </div>
            </div>
            <div className="mb-4"><ScopeLine scope={result.revisedPlan?.scope || result.scope} /></div>

            {plan.length > 0 ? (
              <div className="space-y-3">
                {plan.map((sem, i) => (
                  <div key={i} className="pl-3" style={{ borderLeft: `2px solid ${SEM_COLORS[i % SEM_COLORS.length]}` }}>
                    <div className="flex justify-between text-[11px] font-mono mb-1.5" style={{ color: SEM_COLORS[i % SEM_COLORS.length] }}>
                      <span>Semester {sem.semester}</span>
                      <span className="opacity-70">{sem.totalCredits} credits</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {(sem.courses || []).map(c => (
                        <span key={c.id} className="text-[9px] font-mono px-2 py-0.5 rounded border transition-all hover:bg-cyan-900/20
                          border-cyan-900/40 text-cyan-400">
                          {c.name}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-cyan-700 font-mono text-xs">
                {result.scenario === 'complete' ? 'All courses completed! 🎉' : 'No valid plan found'}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
