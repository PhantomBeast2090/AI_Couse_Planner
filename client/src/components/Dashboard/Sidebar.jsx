import { useApp } from '../../store/AppContext';

const NAV_ITEMS = [
  { id: 'dashboard', icon: '⬡', label: 'Dashboard',   sub: 'Overview' },
  { id: 'courses',   icon: '◈', label: 'Courses',     sub: 'Manage' },
  { id: 'graph',     icon: '◎', label: 'Course Graph', sub: 'Visualize' },
  { id: 'algorithm', icon: '⟁', label: 'Algorithms',  sub: 'BFS·DFS·UCS·A*' },
  { id: 'timeline',  icon: '▤', label: 'Timeline',    sub: 'Semester Plan' },
  { id: 'compare',   icon: '⇌', label: 'Compare',     sub: 'Side-by-side' },
  { id: 'agent',     icon: '◬', label: 'AI Agent',    sub: 'Smart Planner' },
  { id: 'whatif',    icon: '⚠', label: 'What-If',     sub: 'Simulate' },
];

export default function Sidebar() {
  const { activeTab, dispatch, courses, completedCourseIds } = useApp();

  const progress = courses.length > 0
    ? Math.round((completedCourseIds.length / courses.length) * 100)
    : 0;

  return (
    <aside className="sidebar w-64 flex flex-col flex-shrink-0 h-full">
      {/* Logo */}
      <div className="p-5 border-b border-cyan-900/40">
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full border border-cyan-400/50 animate-pulse-neon" />
            <span className="text-xl neon-text font-bold" style={{ fontFamily: 'Orbitron' }}>P</span>
          </div>
          <div>
            <div className="text-sm font-bold text-cyan-300" style={{ fontFamily: 'Orbitron', letterSpacing: '0.15em' }}>
              PATH<span className="neon-text">AI</span>
            </div>
            <div className="text-xs text-cyan-700" style={{ fontFamily: 'Share Tech Mono' }}>
              Course Optimizer v1.0
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 overflow-y-auto space-y-1">
        {NAV_ITEMS.map(item => {
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => dispatch({ type: 'SET_TAB', payload: item.id })}
              className={`
                w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left
                transition-all duration-200 group relative overflow-hidden
                ${active
                  ? 'bg-cyan-400/10 border border-cyan-400/30 text-cyan-300'
                  : 'text-slate-400 hover:bg-cyan-900/20 hover:text-cyan-300 border border-transparent'}
              `}
            >
              {active && (
                <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-cyan-400 shadow-neon-sm" />
              )}
              <span className={`text-lg transition-all ${active ? 'neon-text-sm' : 'group-hover:text-cyan-400'}`}>
                {item.icon}
              </span>
              <div className="min-w-0">
                <div className="text-xs font-semibold truncate" style={{ fontFamily: 'Orbitron', letterSpacing: '0.08em' }}>
                  {item.label}
                </div>
                <div className="text-[10px] text-cyan-700 truncate" style={{ fontFamily: 'Share Tech Mono' }}>
                  {item.sub}
                </div>
              </div>
              {active && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-neon-sm flex-shrink-0" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Progress bar */}
      <div className="p-4 border-t border-cyan-900/40">
        <div className="flex justify-between items-center mb-2">
          <span className="text-[10px] text-cyan-600 font-mono uppercase tracking-widest">Progress</span>
          <span className="text-[10px] text-cyan-400 font-mono">{completedCourseIds.length}/{courses.length}</span>
        </div>
        <div className="neon-bar-track">
          <div className="neon-bar" style={{ width: `${progress}%` }} />
        </div>
        <div className="text-[10px] text-cyan-600 font-mono mt-1 text-right">{progress}% complete</div>
      </div>
    </aside>
  );
}
