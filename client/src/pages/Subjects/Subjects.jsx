import { useState, useEffect } from 'react';
import { subjectsAPI } from '../../services/api';
import toast from 'react-hot-toast';
import './Subjects.css';

const colorOptions = ['#8b5cf6', '#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#f43f5e', '#ec4899', '#6366f1'];
const iconOptions = ['📚', '🧮', '🔬', '🎨', '💻', '📐', '🌍', '🎵', '📖', '⚗️', '🧬', '📊'];

export default function Subjects() {
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editSubject, setEditSubject] = useState(null);
  const [formData, setFormData] = useState({
    name: '', color: '#8b5cf6', icon: '📚', targetGrade: 90, currentGrade: 0, credits: 3, semester: 'Fall 2026', difficulty: 3
  });

  useEffect(() => { fetchSubjects(); }, []);

  const fetchSubjects = async () => {
    try {
      const res = await subjectsAPI.getAll();
      setSubjects(res.data.data);
    } catch {
      toast.error('Failed to load subjects');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({ name: '', color: '#8b5cf6', icon: '📚', targetGrade: 90, currentGrade: 0, credits: 3, semester: 'Fall 2026', difficulty: 3 });
    setEditSubject(null);
  };

  const openEdit = (subject) => {
    setEditSubject(subject);
    setFormData({
      name: subject.name, color: subject.color, icon: subject.icon,
      targetGrade: subject.targetGrade, currentGrade: subject.currentGrade,
      credits: subject.credits, semester: subject.semester, difficulty: subject.difficulty
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editSubject) {
        await subjectsAPI.update(editSubject._id, formData);
        toast.success('Subject updated!');
      } else {
        await subjectsAPI.create(formData);
        toast.success('Subject added!');
      }
      setShowModal(false);
      resetForm();
      fetchSubjects();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this subject? Tasks linked to it will be unlinked.')) return;
    try {
      await subjectsAPI.delete(id);
      toast.success('Subject deleted');
      fetchSubjects();
    } catch {
      toast.error('Failed to delete');
    }
  };

  if (loading) return <div className="loader"><div className="spinner"></div></div>;

  return (
    <div className="subjects-page">
      <div className="subjects-page__header animate-fade-in">
        <div>
          <h1>📚 Subjects</h1>
          <p className="subjects-page__subtitle">{subjects.length} subjects tracked</p>
        </div>
        <button className="btn-primary" onClick={() => { resetForm(); setShowModal(true); }}>+ Add Subject</button>
      </div>

      {subjects.length === 0 ? (
        <div className="subjects-page__empty glass-card animate-fade-in-up">
          <div style={{ fontSize: '3rem', marginBottom: 12 }}>📚</div>
          <h3>No subjects yet</h3>
          <p>Add your courses to start tracking academic performance</p>
          <button className="btn-primary" onClick={() => { resetForm(); setShowModal(true); }}>+ Add Subject</button>
        </div>
      ) : (
        <div className="subjects-page__grid">
          {subjects.map((subject, i) => {
            const gradePercent = subject.targetGrade > 0 ? Math.round((subject.currentGrade / subject.targetGrade) * 100) : 0;
            const completionRate = subject.taskCount > 0 ? Math.round((subject.completedTasks / subject.taskCount) * 100) : 0;
            return (
              <div
                key={subject._id}
                className={`subjects-page__card glass-card animate-fade-in-up stagger-${Math.min(i + 1, 6)}`}
                style={{ '--subject-color': subject.color }}
              >
                <div className="subjects-page__card-header">
                  <div className="subjects-page__card-icon" style={{ background: `${subject.color}20` }}>
                    {subject.icon}
                  </div>
                  <div className="subjects-page__card-actions">
                    <button className="subjects-page__action-btn" onClick={() => openEdit(subject)} title="Edit">✏️</button>
                    <button className="subjects-page__action-btn" onClick={() => handleDelete(subject._id)} title="Delete">🗑️</button>
                  </div>
                </div>

                <h3 className="subjects-page__card-name">{subject.name}</h3>
                <p className="subjects-page__card-semester">{subject.semester} · {subject.credits} credits</p>

                <div className="subjects-page__card-grades">
                  <div className="subjects-page__grade-item">
                    <span className="subjects-page__grade-label">Current</span>
                    <span className="subjects-page__grade-value" style={{ color: subject.color }}>{subject.currentGrade}%</span>
                  </div>
                  <div className="subjects-page__grade-divider"></div>
                  <div className="subjects-page__grade-item">
                    <span className="subjects-page__grade-label">Target</span>
                    <span className="subjects-page__grade-value">{subject.targetGrade}%</span>
                  </div>
                </div>

                <div className="subjects-page__card-progress">
                  <div className="subjects-page__progress-label">
                    <span>Grade Progress</span>
                    <span>{gradePercent}%</span>
                  </div>
                  <div className="subjects-page__progress-bar">
                    <div className="subjects-page__progress-fill" style={{ width: `${gradePercent}%`, background: subject.color }}></div>
                  </div>
                </div>

                <div className="subjects-page__card-stats">
                  <div className="subjects-page__stat-mini">
                    <span>{subject.taskCount || 0}</span>
                    <span>Tasks</span>
                  </div>
                  <div className="subjects-page__stat-mini">
                    <span>{completionRate}%</span>
                    <span>Done</span>
                  </div>
                  <div className="subjects-page__stat-mini">
                    <span>{Math.round((subject.totalStudyMinutes || 0) / 60 * 10) / 10}h</span>
                    <span>Studied</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={(e) => e.target.className === 'modal-overlay' && setShowModal(false)}>
          <div className="modal-content">
            <div className="modal-header">
              <h2>{editSubject ? 'Edit Subject' : 'Add Subject'}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSubmit} className="tasks-page__form">
              <div className="auth-field">
                <label className="label">Subject Name *</label>
                <input className="input-field" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. Calculus II" required />
              </div>

              <div className="auth-field">
                <label className="label">Icon</label>
                <div className="subjects-page__icon-grid">
                  {iconOptions.map(icon => (
                    <button
                      key={icon} type="button"
                      className={`subjects-page__icon-btn ${formData.icon === icon ? 'active' : ''}`}
                      onClick={() => setFormData({ ...formData, icon })}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              </div>

              <div className="auth-field">
                <label className="label">Color</label>
                <div className="subjects-page__color-grid">
                  {colorOptions.map(color => (
                    <button
                      key={color} type="button"
                      className={`subjects-page__color-btn ${formData.color === color ? 'active' : ''}`}
                      style={{ background: color }}
                      onClick={() => setFormData({ ...formData, color })}
                    />
                  ))}
                </div>
              </div>

              <div className="tasks-page__form-row">
                <div className="auth-field">
                  <label className="label">Current Grade (%)</label>
                  <input type="number" className="input-field" min={0} max={100} value={formData.currentGrade} onChange={(e) => setFormData({ ...formData, currentGrade: Number(e.target.value) })} />
                </div>
                <div className="auth-field">
                  <label className="label">Target Grade (%)</label>
                  <input type="number" className="input-field" min={0} max={100} value={formData.targetGrade} onChange={(e) => setFormData({ ...formData, targetGrade: Number(e.target.value) })} />
                </div>
              </div>

              <div className="tasks-page__form-row">
                <div className="auth-field">
                  <label className="label">Credits</label>
                  <input type="number" className="input-field" min={1} max={6} value={formData.credits} onChange={(e) => setFormData({ ...formData, credits: Number(e.target.value) })} />
                </div>
                <div className="auth-field">
                  <label className="label">Semester</label>
                  <input className="input-field" value={formData.semester} onChange={(e) => setFormData({ ...formData, semester: e.target.value })} />
                </div>
              </div>

              <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: 8 }}>
                {editSubject ? 'Update Subject' : 'Add Subject'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
