import { useEffect, useState } from 'react';
import { useApp, buildSelection, hasSelection } from '../../store/AppContext';
import { getPrograms } from '../../utils/api';

/**
 * ScopePicker — the single UI entry point for planning scope.
 * Exactly one of program / target course may be active; picking one clears
 * the other (and AppContext invalidates all stale derived results).
 * Planning buttons elsewhere stay disabled until a selection exists.
 */
export default function ScopePicker({ compact = false }) {
  const {
    courses, dispatch, notify,
    selectedProgramId, targetCourseId,
  } = useApp();
  const [programs, setPrograms] = useState([]);
  const [courseSearch, setCourseSearch] = useState('');

  useEffect(() => {
    getPrograms()
      .then(res => setPrograms(res.data?.programs || []))
      .catch(() => { /* program list unavailable; course mode still works */ });
  }, []);

  const state = { selectedProgramId, targetCourseId };
  const active = buildSelection(state);

  const pickProgram = (id) => {
    dispatch({ type: 'SET_PROGRAM', payload: id || null });
    setCourseSearch('');
    if (id) notify(`Scope: program ${programs.find(p => p.id === id)?.name || id}`, 'info');
  };

  const pickCourse = (id) => {
    if (!id) return;
    if (!courses.some(c => c.id === id)) return notify(`Unknown course "${id}"`, 'error');
    dispatch({ type: 'SET_TARGET_COURSE', payload: id });
    setCourseSearch('');
    notify(`Scope: target course ${courses.find(c => c.id === id)?.name || id}`, 'info');
  };

  const clear = () => {
    dispatch({ type: 'CLEAR_SELECTION' });
    setCourseSearch('');
  };

  return (
    <div className="tron-card p-4 space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="text-[10px] text-cyan-600 font-mono uppercase tracking-widest">◉ Planning Scope</div>
        {active
          ? <span className="tag tag-cyan text-[9px]">SCOPE ACTIVE</span>
          : <span className="tag tag-gray text-[9px]">NO SELECTION — PLANNING DISABLED</span>}
        {active && (
          <button onClick={clear} className="btn-neon text-[9px] py-1 px-2 ml-auto">✕ CLEAR</button>
        )}
      </div>

      <div className={`grid gap-3 ${compact ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>
        <div>
          <div className="text-[10px] text-cyan-600 font-mono uppercase mb-1">Program / Degree</div>
          <select className="tron-select w-full text-xs" value={selectedProgramId || ''} onChange={e => pickProgram(e.target.value)}>
            <option value="">-- Select a program --</option>
            {programs.map(p => (
              <option key={p.id} value={p.id}>{p.name} ({p.requiredCourses} courses)</option>
            ))}
          </select>
        </div>
        <div>
          <div className="text-[10px] text-cyan-600 font-mono uppercase mb-1">Target Course (closure)</div>
          <div className="flex gap-2">
            <input
              className="tron-input flex-1 text-xs"
              placeholder="Type a course id or name…"
              value={targetCourseId || courseSearch}
              onChange={e => setCourseSearch(e.target.value)}
              list="scope-course-list"
            />
            <datalist id="scope-course-list">
              {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </datalist>
            <button onClick={() => pickCourse(courseSearch.trim())} disabled={!courseSearch.trim()}
              className="btn-neon text-[10px] py-1 px-3">SET</button>
          </div>
        </div>
      </div>

      {!hasSelection(state) && (
        <div className="text-[10px] font-mono text-cyan-700">
          Select a program or a target course first — Generate Plan, Compare, Agent, Timeline and Simulations stay disabled until then.
        </div>
      )}
    </div>
  );
}

/** One-line scope banner for result headers: "Planning for X · Scope: N courses". */
export function ScopeLine({ scope }) {
  if (!scope) return null;
  const label = scope.kind === 'program'
    ? `Program: ${scope.selectedName || scope.programId}`
    : `Course: ${scope.selectedName || scope.targetCourseId}`;
  return (
    <div className="text-[10px] font-mono text-cyan-500">
      Planning for <span className="text-cyan-300">{label}</span>
      {' · '}Scope: <span className="text-cyan-300">{scope.size} courses</span>
    </div>
  );
}
