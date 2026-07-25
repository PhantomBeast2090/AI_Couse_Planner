import { useState } from 'react';
import { useApp } from '../../store/AppContext';
import { compareAlgorithms } from '../../utils/api';

const PAIR_OPTIONS = [
  { a: 'bfs',   b: 'astar', label: 'BFS  vs  A*',   colorA: '#00ffff', colorB: '#ffff00' },
  { a: 'ucs',   b: 'astar', label: 'UCS  vs  A*',   colorA: '#00ff88', colorB: '#ffff00' },
  { a: 'bfs',   b: 'dfs',   label: 'BFS  vs  DFS',  colorA: '#00ffff', colorB: '#0088ff' },
  { a: 'bfs',   b: 'csp',   label: 'BFS  vs  CSP',  colorA: '#00ffff', colorB: '#ff8800' },
  { a: 'astar', b: 'csp',   label: 'A*   vs  CSP',  colorA: '#ffff00', colorB: '#ff8800' },
];

const METRICS = [
  { key: 'semesters',      label: 'Semesters',      better: 'lower', unit: '' },
  { key: 'nodesExplored',  label: 'Nodes Explored', better: 'lower', unit: '' },
  { key: 'executionTimeMs',label: 'Exec Time',       better: 'lower', unit: 'ms' },
  { key: 'totalCost',      label: 'Total Cost',      better: 'lower', unit: '' },
  { key: 'stepsCount',     label: 'Steps',           better: 'lower', unit: '' },
];

