import { useState } from 'react';
import { useApp } from '../../store/AppContext';

const GOALS = ['fastest', 'easiest', 'balanced', 'specialization'];
const ALL_TAGS = ['AI', 'ML', 'DL', 'NLP', 'CV', 'RL', 'CS', 'Math', 'Systems', 'Data', 'DS'];
const SEM_COLORS = ['#00ffff','#0088ff','#00ff88','#ffff00','#ff8800','#ff0088','#aa44ff','#00ffaa'];

export default function AgentPlanner() {
  const { courses, completedCourseIds, constraints, notify, agentResult, agentLoading, runAgentPlan } = useApp();
  const [goal, setGoal] = useState('balanced');
  const [tags, setTags] = useState([]);
  const [activeTab, setActiveTab] = useState('plan');

  const handleRun = async () => {
    if (!courses.length) return notify('Load a dataset first', 'error');
    await runAgentPlan(goal, constraints, completedCourseIds, tags);
    setActiveTab('plan');
  };

  const toggleTag = (t) => setTags(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);

  const result = agentResult;

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      {/* Agent config */}
      <div className="tron-card p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full border border-cyan-400/50 flex items-center justify-center animate-pulse-neon">
            <span className="text-cyan-400 text-sm">◬</span>
          </div>
          <div>
            <div className="text-sm font-bold text-cyan-300 font-mono">INTELLIGENT PLANNING AGENT</div>
            <div className="text-[10px] text-cyan-700 font-mono">Evaluates multiple strategies, picks the highest-utility plan</div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="text-[10px] text-cyan-600 font-mono uppercase tracking-widest mb-2">Optimization Goal</div>
            <div className="grid grid-cols-2 gap-2">
              {GOALS.map(g => (
                <button key={g} onClick={() => setGoal(g)}
                  className={`py-2 px-3 rounded border text-xs font-mono capitalize transition-all
                    ${goal === g ? 'border-cyan-400/60 bg-cyan-400/10 text-cyan-300' : 'border-cyan-900/30 text-cyan-700 hover:border-cyan-700'}`}>
                  {g === 'fastest' && '⚡ '}
                  {g === 'easiest' && '🌿 '}
                  {g === 'balanced' && '⚖ '}
                  {g === 'specialization' && '🎯 '}
                  {g}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-cyan-600 font-mono uppercase tracking-widest mb-2">
              Specialization Tags (for specialization goal)
            </div>
            <div className="flex flex-wrap gap-2">
              {ALL_TAGS.map(t => (
                <button key={t} onClick={() => toggleTag(t)}
                  className={`tag cursor-pointer transition-all ${tags.includes(t) ? 'tag-cyan' : 'tag-gray opacity-50'}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>

        <button onClick={handleRun} disabled={agentLoading}
          className="btn-neon btn-neon-green w-full py-3 text-sm font-mono">
          {agentLoading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="animate-spin">◌</span> AGENT THINKING...
            </span>
          ) : '◬ ACTIVATE INTELLIGENT AGENT'}
        </button>
      </div>

      {result && (
        <>
          {/* Strategy evaluation */}
          <div className="tron-card p-4">
            <div className="text-[10px] text-cyan-600 font-mono uppercase tracking-widest mb-3">
              ⬡ Strategies Evaluated
            </div>
            <div className="space-y-2">
              {(result.allStrategiesEvaluated || []).map((s, i) => {
                const isChosen = s.strategy === result.chosenStrategy;
                const maxScore = Math.max(...(result.allStrategiesEvaluated || []).map(x => x.score));
                const pct = maxScore > 0 ? (s.score / maxScore) * 100 : 0;
                return (
                  <div key={i} className={`p-3 rounded border transition-all
                    ${isChosen ? 'border-green-400/40 bg-green-900/10' : 'border-cyan-900/30'}`}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold font-mono text-cyan-300 uppercase">{s.strategy}</span>
                        {isChosen && <span className="tag tag-green text-[9px]">✓ CHOSEN</span>}
                      </div>
                      <div className="flex gap-4 text-[10px] font-mono text-cyan-600">
                        <span>{s.semesters} sem</span>
                        <span className={isChosen ? 'text-green-400 font-bold' : ''}>{s.score.toFixed(1)} score</span>
                        <span>{s.elapsed}ms</span>
                      </div>
                    </div>
                    <div className="neon-bar-track">
                      <div className="h-1 rounded-full transition-all duration-700"
                        style={{ width: `${pct}%`,
                                 background: isChosen ? '#00ff88' : '#00ffff',
                                 boxShadow: isChosen ? '0 0 8px rgba(0,255,136,0.6)' : 'none' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 flex-wrap">
            {['plan','workload','recommendations','log'].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`btn-neon text-[10px] py-1.5 px-4 ${activeTab === tab ? 'btn-neon-solid' : ''}`}>
                {tab.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Plan */}
          {activeTab === 'plan' && (
            <div className="space-y-3">
              {(result.semesterPlan || []).map((sem, i) => (
                <div key={i} className="tron-card p-4" style={{ borderLeft: `3px solid ${SEM_COLORS[i % SEM_COLORS.length]}` }}>
                  <div className="flex justify-between mb-2">
                    <span className="text-xs font-bold font-mono" style={{ color: SEM_COLORS[i % SEM_COLORS.length] }}>
                      SEMESTER {sem.semester}
                    </span>
                    <span className="text-[10px] text-cyan-700 font-mono">{sem.totalCredits} credits</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(sem.courses || []).map(c => (
                      <span key={c.id} className="tag tag-cyan text-[9px]">{c.name}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Workload analysis */}
          {activeTab === 'workload' && (
            <div className="tron-card p-4">
              <div className="text-[10px] text-cyan-600 font-mono uppercase tracking-widest mb-3">Workload Analysis</div>
              <div className="space-y-3">
                {(result.workloadAnalysis || []).map((w, i) => (
                  <div key={i} className="flex items-center gap-4 p-2 rounded border border-cyan-900/30">
                    <div className="w-16 text-xs font-mono text-cyan-600">SEM {w.semester}</div>
                    <div className="flex-1">
                      <div className="neon-bar-track">
                        <div className="h-1.5 rounded-full" style={{
                          width: `${(w.totalCredits / 21) * 100}%`,
                          background: w.workloadLabel === 'Heavy' ? '#ff0044' : w.workloadLabel === 'Moderate' ? '#ffff00' : '#00ff88',
                        }} />
                      </div>
                    </div>
                    <div className="text-[10px] font-mono text-cyan-500 w-20 text-right">{w.totalCredits} credits</div>
                    <div className="text-[10px] font-mono w-20" style={{
                      color: w.workloadLabel === 'Heavy' ? '#ff0044' : w.workloadLabel === 'Moderate' ? '#ffff00' : '#00ff88'
                    }}>{w.workloadLabel}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommendations */}
          {activeTab === 'recommendations' && (
            <div className="space-y-3">
              {(result.recommendations || []).length > 0 ? (result.recommendations || []).map((r, i) => (
                <div key={i} className={`tron-card p-4 border-l-2
                  ${r.type === 'WARNING' ? 'border-l-orange-400' : r.type === 'TIP' ? 'border-l-cyan-400' : 'border-l-blue-400'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-mono font-bold"
                      style={{ color: r.type === 'WARNING' ? '#ff8800' : r.type === 'TIP' ? '#00ffff' : '#0088ff' }}>
                      {r.type === 'WARNING' ? '⚠' : r.type === 'TIP' ? '💡' : 'ℹ'} {r.type}
                    </span>
                    {r.semester && <span className="text-[10px] font-mono text-cyan-700">Semester {r.semester}</span>}
                  </div>
                  <div className="text-sm text-cyan-300 font-mono">{r.message}</div>
                </div>
              )) : (
                <div className="tron-card p-8 text-center text-cyan-700 font-mono text-sm">
                  ✓ No issues found — plan looks good!
                </div>
              )}
            </div>
          )}

          {/* Agent log */}
          {activeTab === 'log' && (
            <div className="tron-card p-4">
              <div className="text-[10px] text-cyan-600 font-mono uppercase tracking-widest mb-3">Agent Decision Log</div>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {(result.agentLog || []).map((log, i) => (
                  <div key={i} className={`step-item
                    ${log.phase === 'PERCEPTION' ? 'border-l-blue-400' : ''}
                    ${log.phase === 'REASONING' ? 'border-l-cyan-400' : ''}
                    ${log.phase === 'ACTION' ? 'border-l-green-400' : ''}
                    ${log.phase === 'DECISION' ? 'goal' : ''}`}>
                    <span className="text-[9px] opacity-50 mr-2">[{log.phase}]</span>
                    {log.message}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {!result && !agentLoading && (
        <div className="tron-card p-16 text-center">
          <div className="text-5xl text-cyan-800 mb-4 animate-float">◬</div>
          <div className="text-cyan-600 font-mono text-sm mb-2">Intelligent agent awaiting activation</div>
          <div className="text-cyan-800 font-mono text-xs">Evaluates BFS, UCS, A* — picks the best</div>
        </div>
      )}
    </div>
  );
}
