import { useState } from 'react';
import { useApp } from '../../store/AppContext';

const SEM_COLORS = ['#00ffff','#0088ff','#00ff88','#ffff00','#ff8800','#ff0088','#aa44ff','#00ffaa','#ff4444','#44ffff'];
const DIFF_COLORS = { 1:'#00ff88', 2:'#88ff00', 3:'#ffff00', 4:'#ff8800', 5:'#ff0044' };

export default function SemesterTimeline() {
  const { courses, completedCourseIds, constraints, currentPlan, runPlan, notify } = useApp();
  const [plan, setPlan] = useState(currentPlan);
  const [loading, setLoading] = useState(false);
  const [selectedAlg, setSelectedAlg] = useState('bfs');
  const [selectedGoal, setSelectedGoal] = useState('fastest');

  const handleGenerate = async () => {
    if (!courses.length) return notify('Load a dataset first', 'error');
    setLoading(true);
    try {
      const res = await runPlan(selectedAlg, selectedGoal, constraints, completedCourseIds);
      if (res) setPlan(res);
    } finally {
      setLoading(false);
    }
  };

  const totalCredits = plan?.semesterPlan?.reduce((s, sem) => s + sem.totalCredits, 0) || 0;
  const maxCredits = Math.max(...(plan?.semesterPlan?.map(s => s.totalCredits) || [1]));

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      {/* Controls */}
      <div className="tron-card p-4 flex flex-wrap gap-4 items-center">
        <div className="flex gap-3 items-center">
          <label className="text-[10px] text-cyan-600 font-mono uppercase">Algorithm:</label>
          <select className="tron-select w-32 text-xs" value={selectedAlg} onChange={e => setSelectedAlg(e.target.value)}>
            {['bfs','dfs','ucs','astar','csp'].map(a => (
              <option key={a} value={a}>{a.toUpperCase()}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-3 items-center">
          <label className="text-[10px] text-cyan-600 font-mono uppercase">Goal:</label>
          <select className="tron-select w-32 text-xs" value={selectedGoal} onChange={e => setSelectedGoal(e.target.value)}>
            {['fastest','easiest','balanced','specialization'].map(g => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </div>
        <button onClick={handleGenerate} disabled={loading}
          className="btn-neon btn-neon-solid text-xs py-2 px-5 ml-auto">
          {loading ? '⟳ GENERATING...' : '▤ GENERATE TIMELINE'}
        </button>
      </div>

      {/* Summary */}
      {plan && (
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Semesters', value: plan.totalSemesters, color: '#00ffff' },
            { label: 'Total Credits', value: totalCredits, color: '#0088ff' },
            { label: 'Avg Credits/Sem', value: plan.totalSemesters > 0 ? (totalCredits/plan.totalSemesters).toFixed(1) : 0, color: '#00ff88' },
            { label: 'Algorithm', value: plan.algorithm || selectedAlg.toUpperCase(), color: '#ffff00' },
          ].map(s => (
            <div key={s.label} className="tron-card p-3 text-center">
              <div className="text-xl font-bold font-mono" style={{ color: s.color }}>{s.value}</div>
              <div className="text-[10px] text-cyan-700 font-mono uppercase mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Workload chart */}
      {plan?.semesterPlan?.length > 0 && (
        <div className="tron-card p-5">
          <div className="text-[10px] text-cyan-600 font-mono uppercase tracking-widest mb-4">▤ Credit Load Per Semester</div>
          <div className="flex items-end gap-2 h-24">
            {plan.semesterPlan.map((sem, i) => {
              const pct = (sem.totalCredits / maxCredits) * 100;
              const color = SEM_COLORS[i % SEM_COLORS.length];
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="text-[9px] font-mono" style={{ color }}>{sem.totalCredits}</div>
                  <div className="w-full rounded-t transition-all duration-700"
                    style={{ height: `${pct}%`, background: `${color}33`, border: `1px solid ${color}55`,
                             boxShadow: `0 0 8px ${color}44`, minHeight: 4 }} />
                  <div className="text-[8px] font-mono text-cyan-700">S{sem.semester}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Timeline cards */}
      {plan?.semesterPlan?.length > 0 ? (
        <div className="space-y-3">
          {plan.semesterPlan.map((sem, i) => {
            const color = SEM_COLORS[i % SEM_COLORS.length];
            const avgDiff = sem.courses?.length > 0
              ? (sem.courses.reduce((s,c) => s + c.difficulty, 0) / sem.courses.length).toFixed(1)
              : 0;
            const workload = avgDiff < 2 ? 'LIGHT' : avgDiff < 3.5 ? 'MODERATE' : 'HEAVY';
            const workloadColor = avgDiff < 2 ? '#00ff88' : avgDiff < 3.5 ? '#ffff00' : '#ff0044';

            return (
              <div key={i} className="tron-card p-4" style={{
                borderLeft: `3px solid ${color}`,
                boxShadow: `inset 0 0 40px ${color}08`
              }}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="text-sm font-bold font-mono" style={{ color }}>
                      SEMESTER {sem.semester}
                    </div>
                    <div className="text-[10px] text-cyan-700 font-mono">
                      {sem.totalCredits} credits · {sem.courses?.length} courses
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {sem.hardCourseCount > 0 && (
                      <span className="tag tag-orange text-[9px]">{sem.hardCourseCount} HARD</span>
                    )}
                    <span className="text-[10px] font-bold font-mono" style={{ color: workloadColor }}>
                      {workload}
                    </span>
                    <div className="text-[10px] font-mono text-cyan-600">
                      avg diff: <span style={{ color: DIFF_COLORS[Math.round(avgDiff)] || '#ffff00' }}>{avgDiff}</span>
                    </div>
                  </div>
                </div>

                {/* Courses */}
                <div className="flex flex-wrap gap-2">
                  {(sem.courses || []).map(c => {
                    const isCompleted = completedCourseIds.includes(c.id);
                    return (
                      <div key={c.id}
                        className={`relative group flex items-center gap-2 px-3 py-1.5 rounded border text-[11px] font-mono cursor-pointer transition-all
                          ${isCompleted ? 'border-green-500/30 bg-green-900/10 text-green-400' : 'border-cyan-900/40 text-cyan-300 hover:border-cyan-500/40'}`}
                        style={{ borderLeftColor: DIFF_COLORS[c.difficulty] }}>
                        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                          style={{ background: DIFF_COLORS[c.difficulty] }} />
                        {c.name?.length > 22 ? c.name.slice(0,21)+'…' : c.name}
                        <span className="text-[9px] opacity-50">{c.credits}cr</span>
                        {isCompleted && <span className="text-green-400 text-[10px]">✓</span>}
                      </div>
                    );
                  })}
                </div>

                {/* Credit bar */}
                <div className="mt-3 neon-bar-track">
                  <div className="h-1 rounded-full transition-all duration-700"
                    style={{ width: `${(sem.totalCredits / 21) * 100}%`,
                             background: color, boxShadow: `0 0 8px ${color}88` }} />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="tron-card p-16 text-center">
          <div className="text-5xl text-cyan-800 mb-4">▤</div>
          <div className="text-cyan-600 font-mono text-sm mb-4">No plan generated yet</div>
          <button onClick={handleGenerate} className="btn-neon text-xs py-2 px-6">
            GENERATE TIMELINE
          </button>
        </div>
      )}
    </div>
  );
}
