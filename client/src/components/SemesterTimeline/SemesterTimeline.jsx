import { useState, useEffect } from 'react';
import { useApp } from '../../store/AppContext';
import { getPrograms, runDegreePlan } from '../../utils/api';

const SEM_COLORS = ['#00ffff','#0088ff','#00ff88','#ffff00','#ff8800','#ff0088','#aa44ff','#00ffaa','#ff4444','#44ffff'];
const DIFF_COLORS = { 1:'#00ff88', 2:'#88ff00', 3:'#ffff00', 4:'#ff8800', 5:'#ff0044' };

// Full-time degree load defaults for the 8-semester planner. The per-semester
// course cap is a hard product ceiling (never above 8).
const DEGREE_DEFAULTS = { maxCredits: 21, maxHardCourses: 3, maxCoursesPerSemester: 8 };

export default function SemesterTimeline() {
  const { courses, completedCourseIds, constraints, currentPlan, runPlan, notify } = useApp();
  const [plan, setPlan] = useState(currentPlan);
  const [loading, setLoading] = useState(false);
  const [selectedAlg, setSelectedAlg] = useState('bfs');
  const [selectedGoal, setSelectedGoal] = useState('fastest');

  // ── Degree timeline (program-scoped, max 8 semesters) ──
  const [programs, setPrograms] = useState([]);
  const [programId, setProgramId] = useState('');
  const [degreeConstraints, setDegreeConstraints] = useState(DEGREE_DEFAULTS);
  const [degreeResult, setDegreeResult] = useState(null);
  const [degreeLoading, setDegreeLoading] = useState(false);

  useEffect(() => {
    getPrograms()
      .then(res => {
        const list = res.data?.programs || [];
        setPrograms(list);
        if (list.length > 0 && !programId) setProgramId(list[0].id);
      })
      .catch(() => { /* programs unavailable: degree panel stays disabled */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDegreeGenerate = async () => {
    if (!programId) return notify('Select a degree program first', 'error');
    if (!courses.length) return notify('Load a dataset first', 'error');
    setDegreeLoading(true);
    try {
      const res = await runDegreePlan(programId, selectedGoal, degreeConstraints, completedCourseIds, []);
      setDegreeResult(res.data);
      if (res.data?.success) {
        notify(`✅ Degree plan: ${res.data.totalSemesters} semesters`, 'success');
      } else {
        notify(res.data?.message || 'Degree plan does not fit in 8 semesters', 'error');
      }
    } catch (err) {
      notify(err.response?.data?.error || 'Degree planning failed', 'error');
    }
    setDegreeLoading(false);
  };

  const setDegreeConstraint = (key, value) => {
    const num = Math.max(1, parseInt(value, 10) || 1);
    setDegreeConstraints(prev => ({
      ...prev,
      [key]: key === 'maxCoursesPerSemester' ? Math.min(8, num) : num,
    }));
  };

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

      {/* Degree timeline: program-scoped, max 8 semesters */}
      <div className="tron-card p-4 space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="text-[10px] text-cyan-600 font-mono uppercase tracking-widest">🎓 Degree Timeline (max 8 semesters)</div>
        </div>
        <div className="flex gap-4 items-center flex-wrap">
          <div className="flex gap-3 items-center">
            <label className="text-[10px] text-cyan-600 font-mono uppercase">Program:</label>
            <select className="tron-select w-56 text-xs" value={programId} onChange={e => setProgramId(e.target.value)}>
              {programs.map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.requiredCourses} courses)</option>
              ))}
            </select>
          </div>
          {[
            { key: 'maxCredits', label: 'Credits/sem' },
            { key: 'maxHardCourses', label: 'Hard/sem' },
            { key: 'maxCoursesPerSemester', label: 'Courses/sem (≤8)' },
          ].map(f => (
            <div key={f.key} className="flex gap-2 items-center">
              <label className="text-[10px] text-cyan-600 font-mono uppercase">{f.label}:</label>
              <input type="number" min="1" max={f.key === 'maxCoursesPerSemester' ? 8 : 30}
                className="tron-select w-16 text-xs" value={degreeConstraints[f.key]}
                onChange={e => setDegreeConstraint(f.key, e.target.value)} />
            </div>
          ))}
          <button onClick={handleDegreeGenerate} disabled={degreeLoading || !programId}
            className="btn-neon btn-neon-green text-xs py-2 px-5 ml-auto">
            {degreeLoading ? '⟳ PLANNING...' : '🎓 GENERATE DEGREE PLAN'}
          </button>
        </div>

        {degreeResult && (
          <div className="space-y-3 pt-1">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xs font-bold font-mono text-cyan-300">
                {degreeResult.programName || 'Degree plan'} — {degreeResult.totalSemesters} semester{degreeResult.totalSemesters === 1 ? '' : 's'}
              </span>
              {degreeResult.success
                ? <span className="tag tag-green text-[9px]">✓ FITS IN 8 SEMESTERS</span>
                : <span className="tag tag-orange text-[9px]">⚠ DOES NOT FIT IN 8 SEMESTERS</span>}
            </div>

            {!degreeResult.success && (
              <div className="tron-card p-4 border-l-2 border-l-orange-400">
                <div className="text-[10px] font-mono font-bold text-orange-400 mb-1">
                  ⚠ {degreeResult.reason || 'PLAN_INCOMPLETE'}
                </div>
                <div className="text-sm text-cyan-300 font-mono mb-2">{degreeResult.message}</div>
                {(degreeResult.unplannedCourses || []).length > 0 && (
                  <div>
                    <div className="text-[10px] text-cyan-700 font-mono mb-1">
                      UNPLANNED ({degreeResult.unplannedCourses.length}):
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {degreeResult.unplannedCourses.map(c => (
                        <span key={c.id} className="text-[10px] font-mono px-2 py-0.5 rounded border border-orange-900/40 text-orange-300" title={c.reason}>
                          {c.name?.length > 22 ? c.name.slice(0,21)+'…' : c.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              {(degreeResult.semesterPlan || []).map((sem, i) => {
                const color = SEM_COLORS[i % SEM_COLORS.length];
                return (
                  <div key={i} className="pl-3" style={{ borderLeft: `2px solid ${color}55` }}>
                    <div className="text-xs font-mono mb-1" style={{ color }}>
                      Semester {sem.semester} · {sem.courses?.length} courses · {sem.totalCredits} credits
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {(sem.courses || []).map(c => (
                        <span key={c.id} className="text-[10px] font-mono px-2 py-0.5 rounded border border-cyan-900/30 text-cyan-400" title={`${c.credits}cr · difficulty ${c.difficulty}`}>
                          {c.name?.length > 22 ? c.name.slice(0,21)+'…' : c.name}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
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
