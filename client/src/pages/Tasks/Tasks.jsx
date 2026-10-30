import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { tasksAPI, subjectsAPI } from '../../services/api';
import toast from 'react-hot-toast';
import './Tasks.css';

export default function Tasks() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editTask, setEditTask] = useState(null);
  const [detailTask, setDetailTask] = useState(null);
  const [deleteConfirmTask, setDeleteConfirmTask] = useState(null);
  const [filter, setFilter] = useState({ status: '', priority: '', type: '' });
  const [sortOption, setSortOption] = useState('dueDate_asc');
  const [search, setSearch] = useState('');
  const [formData, setFormData] = useState({
    title: '', description: '', type: 'assignment', priority: 3,
    difficulty: 3, dueDate: '', estimatedMinutes: 60, subject: '', tags: ''
  });

  useEffect(() => { fetchData(); }, [filter, sortOption, search]);

  const fetchData = async () => {
    try {
      const params = {
        ...filter,
        sort: sortOption,
        search: search || undefined
      };
      Object.keys(params).forEach(k => !params[k] && delete params[k]);

      const [tasksRes, subjectsRes] = await Promise.all([
        tasksAPI.getAll(params),
        subjectsAPI.getAll()
      ]);
      setTasks(tasksRes.data.data || []);
      setSubjects(subjectsRes.data.data || []);
    } catch {
      toast.error('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      title: '', description: '', type: 'assignment', priority: 3,
      difficulty: 3, dueDate: '', estimatedMinutes: 60, subject: '', tags: ''
    });
    setEditTask(null);
  };

  const openCreate = () => { resetForm(); setShowModal(true); };

  const openEdit = (task) => {
    setDetailTask(null);
    setEditTask(task);
    setFormData({
      title: task.title,
      description: task.description || '',
      type: task.type,
      priority: task.priority,
      difficulty: task.difficulty,
      dueDate: task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '',
      estimatedMinutes: task.estimatedMinutes || 60,
      subject: task.subject?._id || '',
      tags: task.tags?.join(', ') || ''
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      toast.error('Task title is required');
      return;
    }
    if (!formData.dueDate) {
      toast.error('A valid due date is required');
      return;
    }
    const est = Number(formData.estimatedMinutes);
    if (isNaN(est) || est < 5 || est > 1440) {
      toast.error('Estimated duration must be between 5 and 1440 minutes');
      return;
    }

    try {
      const data = {
        ...formData,
        estimatedMinutes: est,
        subject: formData.subject || undefined,
        tags: formData.tags ? formData.tags.split(',').map(t => t.trim()).filter(Boolean) : []
      };

      if (editTask) {
        const res = await tasksAPI.update(editTask._id, data);
        toast.success('Task updated successfully!');
        if (detailTask && detailTask._id === editTask._id) {
          setDetailTask(res.data.data);
        }
      } else {
        await tasksAPI.create(data);
        toast.success('Task created successfully!');
      }
      setShowModal(false);
      resetForm();
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save task');
    }
  };

  const confirmDelete = async () => {
    if (!deleteConfirmTask) return;
    try {
      await tasksAPI.delete(deleteConfirmTask._id);
      toast.success('Task deleted');
      if (detailTask?._id === deleteConfirmTask._id) {
        setDetailTask(null);
      }
      setDeleteConfirmTask(null);
      fetchData();
    } catch {
      toast.error('Failed to delete task');
    }
  };

  const handleStatusToggle = async (task, e) => {
    if (e) e.stopPropagation();
    const nextStatus = task.status === 'completed' ? 'pending' : task.status === 'pending' ? 'in-progress' : 'completed';
    try {
      const res = await tasksAPI.updateStatus(task._id, nextStatus);
      toast.success(nextStatus === 'completed' ? 'Task completed! 🎉' : `Status: ${nextStatus}`);
      if (detailTask?._id === task._id) {
        setDetailTask(res.data.data);
      }
      fetchData();
    } catch {
      toast.error('Failed to update status');
    }
  };

  const startFocusTimer = (task) => {
    navigate('/timer', {
      state: {
        taskId: task._id,
        taskTitle: task.title,
        subjectId: task.subject?._id,
        duration: Math.min(task.estimatedMinutes - (task.completedMinutes || 0), 45) || 25
      }
    });
  };

  const priorityLabel = (p) => ['', 'Low', 'Medium-Low', 'Medium', 'High', 'Critical'][p] || 'Medium';
  const typeIcon = (t) => ({ assignment: '📝', exam: '📖', reading: '📕', project: '🔧', revision: '🔄', other: '📌' }[t] || '📌');

  const daysUntil = (date) => {
    const diff = Math.ceil((new Date(date) - new Date()) / (1000 * 60 * 60 * 24));
    if (diff < 0) return { text: `${Math.abs(diff)}d overdue`, overdue: true };
    if (diff === 0) return { text: 'Due today', overdue: false };
    if (diff === 1) return { text: 'Due tomorrow', overdue: false };
    return { text: `${diff} days left`, overdue: false };
  };

  const overdueCount = tasks.filter(t => t.status !== 'completed' && new Date(t.dueDate) < new Date()).length;

  if (loading) return <div className="loader"><div className="spinner"></div></div>;

  return (
    <div className="tasks-page">
      <div className="tasks-page__header animate-fade-in">
        <div>
          <h1>✅ Tasks & Assignments</h1>
          <p className="tasks-page__subtitle">{tasks.length} task{tasks.length !== 1 ? 's' : ''} tracked</p>
        </div>
        <button className="btn-primary" onClick={openCreate}>+ New Task</button>
      </div>

      {overdueCount > 0 && filter.status !== 'completed' && (
        <div className="overdue-banner glass-card animate-fade-in">
          <div className="overdue-banner-icon">🚨</div>
          <div className="overdue-banner-content">
            <strong>{overdueCount} Overdue Task{overdueCount > 1 ? 's' : ''} Require Immediate Attention!</strong>
            <p>Some of your assignments have passed their deadline. Prioritize these or reschedule them.</p>
          </div>
          <button
            className="btn-secondary overdue-banner-filter-btn"
            onClick={() => setFilter({ ...filter, status: 'overdue' })}
          >
            Show Overdue
          </button>
        </div>
      )}

      <div className="tasks-page__filters glass-card animate-fade-in-up">
        <input
          type="text"
          className="input-field"
          placeholder="🔍 Search tasks..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ minWidth: 200 }}
        />

        <select
          className="input-field"
          value={filter.status}
          onChange={(e) => setFilter({ ...filter, status: e.target.value })}
          style={{ minWidth: 140 }}
        >
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="in-progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="overdue">⚠️ Overdue Only</option>
        </select>

        <select
          className="input-field"
          value={sortOption}
          onChange={(e) => setSortOption(e.target.value)}
          style={{ minWidth: 170 }}
        >
          <option value="dueDate_asc">📅 Due: Earliest First</option>
          <option value="dueDate_desc">📅 Due: Latest First</option>
          <option value="priority_desc">⚡ Priority: High → Low</option>
          <option value="priority_asc">⚡ Priority: Low → High</option>
          <option value="createdAt_desc">🕒 Created: Newest</option>
          <option value="createdAt_asc">🕒 Created: Oldest</option>
        </select>

        <select
          className="input-field"
          value={filter.type}
          onChange={(e) => setFilter({ ...filter, type: e.target.value })}
          style={{ minWidth: 140 }}
        >
          <option value="">All Types</option>
          <option value="assignment">Assignment</option>
          <option value="exam">Exam</option>
          <option value="reading">Reading</option>
          <option value="project">Project</option>
          <option value="revision">Revision</option>
          <option value="other">Other</option>
        </select>
      </div>

      {tasks.length === 0 ? (
        <div className="tasks-page__empty glass-card animate-fade-in-up">
          <div className="tasks-page__empty-icon">📋</div>
          <h3>No tasks found</h3>
          <p>Create your first task or change filter criteria to see your tasks</p>
          <button className="btn-primary" onClick={openCreate}>+ Create Task</button>
        </div>
      ) : (
        <div className="tasks-page__list">
          {tasks.map((task, i) => {
            const due = daysUntil(task.dueDate);
            const isTaskOverdue = due.overdue && task.status !== 'completed';

            return (
              <div
                key={task._id}
                className={`tasks-page__card glass-card animate-fade-in-up stagger-${Math.min(i + 1, 6)} ${task.status === 'completed' ? 'tasks-page__card--done' : ''} ${isTaskOverdue ? 'tasks-page__card--overdue' : ''}`}
                onClick={() => setDetailTask(task)}
              >
                <button
                  className={`tasks-page__status-btn tasks-page__status-btn--${task.status}`}
                  onClick={(e) => handleStatusToggle(task, e)}
                  title={`Status: ${task.status}. Click to change.`}
                >
                  {task.status === 'completed' ? '✓' : task.status === 'in-progress' ? '◐' : '○'}
                </button>

                <div className="tasks-page__card-body">
                  <div className="tasks-page__card-top">
                    <span className="tasks-page__card-type">{typeIcon(task.type)}</span>
                    <h3 className="tasks-page__card-title">{task.title}</h3>
                  </div>
                  {task.description && <p className="tasks-page__card-desc">{task.description}</p>}
                  <div className="tasks-page__card-meta">
                    {task.subject && (
                      <span className="tasks-page__card-subject" style={{ borderColor: task.subject.color, color: task.subject.color }}>
                        {task.subject.icon} {task.subject.name}
                      </span>
                    )}
                    <span className={`badge badge-${task.priority >= 4 ? 'rose' : task.priority >= 3 ? 'amber' : 'blue'}`}>
                      P{task.priority} · {priorityLabel(task.priority)}
                    </span>
                    <span className={`tasks-page__due ${isTaskOverdue ? 'tasks-page__due--overdue' : ''}`}>
                      {isTaskOverdue ? `⚠️ ${due.text}` : `📅 ${due.text}`}
                    </span>
                  </div>
                  <div className="tasks-page__card-progress">
                    <div className="tasks-page__card-progress-bar">
                      <div
                        className="tasks-page__card-progress-fill"
                        style={{ width: `${Math.min(((task.completedMinutes || 0) / (task.estimatedMinutes || 60)) * 100, 100)}%` }}
                      ></div>
                    </div>
                    <span className="tasks-page__card-progress-text">
                      {task.completedMinutes || 0}/{task.estimatedMinutes || 60} min
                    </span>
                  </div>
                </div>

                <div className="tasks-page__card-actions" onClick={(e) => e.stopPropagation()}>
                  <button
                    className="btn-timer-icon"
                    onClick={() => startFocusTimer(task)}
                    title="Start focus timer on this task"
                  >
                    ⏱️
                  </button>
                  <button
                    className="tasks-page__action-icon"
                    onClick={() => openEdit(task)}
                    title="Edit task"
                  >
                    ✏️
                  </button>
                  <button
                    className="tasks-page__delete-btn"
                    onClick={() => setDeleteConfirmTask(task)}
                    title="Delete task"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Dedicated Task Detail View Modal */}
      {detailTask && (
        <div className="modal-overlay" onClick={(e) => e.target.className === 'modal-overlay' && setDetailTask(null)}>
          <div className="modal-content animate-scale-in">
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: '1.4rem' }}>{typeIcon(detailTask.type)}</span>
                <div>
                  <h2 style={{ fontSize: '1.25rem', margin: 0 }}>{detailTask.title}</h2>
                  <span className="badge badge-purple" style={{ textTransform: 'capitalize', marginTop: 4 }}>
                    {detailTask.type}
                  </span>
                </div>
              </div>
              <button className="modal-close" onClick={() => setDetailTask(null)}>✕</button>
            </div>

            <div className="task-detail-body">
              {detailTask.description && (
                <div className="task-detail-section">
                  <label className="label">Description</label>
                  <p className="task-detail-description">{detailTask.description}</p>
                </div>
              )}

              <div className="task-detail-grid">
                <div className="task-detail-item">
                  <span className="task-detail-label">Subject</span>
                  <span className="task-detail-value">
                    {detailTask.subject ? (
                      <span style={{ color: detailTask.subject.color }}>
                        {detailTask.subject.icon} {detailTask.subject.name}
                      </span>
                    ) : 'None'}
                  </span>
                </div>

                <div className="task-detail-item">
                  <span className="task-detail-label">Status</span>
                  <button
                    className={`badge badge-${detailTask.status === 'completed' ? 'emerald' : detailTask.status === 'in-progress' ? 'amber' : 'blue'}`}
                    style={{ cursor: 'pointer', border: 'none' }}
                    onClick={() => handleStatusToggle(detailTask)}
                  >
                    {detailTask.status === 'completed' ? '✓ Completed' : detailTask.status === 'in-progress' ? '◐ In Progress' : '○ Pending'}
                  </button>
                </div>

                <div className="task-detail-item">
                  <span className="task-detail-label">Priority & Difficulty</span>
                  <span className="task-detail-value">
                    P{detailTask.priority} ({priorityLabel(detailTask.priority)}) · D{detailTask.difficulty}/5
                  </span>
                </div>

                <div className="task-detail-item">
                  <span className="task-detail-label">Due Date</span>
                  <span className={`task-detail-value ${new Date(detailTask.dueDate) < new Date() && detailTask.status !== 'completed' ? 'tasks-page__due--overdue' : ''}`}>
                    {new Date(detailTask.dueDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                    {new Date(detailTask.dueDate) < new Date() && detailTask.status !== 'completed' && ' (OVERDUE)'}
                  </span>
                </div>
              </div>

              <div className="task-detail-section" style={{ marginTop: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: '0.85rem' }}>
                  <span>Study Progress</span>
                  <strong>{detailTask.completedMinutes || 0} / {detailTask.estimatedMinutes || 60} mins ({Math.min(Math.round(((detailTask.completedMinutes || 0) / (detailTask.estimatedMinutes || 60)) * 100), 100)}%)</strong>
                </div>
                <div className="tasks-page__card-progress-bar" style={{ height: 8 }}>
                  <div
                    className="tasks-page__card-progress-fill"
                    style={{ width: `${Math.min(((detailTask.completedMinutes || 0) / (detailTask.estimatedMinutes || 60)) * 100, 100)}%` }}
                  ></div>
                </div>
              </div>

              {detailTask.tags && detailTask.tags.length > 0 && (
                <div className="task-detail-section" style={{ marginTop: 14 }}>
                  <label className="label">Tags</label>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {detailTask.tags.map((t, idx) => (
                      <span key={idx} className="badge badge-purple">#{t}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="task-detail-actions">
              <button
                className="btn-primary"
                onClick={() => startFocusTimer(detailTask)}
              >
                ▶ Start Focus Timer
              </button>
              <button
                className="btn-secondary"
                onClick={() => openEdit(detailTask)}
              >
                ✏️ Edit
              </button>
              <button
                className="btn-secondary"
                style={{ color: 'var(--accent-rose)', borderColor: 'rgba(244, 63, 94, 0.3)' }}
                onClick={() => setDeleteConfirmTask(detailTask)}
              >
                🗑️ Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmTask && (
        <div className="modal-overlay" onClick={() => setDeleteConfirmTask(null)}>
          <div className="modal-content animate-scale-in" style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <h2>Confirm Deletion</h2>
              <button className="modal-close" onClick={() => setDeleteConfirmTask(null)}>✕</button>
            </div>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>
              Are you sure you want to permanently delete task <strong>"{deleteConfirmTask.title}"</strong>? Any associated study records will remain in analytics.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button className="btn-secondary" onClick={() => setDeleteConfirmTask(null)}>
                Cancel
              </button>
              <button
                className="btn-primary"
                style={{ background: 'var(--gradient-danger, #f43f5e)' }}
                onClick={confirmDelete}
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={(e) => e.target.className === 'modal-overlay' && setShowModal(false)}>
          <div className="modal-content animate-scale-in">
            <div className="modal-header">
              <h2>{editTask ? 'Edit Task' : 'Create Task'}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSubmit} className="tasks-page__form">
              <div className="auth-field">
                <label className="label">Title *</label>
                <input
                  className="input-field"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. Chapter 4 Practice Questions"
                  required
                />
              </div>
              <div className="auth-field">
                <label className="label">Description</label>
                <textarea
                  className="input-field"
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Additional instructions or notes..."
                />
              </div>
              <div className="tasks-page__form-row">
                <div className="auth-field">
                  <label className="label">Type</label>
                  <select className="input-field" value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value })}>
                    <option value="assignment">Assignment</option>
                    <option value="exam">Exam</option>
                    <option value="reading">Reading</option>
                    <option value="project">Project</option>
                    <option value="revision">Revision</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="auth-field">
                  <label className="label">Subject</label>
                  <select className="input-field" value={formData.subject} onChange={(e) => setFormData({ ...formData, subject: e.target.value })}>
                    <option value="">None (General)</option>
                    {subjects.map(s => <option key={s._id} value={s._id}>{s.icon} {s.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="tasks-page__form-row">
                <div className="auth-field">
                  <label className="label">Priority (1: Low - 5: Critical)</label>
                  <input type="number" className="input-field" min={1} max={5} value={formData.priority} onChange={(e) => setFormData({ ...formData, priority: Number(e.target.value) })} />
                </div>
                <div className="auth-field">
                  <label className="label">Difficulty (1: Easy - 5: Hard)</label>
                  <input type="number" className="input-field" min={1} max={5} value={formData.difficulty} onChange={(e) => setFormData({ ...formData, difficulty: Number(e.target.value) })} />
                </div>
              </div>
              <div className="tasks-page__form-row">
                <div className="auth-field">
                  <label className="label">Due Date *</label>
                  <input type="date" className="input-field" value={formData.dueDate} onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })} required />
                </div>
                <div className="auth-field">
                  <label className="label">Estimated Study Minutes (5 - 1440)</label>
                  <input type="number" className="input-field" min={5} max={1440} value={formData.estimatedMinutes} onChange={(e) => setFormData({ ...formData, estimatedMinutes: Number(e.target.value) })} />
                </div>
              </div>
              <div className="auth-field">
                <label className="label">Tags (comma-separated)</label>
                <input className="input-field" placeholder="e.g. calculus, exam-prep, unit-1" value={formData.tags} onChange={(e) => setFormData({ ...formData, tags: e.target.value })} />
              </div>
              <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: 8 }}>
                {editTask ? 'Save Changes' : 'Create Task'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
