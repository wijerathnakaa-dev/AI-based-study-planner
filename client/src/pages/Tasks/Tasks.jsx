import { useState, useEffect } from 'react';
import { tasksAPI, subjectsAPI } from '../../services/api';
import toast from 'react-hot-toast';
import './Tasks.css';

export default function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editTask, setEditTask] = useState(null);
  const [filter, setFilter] = useState({ status: '', priority: '', type: '' });
  const [search, setSearch] = useState('');
  const [formData, setFormData] = useState({
    title: '', description: '', type: 'assignment', priority: 3,
    difficulty: 3, dueDate: '', estimatedMinutes: 60, subject: '', tags: ''
  });

  useEffect(() => { fetchData(); }, [filter, search]);

  const fetchData = async () => {
    try {
      const params = { ...filter, search: search || undefined };
      Object.keys(params).forEach(k => !params[k] && delete params[k]);
      const [tasksRes, subjectsRes] = await Promise.all([
        tasksAPI.getAll(params),
        subjectsAPI.getAll()
      ]);
      setTasks(tasksRes.data.data);
      setSubjects(subjectsRes.data.data);
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
    setEditTask(task);
    setFormData({
      title: task.title,
      description: task.description || '',
      type: task.type,
      priority: task.priority,
      difficulty: task.difficulty,
      dueDate: task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '',
      estimatedMinutes: task.estimatedMinutes,
      subject: task.subject?._id || '',
      tags: task.tags?.join(', ') || ''
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = {
        ...formData,
        subject: formData.subject || undefined,
        tags: formData.tags ? formData.tags.split(',').map(t => t.trim()).filter(Boolean) : []
      };

      if (editTask) {
        await tasksAPI.update(editTask._id, data);
        toast.success('Task updated!');
      } else {
        await tasksAPI.create(data);
        toast.success('Task created!');
      }
      setShowModal(false);
      resetForm();
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save task');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this task?')) return;
    try {
      await tasksAPI.delete(id);
      toast.success('Task deleted');
      fetchData();
    } catch {
      toast.error('Failed to delete');
    }
  };

  const handleStatusToggle = async (task) => {
    const nextStatus = task.status === 'completed' ? 'pending' : task.status === 'pending' ? 'in-progress' : 'completed';
    try {
      await tasksAPI.updateStatus(task._id, nextStatus);
      toast.success(nextStatus === 'completed' ? 'Task completed! 🎉' : `Status: ${nextStatus}`);
      fetchData();
    } catch {
      toast.error('Failed to update status');
    }
  };

  const priorityLabel = (p) => ['', 'Low', 'Medium-Low', 'Medium', 'High', 'Critical'][p];
  const typeIcon = (t) => ({ assignment: '📝', exam: '📖', reading: '📕', project: '🔧', revision: '🔄', other: '📌' }[t] || '📌');

  const daysUntil = (date) => {
    const diff = Math.ceil((new Date(date) - new Date()) / (1000 * 60 * 60 * 24));
    if (diff < 0) return { text: `${Math.abs(diff)}d overdue`, overdue: true };
    if (diff === 0) return { text: 'Due today', overdue: false };
    if (diff === 1) return { text: 'Due tomorrow', overdue: false };
    return { text: `${diff} days left`, overdue: false };
  };

  if (loading) return <div className="loader"><div className="spinner"></div></div>;

  return (
    <div className="tasks-page">
      <div className="tasks-page__header animate-fade-in">
        <div>
          <h1>✅ Tasks</h1>
          <p className="tasks-page__subtitle">{tasks.length} tasks total</p>
        </div>
        <button className="btn-primary" onClick={openCreate}>+ New Task</button>
      </div>

      {/* Filters */}
      <div className="tasks-page__filters glass-card animate-fade-in-up">
        <input
          type="text"
          className="input-field"
          placeholder="🔍 Search tasks..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: 280 }}
        />
        <select className="input-field" value={filter.status} onChange={(e) => setFilter({ ...filter, status: e.target.value })} style={{ maxWidth: 160 }}>
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="in-progress">In Progress</option>
          <option value="completed">Completed</option>
        </select>
        <select className="input-field" value={filter.type} onChange={(e) => setFilter({ ...filter, type: e.target.value })} style={{ maxWidth: 160 }}>
          <option value="">All Types</option>
          <option value="assignment">Assignment</option>
          <option value="exam">Exam</option>
          <option value="reading">Reading</option>
          <option value="project">Project</option>
          <option value="revision">Revision</option>
        </select>
      </div>

      {/* Task List */}
      {tasks.length === 0 ? (
        <div className="tasks-page__empty glass-card animate-fade-in-up">
          <div className="tasks-page__empty-icon">📋</div>
          <h3>No tasks yet</h3>
          <p>Create your first task to start organizing your studies</p>
          <button className="btn-primary" onClick={openCreate}>+ Create Task</button>
        </div>
      ) : (
        <div className="tasks-page__list">
          {tasks.map((task, i) => {
            const due = daysUntil(task.dueDate);
            return (
              <div
                key={task._id}
                className={`tasks-page__card glass-card animate-fade-in-up stagger-${Math.min(i + 1, 6)} ${task.status === 'completed' ? 'tasks-page__card--done' : ''}`}
              >
                <button className={`tasks-page__status-btn tasks-page__status-btn--${task.status}`} onClick={() => handleStatusToggle(task)}>
                  {task.status === 'completed' ? '✓' : task.status === 'in-progress' ? '◐' : '○'}
                </button>

                <div className="tasks-page__card-body" onClick={() => openEdit(task)}>
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
                      {priorityLabel(task.priority)}
                    </span>
                    <span className={`tasks-page__due ${due.overdue ? 'tasks-page__due--overdue' : ''}`}>
                      {due.text}
                    </span>
                  </div>
                  {/* Progress bar */}
                  <div className="tasks-page__card-progress">
                    <div className="tasks-page__card-progress-bar">
                      <div
                        className="tasks-page__card-progress-fill"
                        style={{ width: `${Math.min((task.completedMinutes / task.estimatedMinutes) * 100, 100)}%` }}
                      ></div>
                    </div>
                    <span className="tasks-page__card-progress-text">
                      {task.completedMinutes}/{task.estimatedMinutes} min
                    </span>
                  </div>
                </div>

                <button className="tasks-page__delete-btn" onClick={() => handleDelete(task._id)} title="Delete task">
                  🗑️
                </button>
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
              <h2>{editTask ? 'Edit Task' : 'Create Task'}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSubmit} className="tasks-page__form">
              <div className="auth-field">
                <label className="label">Title *</label>
                <input className="input-field" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} required />
              </div>
              <div className="auth-field">
                <label className="label">Description</label>
                <textarea className="input-field" rows={3} value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
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
                    <option value="">None</option>
                    {subjects.map(s => <option key={s._id} value={s._id}>{s.icon} {s.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="tasks-page__form-row">
                <div className="auth-field">
                  <label className="label">Priority (1-5)</label>
                  <input type="number" className="input-field" min={1} max={5} value={formData.priority} onChange={(e) => setFormData({ ...formData, priority: Number(e.target.value) })} />
                </div>
                <div className="auth-field">
                  <label className="label">Difficulty (1-5)</label>
                  <input type="number" className="input-field" min={1} max={5} value={formData.difficulty} onChange={(e) => setFormData({ ...formData, difficulty: Number(e.target.value) })} />
                </div>
              </div>
              <div className="tasks-page__form-row">
                <div className="auth-field">
                  <label className="label">Due Date *</label>
                  <input type="date" className="input-field" value={formData.dueDate} onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })} required />
                </div>
                <div className="auth-field">
                  <label className="label">Est. Minutes</label>
                  <input type="number" className="input-field" min={5} value={formData.estimatedMinutes} onChange={(e) => setFormData({ ...formData, estimatedMinutes: Number(e.target.value) })} />
                </div>
              </div>
              <div className="auth-field">
                <label className="label">Tags (comma-separated)</label>
                <input className="input-field" placeholder="e.g. important, chapter-5" value={formData.tags} onChange={(e) => setFormData({ ...formData, tags: e.target.value })} />
              </div>
              <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: 8 }}>
                {editTask ? 'Update Task' : 'Create Task'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
