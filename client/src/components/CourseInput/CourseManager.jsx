import { useState } from 'react';
import { useApp } from '../../store/AppContext';
import { addCourse, deleteCourse } from '../../utils/api';

const TAGS = ['AI', 'ML', 'DL', 'NLP', 'CV', 'RL', 'CS', 'Math', 'Systems', 'Data', 'DS', 'Elective', 'Core', 'Foundation', 'Advanced', 'Capstone'];
const TAG_CLASS = { AI:'tag-cyan', ML:'tag-blue', DL:'tag-blue', NLP:'tag-green', CV:'tag-green', RL:'tag-pink', CS:'tag-gray', Math:'tag-yellow', Systems:'tag-orange', Data:'tag-cyan', DS:'tag-cyan', Elective:'tag-gray', Core:'tag-yellow', Foundation:'tag-gray', Advanced:'tag-pink', Capstone:'tag-pink' };
const DIFF_LABELS = ['', '★ Beginner', '★★ Easy', '★★★ Moderate', '★★★★ Hard', '★★★★★ Expert'];
const DIFF_COLORS = ['', '#00ff88', '#88ff00', '#ffff00', '#ff8800', '#ff0044'];

export default function CourseManager() {
  const { courses, completedCourseIds, dispatch, notify, refreshGraph } = useApp();
  const [search, setSearch] = useState('');
  const [filterTag, setFilterTag] = useState('');
  const [filterDiff, setFilterDiff] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', credits: 3, difficulty: 2, tags: [], prerequisites: [] });
  const [submitting, setSubmitting] = useState(false);

  const allTags = [...new Set(courses.flatMap(c => c.tags || []))].sort();

  const filtered = courses.filter(c => {
    const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.id.includes(search.toLowerCase());
    const matchTag = !filterTag || (c.tags || []).includes(filterTag);
    const matchDiff = !filterDiff || c.difficulty === parseInt(filterDiff);
    return matchSearch && matchTag && matchDiff;
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return notify('Course name is required', 'error');
    setSubmitting(true);
    try {
      const res = await addCourse(form);
      dispatch({ type: 'ADD_COURSE', payload: res.data.course });
      await refreshGraph();
      setForm({ name: '', credits: 3, difficulty: 2, tags: [], prerequisites: [] });
      setShowForm(false);
      notify(`✅ Added "${res.data.course.name}"`, 'success');
    } catch (err) {
      notify(err.response?.data?.error || 'Failed to add course', 'error');
    }
    setSubmitting(false);
  };

  const handleDelete = async (course) => {
    try {
      await deleteCourse(course.id);
      dispatch({ type: 'DELETE_COURSE', payload: course.id });
      await refreshGraph();
      notify(`Deleted "${course.name}"`, 'info');
    } catch (err) {
      notify(err.response?.data?.error || 'Cannot delete', 'error');
    }
  };

  const toggleTag = (tag) => {
    setForm(f => ({
      ...f,
      tags: f.tags.includes(tag) ? f.tags.filter(t => t !== tag) : [...f.tags, tag]
    }));
  };

  const togglePrereq = (id) => {
    setForm(f => ({
      ...f,
      prerequisites: f.prerequisites.includes(id)
        ? f.prerequisites.filter(p => p !== id)
        : [...f.prerequisites, id]
    }));
  };

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-3 items-center">
        <input
          className="tron-input flex-1 min-w-48"
          placeholder="Search courses..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select className="tron-select w-40" value={filterTag} onChange={e => setFilterTag(e.target.value)}>
          <option value="">All Tags</option>
          {allTags.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select className="tron-select w-36" value={filterDiff} onChange={e => setFilterDiff(e.target.value)}>
          <option value="">All Levels</option>
          {[1,2,3,4,5].map(d => <option key={d} value={d}>{DIFF_LABELS[d]}</option>)}
        </select>
        <button onClick={() => setShowForm(!showForm)} className="btn-neon btn-neon-solid text-xs py-2 px-4">
          {showForm ? '✕ CANCEL' : '+ ADD COURSE'}
        </button>
      </div>

      {/* Add course form */}
      {showForm && (
        <div className="tron-card p-5 border-cyan-400/20">
          <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-widest mb-4 font-mono">⊕ New Course</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block text-[10px] text-cyan-600 font-mono uppercase tracking-widest mb-1">Course Name *</label>
                <input className="tron-input" placeholder="e.g. Machine Learning" value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
              </div>
              <div>
                <label className="block text-[10px] text-cyan-600 font-mono uppercase tracking-widest mb-1">Credits</label>
                <input type="number" min={1} max={6} className="tron-input" value={form.credits}
                  onChange={e => setForm(f => ({ ...f, credits: parseInt(e.target.value) }))} />
              </div>
            </div>

            <div>
              <label className="block text-[10px] text-cyan-600 font-mono uppercase tracking-widest mb-2">Difficulty</label>
              <div className="flex gap-2">
                {[1,2,3,4,5].map(d => (
                  <button type="button" key={d}
                    onClick={() => setForm(f => ({ ...f, difficulty: d }))}
                    className={`flex-1 py-2 rounded border text-xs font-mono transition-all
                      ${form.difficulty === d ? 'border-current bg-current/10' : 'border-cyan-900/40 text-cyan-700'}`}
                    style={{ color: form.difficulty === d ? DIFF_COLORS[d] : undefined,
                             borderColor: form.difficulty === d ? DIFF_COLORS[d] : undefined }}>
                    {d}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[10px] text-cyan-600 font-mono uppercase tracking-widest mb-2">Tags</label>
              <div className="flex flex-wrap gap-2">
                {TAGS.map(tag => (
                  <button type="button" key={tag}
                    onClick={() => toggleTag(tag)}
                    className={`tag cursor-pointer transition-all ${form.tags.includes(tag) ? (TAG_CLASS[tag] || 'tag-cyan') : 'tag-gray opacity-50'}`}>
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[10px] text-cyan-600 font-mono uppercase tracking-widest mb-2">
                Prerequisites ({form.prerequisites.length} selected)
              </label>
              
              <div className="flex gap-2 mb-2">
                <select 
                  className="tron-select flex-1"
                  onChange={e => {
                    const id = e.target.value;
                    if (id && !form.prerequisites.includes(id)) {
                      togglePrereq(id);
                      e.target.value = ''; // reset after selection
                    }
                  }}
                  defaultValue=""
                >
                  <option value="" disabled>-- Select a prerequisite to add --</option>
                  {courses.map(c => (
                    <option key={c.id} value={c.id} disabled={form.prerequisites.includes(c.id)}>
                      {c.name} [{c.id}]
                    </option>
                  ))}
                </select>
              </div>

              {/* Display selected prerequisites as tags */}
              {form.prerequisites.length > 0 && (
                <div className="flex flex-wrap gap-2 p-2 border border-cyan-900/30 rounded">
                  {form.prerequisites.map(id => {
                    const courseInfo = courses.find(c => c.id === id);
                    return (
                      <div key={id} className="flex items-center gap-1 tag tag-gray bg-cyan-900/20 border-cyan-700/50">
                        <span>{courseInfo?.name || id}</span>
                        <button type="button" onClick={() => togglePrereq(id)} className="text-red-400 hover:text-red-300 ml-1">✕</button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <button type="button" onClick={() => setShowForm(false)} className="btn-neon text-xs py-1.5 px-4">
                CANCEL
              </button>
              <button type="submit" disabled={submitting} className="btn-neon btn-neon-solid text-xs py-1.5 px-6">
                {submitting ? 'ADDING...' : 'ADD COURSE'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Course count */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-cyan-600 font-mono">{filtered.length} of {courses.length} courses</span>
        <span className="text-xs text-cyan-700 font-mono">{completedCourseIds.length} completed</span>
      </div>

      {/* Course list */}
      <div className="space-y-2">
        {filtered.map(course => {
          const isCompleted = completedCourseIds.includes(course.id);
          return (
            <div key={course.id}
              className={`tron-card p-4 flex items-center gap-4 transition-all
                ${isCompleted ? 'opacity-60 border-green-500/20' : ''}`}>

              {/* Completed toggle */}
              <button
                onClick={() => dispatch({ type: 'TOGGLE_COMPLETED', payload: course.id })}
                className={`w-5 h-5 flex-shrink-0 rounded border transition-all
                  ${isCompleted
                    ? 'bg-green-500/20 border-green-400/60 text-green-400'
                    : 'border-cyan-700/50 hover:border-cyan-400 text-transparent hover:text-cyan-700'}`}
                title={isCompleted ? 'Mark incomplete' : 'Mark complete'}
              >
                <span className="text-xs flex items-center justify-center h-full">✓</span>
              </button>

              {/* Difficulty dot */}
              <div className="w-2 h-2 rounded-full flex-shrink-0 shadow-neon-sm"
                style={{ background: DIFF_COLORS[course.difficulty], boxShadow: `0 0 6px ${DIFF_COLORS[course.difficulty]}88` }} />

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`font-mono text-sm ${isCompleted ? 'line-through text-cyan-700' : 'text-cyan-200'}`}>
                    {course.name}
                  </span>
                  <span className="text-[10px] text-cyan-700 font-mono">[{course.id}]</span>
                </div>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {(course.tags || []).slice(0,4).map(t => (
                    <span key={t} className={`tag ${TAG_CLASS[t] || 'tag-gray'}`}>{t}</span>
                  ))}
                  {course.prerequisites?.length > 0 && (
                    <span className="text-[10px] text-cyan-700 font-mono">
                      Needs: {course.prerequisites.slice(0,3).join(', ')}
                      {course.prerequisites.length > 3 && ` +${course.prerequisites.length - 3}`}
                    </span>
                  )}
                </div>
              </div>

              {/* Right side */}
              <div className="flex items-center gap-4 flex-shrink-0 text-right">
                <div>
                  <div className="text-sm font-mono font-bold" style={{ color: DIFF_COLORS[course.difficulty] }}>
                    {DIFF_LABELS[course.difficulty]?.split(' ')[0]}
                  </div>
                  <div className="text-[10px] text-cyan-600 font-mono">{course.credits} credits</div>
                </div>
                <button onClick={() => handleDelete(course)}
                  className="text-red-500/50 hover:text-red-400 text-xs font-mono transition-colors">
                  ✕
                </button>
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="tron-card p-12 text-center">
            <div className="text-4xl mb-3 text-cyan-800">◈</div>
            <div className="text-cyan-600 font-mono text-sm">No courses found</div>
          </div>
        )}
      </div>
    </div>
  );
}
