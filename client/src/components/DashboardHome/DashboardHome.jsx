import { useApp } from '../../store/AppContext';

const DIFF_LABELS = ['', 'Beginner', 'Easy', 'Moderate', 'Hard', 'Expert'];
const DIFF_COLORS = ['', '#00ff88', '#88ff00', '#ffff00', '#ff8800', '#ff0044'];

export default function DashboardHome() {
  const { courses, completedCourseIds, currentPlan, graphData, dispatch } = useApp();

  const stats = graphData?.stats || {};
  const tagDist = stats.tagDistribution || {};
  const diffDist = stats.difficultyDistribution || {};

  const topTags = Object.entries(tagDist)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  const completionPct = courses.length > 0
    ? Math.round((completedCourseIds.length / courses.length) * 100) : 0;

  const STAT_CARDS = [
    { label: 'Total Courses',   value: courses.length,              icon: '◈', color: 'cyan' },
    { label: 'Total Credits',   value: stats.totalCredits || 0,     icon: '◉', color: 'blue' },
    { label: 'Avg Difficulty',  value: stats.avgDifficulty || '—',  icon: '⬡', color: 'orange' },
    { label: 'Completed',       value: completedCourseIds.length,   icon: '✓', color: 'green' },
    { label: 'Prereq Edges',    value: stats.totalEdges || 0,       icon: '→', color: 'pink' },
    { label: 'Plan Semesters',  value: currentPlan?.totalSemesters || '—', icon: '▤', color: 'yellow' },
  ];

  const colorMap = {
    cyan: 'border-cyan-500/30 text-cyan-400',
    blue: 'border-blue-500/30 text-blue-400',
    green: 'border-green-500/30 text-green-400',
    orange: 'border-orange-500/30 text-orange-400',
    pink: 'border-pink-500/30 text-pink-400',
    yellow: 'border-yellow-500/30 text-yellow-400',
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Hero */}
      <div className="tron-card p-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-900/10 via-transparent to-blue-900/10 pointer-events-none" />
        <div className="relative flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold neon-text mb-1" style={{ fontFamily: 'Orbitron' }}>
              PATHAI SYSTEM
            </h2>
            <p className="text-sm text-cyan-600 font-mono mb-4">
              Intelligent Academic Course Path Optimizer · BFS · DFS · UCS · A* · CSP · Agent
            </p>
            <div className="flex gap-3 flex-wrap">
              <button onClick={() => dispatch({ type: 'SET_TAB', payload: 'algorithm' })} className="btn-neon text-xs py-2 px-4">
                ⟁ RUN ALGORITHMS
              </button>
              <button onClick={() => dispatch({ type: 'SET_TAB', payload: 'graph' })} className="btn-neon text-xs py-2 px-4">
                ◎ VIEW GRAPH
              </button>
              <button onClick={() => dispatch({ type: 'SET_TAB', payload: 'agent' })} className="btn-neon btn-neon-green text-xs py-2 px-4">
                ◬ AI AGENT
              </button>
            </div>
          </div>
          <div className="hidden md:block">
            {/* Animated hexagon decoration */}
            <div className="relative w-28 h-28 flex items-center justify-center">
              <div className="absolute inset-0 animate-spin-slow" style={{
                border: '1px solid rgba(0,255,255,0.15)',
                borderRadius: '50%'
              }} />
              <div className="absolute inset-3 animate-spin-slow" style={{
                border: '1px solid rgba(0,136,255,0.2)',
                borderRadius: '50%',
                animationDirection: 'reverse'
              }} />
              <span className="text-4xl neon-text" style={{ fontFamily: 'Orbitron' }}>◬</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {STAT_CARDS.map(card => (
          <div key={card.label} className={`tron-card p-4 border ${colorMap[card.color]}`}>
            <div className={`text-xl mb-1 ${colorMap[card.color].split(' ')[1]}`}>{card.icon}</div>
            <div className="text-2xl font-bold font-mono" style={{ color: 'inherit' }}>
              {card.value}
            </div>
            <div className="text-[10px] text-cyan-700 uppercase tracking-widest mt-1 font-mono">
              {card.label}
            </div>
          </div>
        ))}
      </div>

      {/* Two-column: tags + difficulty */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Tag distribution */}
        <div className="tron-card p-5">
          <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-widest mb-4 font-mono">
            ◈ Domain Distribution
          </h3>
          <div className="space-y-2.5">
            {topTags.map(([tag, count]) => {
              const pct = courses.length > 0 ? Math.round((count / courses.length) * 100) : 0;
              return (
                <div key={tag}>
                  <div className="flex justify-between text-[11px] font-mono mb-1">
                    <span className="text-cyan-300">{tag}</span>
                    <span className="text-cyan-600">{count} courses</span>
                  </div>
                  <div className="neon-bar-track">
                    <div className="neon-bar" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Difficulty breakdown */}
        <div className="tron-card p-5">
          <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-widest mb-4 font-mono">
            ⬡ Difficulty Breakdown
          </h3>
          <div className="space-y-3">
            {[1,2,3,4,5].map(d => {
              const count = diffDist[d] || 0;
              const pct = courses.length > 0 ? Math.round((count / courses.length) * 100) : 0;
              return (
                <div key={d}>
                  <div className="flex justify-between text-[11px] font-mono mb-1">
                    <span style={{ color: DIFF_COLORS[d] }}>{DIFF_LABELS[d]}</span>
                    <span className="text-cyan-600">{count}</span>
                  </div>
                  <div className="h-1 rounded-full bg-cyan-900/30 overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700" style={{
                      width: `${pct}%`,
                      background: DIFF_COLORS[d],
                      boxShadow: `0 0 8px ${DIFF_COLORS[d]}88`
                    }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Completion gauge */}
          <div className="mt-5 pt-4 border-t border-cyan-900/40">
            <div className="flex justify-between text-[11px] font-mono mb-2">
              <span className="text-cyan-400">Courses Completed</span>
              <span className="neon-text-sm">{completionPct}%</span>
            </div>
            <div className="neon-bar-track">
              <div className="h-2 rounded-full transition-all duration-700" style={{
                width: `${completionPct}%`,
                background: 'linear-gradient(90deg, #00ff88, #00ffff)',
                boxShadow: '0 0 10px rgba(0,255,136,0.6)'
              }} />
            </div>
          </div>
        </div>
      </div>

      {/* Algorithm quick-run shortcuts */}
      <div className="tron-card p-5">
        <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-widest mb-4 font-mono">
          ⟁ Quick Actions
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'BFS Plan', icon: '⬡', tab: 'algorithm', alg: 'bfs', color: 'cyan' },
            { label: 'A* Plan', icon: '⟁', tab: 'algorithm', alg: 'astar', color: 'blue' },
            { label: 'Compare', icon: '⇌', tab: 'compare', color: 'pink' },
            { label: 'Simulate', icon: '⚠', tab: 'whatif', color: 'orange' },
          ].map(action => (
            <button
              key={action.label}
              onClick={() => dispatch({ type: 'SET_TAB', payload: action.tab })}
              className="tron-card p-4 text-left hover:scale-[1.02] transition-transform group"
              style={{ cursor: 'pointer' }}
            >
              <div className="text-2xl mb-2 group-hover:animate-pulse">{action.icon}</div>
              <div className="text-xs font-bold font-mono text-cyan-300 uppercase tracking-widest">
                {action.label}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