export default function ComparisonMode() {
  const { courses, completedCourseIds, constraints, notify } = useApp();
  const [pairIdx, setPairIdx] = useState(0);
  const [goal, setGoal] = useState('balanced');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('metrics');

  const pair = PAIR_OPTIONS[pairIdx];

  const handleCompare = async () => {
    if (!courses.length) return notify('Load a dataset first', 'error');
    setLoading(true);
    try {
      const res = await compareAlgorithms(pair.a, pair.b, goal, constraints, completedCourseIds);
      setResult(res.data);
      notify(`✅ Comparison complete: ${pair.label}`, 'success');
    } catch (err) {
      notify(err.response?.data?.error || 'Comparison failed', 'error');
    }
    setLoading(false);
  };

  const getWinnerBadge = (metricKey, valA, valB) => {
    const metric = METRICS.find(m => m.key === metricKey);
    if (!metric || valA === valB) return null;
    if (metric.better === 'lower') return valA < valB ? 'A' : 'B';
    return valA > valB ? 'A' : 'B';
  };

  const compData = result?.comparison;
  const statsA = compData?.[pair.a];
  const statsB = compData?.[pair.b];

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      {/* Controls */}
      <div className="tron-card p-5 space-y-4">
        <div className="text-[10px] text-cyan-600 font-mono uppercase tracking-widest">⇌ Algorithm Pair</div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {PAIR_OPTIONS.map((p, i) => (
            <button key={i} onClick={() => setPairIdx(i)}
              className={`py-2 px-3 rounded border text-xs font-mono transition-all text-center
                ${pairIdx === i ? 'border-cyan-400/50 bg-cyan-400/10 text-cyan-300' : 'border-cyan-900/30 text-cyan-700 hover:border-cyan-700'}`}>
              {p.label}
            </button>
          ))}
        </div>

        <div className="flex gap-4 items-center flex-wrap">
          <div className="flex gap-2 items-center">
            <label className="text-[10px] text-cyan-600 font-mono uppercase">Goal:</label>
            <select className="tron-select w-36 text-xs" value={goal} onChange={e => setGoal(e.target.value)}>
              {['fastest','easiest','balanced','specialization'].map(g => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>
          <button onClick={handleCompare} disabled={loading}
            className="btn-neon btn-neon-solid text-xs py-2 px-6 ml-auto">
            {loading ? '⟳ COMPARING...' : '⇌ RUN COMPARISON'}
          </button>
        </div>
      </div>

      {result && (
        <>
          {/* VS Header */}
          <div className="tron-card p-4 flex items-center justify-center gap-8">
            <div className="text-center">
              <div className="text-2xl font-bold font-mono" style={{ color: pair.colorA }}>
                {pair.a.toUpperCase()}
              </div>
              <div className="text-[10px] text-cyan-700 font-mono">{statsA?.semesters} semesters</div>
            </div>
            <div className="text-xl text-cyan-600 font-mono animate-pulse">VS</div>
            <div className="text-center">
              <div className="text-2xl font-bold font-mono" style={{ color: pair.colorB }}>
                {pair.b.toUpperCase()}
              </div>
              <div className="text-[10px] text-cyan-700 font-mono">{statsB?.semesters} semesters</div>
            </div>
          </div>

          {/* Winner summary */}
          {compData?.winner && (
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Fewest Semesters', winner: compData.winner.fewestSemesters },
                { label: 'Fewest Nodes', winner: compData.winner.fewestNodesExplored },
                { label: 'Fastest Runtime', winner: compData.winner.fastest },
              ].map(w => {
                const isA = w.winner === pair.a;
                return (
                  <div key={w.label} className="tron-card p-3 text-center">
                    <div className="text-[10px] text-cyan-700 font-mono uppercase mb-1">{w.label}</div>
                    <div className="text-lg font-bold font-mono" style={{ color: isA ? pair.colorA : pair.colorB }}>
                      {w.winner?.toUpperCase()}
                    </div>
                    <div className="text-[9px] font-mono text-green-400 mt-1">🏆 WINS</div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Tab switcher */}
          <div className="flex gap-2">
            {['metrics', 'planA', 'planB'].map(t => (
              <button key={t} onClick={() => setActiveTab(t)}
                className={`btn-neon text-[10px] py-1.5 px-4 ${activeTab === t ? 'btn-neon-solid' : ''}`}>
                {t === 'metrics' ? 'METRICS' : t === 'planA' ? pair.a.toUpperCase() + ' PLAN' : pair.b.toUpperCase() + ' PLAN'}
              </button>
            ))}
          </div>

          {/* Metrics table */}
          {activeTab === 'metrics' && (
            <div className="tron-card overflow-hidden">
              <table className="compare-table w-full">
                <thead>
                  <tr>
                    <th>Metric</th>
                    <th style={{ color: pair.colorA }}>{pair.a.toUpperCase()}</th>
                    <th style={{ color: pair.colorB }}>{pair.b.toUpperCase()}</th>
                    <th>Winner</th>
                  </tr>
                </thead>
                <tbody>
                  {METRICS.map(m => {
                    const valA = statsA?.[m.key] ?? '—';
                    const valB = statsB?.[m.key] ?? '—';
                    const winner = getWinnerBadge(m.key, valA, valB);
                    const winnerColor = winner === 'A' ? pair.colorA : pair.colorB;
                    return (
                      <tr key={m.key}>
                        <td className="text-cyan-400">{m.label}</td>
                        <td style={{ color: pair.colorA, fontWeight: winner === 'A' ? 'bold' : 'normal' }}>
                          {valA}{m.unit}
                        </td>
                        <td style={{ color: pair.colorB, fontWeight: winner === 'B' ? 'bold' : 'normal' }}>
                          {valB}{m.unit}
                        </td>
                        <td>
                          {winner && (
                            <span style={{ color: winnerColor }} className="font-mono text-[10px]">
                              🏆 {winner === 'A' ? pair.a : pair.b}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Side-by-side plans */}
          {(activeTab === 'planA' || activeTab === 'planB') && (() => {
            const isA = activeTab === 'planA';
            const planData = isA ? result.algorithmA : result.algorithmB;
            const color = isA ? pair.colorA : pair.colorB;
            const label = isA ? pair.a : pair.b;
            return (
              <div className="tron-card p-4">
                <div className="text-[10px] text-cyan-600 font-mono uppercase tracking-widest mb-3" style={{ color }}>
                  {label.toUpperCase()} — {planData?.totalSemesters} semesters
                </div>
                <div className="space-y-3">
                  {(planData?.semesterPlan || []).map((sem, i) => (
                    <div key={i} className="pl-3" style={{ borderLeft: `2px solid ${color}55` }}>
                      <div className="text-xs font-mono mb-1" style={{ color }}>
                        Semester {sem.semester} · {sem.totalCredits} credits
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {(sem.courses || []).map(c => (
                          <span key={c.id} className="text-[10px] font-mono px-2 py-0.5 rounded border border-cyan-900/30 text-cyan-400">
                            {c.name?.length > 20 ? c.name.slice(0,19)+'…' : c.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </>
      )}

      {!result && (
        <div className="tron-card p-16 text-center">
          <div className="text-5xl text-cyan-800 mb-4">⇌</div>
          <div className="text-cyan-600 font-mono text-sm">Select a pair and run comparison</div>
        </div>
      )}
    </div>
  );
}
