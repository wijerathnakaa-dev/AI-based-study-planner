import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { analyticsAPI, tasksAPI, scheduleAPI } from '../../services/api';
import toast from 'react-hot-toast';
import './Dashboard.css';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [overview, setOverview] = useState(null);
  const [recentTasks, setRecentTasks] = useState([]);
  const [schedule, setSchedule] = useState(null);
  const [recommendations, setRecommendations] = useState(null);
  const [activeRecIndex, setActiveRecIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [overviewRes, tasksRes, scheduleRes, recRes] = await Promise.all([
        analyticsAPI.getOverview(),
        tasksAPI.getAll({ sort: 'dueDate_asc', status: 'pending' }),
        scheduleAPI.generate({ days: 1 }),
        scheduleAPI.getRecommendations()
      ]);
      setOverview(overviewRes.data.data);
      setRecentTasks(tasksRes.data.data.slice(0, 5));
      setSchedule(scheduleRes.data.data);
      setRecommendations(recRes.data.data);
    } catch {
      setOverview(null);
      setRecentTasks([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteTask = async (taskId) => {
    try {
      await tasksAPI.updateStatus(taskId, 'completed');
      toast.success('Task completed! 🎉');
      fetchDashboardData();
    } catch {
      toast.error('Failed to update task');
    }
  };

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  const daysUntil = (date) => {
    const now = new Date();
    const due = new Date(date);
    const diff = Math.ceil((due - now) / (1000 * 60 * 60 * 24));
    if (diff < 0) return 'Overdue';
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    return `${diff} days`;
  };

  if (loading) {
    return <div className="loader"><div className="spinner"></div></div>;
  }

  const stats = overview ? [
    { icon: '✅', label: 'Tasks Completed', value: overview.tasks.completed, color: '#10b981' },
    { icon: '📋', label: 'Pending Tasks', value: overview.tasks.pending + overview.tasks.inProgress, color: '#f59e0b' },
    { icon: '⏱️', label: 'Study Hours', value: overview.study.totalHours, color: '#8b5cf6' },
    { icon: '🔥', label: 'Day Streak', value: overview.streak?.current || 0, color: '#f43f5e' }
  ] : [
    { icon: '✅', label: 'Tasks Completed', value: 0, color: '#10b981' },
    { icon: '📋', label: 'Pending Tasks', value: 0, color: '#f59e0b' },
    { icon: '⏱️', label: 'Study Hours', value: 0, color: '#8b5cf6' },
    { icon: '🔥', label: 'Day Streak', value: 0, color: '#f43f5e' }
  ];

  return (
    <div className="dashboard">
      <div className="dashboard__header animate-fade-in">
        <div>
          <h1 className="dashboard__greeting">
            {greeting()}, <span className="gradient-text">{user?.name?.split(' ')[0] || 'Student'}</span>
          </h1>
          <p className="dashboard__subtitle">Here's your study overview for today</p>
        </div>
        <div className="dashboard__header-actions">
          <Link to="/tasks" className="btn-primary">
            + New Task
          </Link>
        </div>
      </div>

      <div className="dashboard__stats">
        {stats.map((stat, i) => (
          <div
            key={stat.label}
            className={`dashboard__stat-card glass-card animate-fade-in-up stagger-${i + 1}`}
          >
            <div className="dashboard__stat-icon" style={{ background: `${stat.color}18` }}>
              {stat.icon}
            </div>
            <div className="dashboard__stat-info">
              <div className="dashboard__stat-value" style={{ color: stat.color }}>
                {stat.value}
              </div>
              <div className="dashboard__stat-label">{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Feature 1: Personalized Study Recommendation Banner */}
      {recommendations?.primaryRecommendation && (() => {
        const allRecs = [
          recommendations.primaryRecommendation,
          ...(recommendations.secondaryRecommendations || [])
        ].filter(Boolean);
        const currentRec = allRecs[activeRecIndex] || recommendations.primaryRecommendation;

        return (
          <div className="dashboard__ai-rec glass-card animate-fade-in-up" style={{ marginBottom: 24, padding: '20px 24px', borderLeft: '4px solid var(--accent-purple)' }}>
            {allRecs.length > 1 && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 14, overflowX: 'auto', paddingBottom: 4 }}>
                {allRecs.map((rec, idx) => (
                  <button
                    key={rec.task._id}
                    className={`day-tab-btn ${activeRecIndex === idx ? 'day-tab-btn--active' : ''}`}
                    onClick={() => setActiveRecIndex(idx)}
                    style={{ fontSize: '0.78rem', padding: '4px 12px' }}
                  >
                    {idx === 0 ? '⭐ Top Pick' : `Alternative #${idx}`} ({rec.aiScore}%)
                  </button>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
              <div style={{ flex: 1, minWidth: 260 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span>🎯</span>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent-purple-light)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Personalized Study Coach &amp; Recommendations
                  </span>
                  <span className="badge badge-purple">Match: {currentRec.aiScore}%</span>
                </div>
                <h3 style={{ fontSize: '1.2rem', margin: '4px 0 6px', color: 'var(--text-primary)' }}>
                  {currentRec.task.title}
                </h3>

                {recommendations?.coachAdvice && activeRecIndex === 0 && (
                  <div style={{ margin: '6px 0 10px', fontSize: '0.85rem', color: '#4338ca', background: '#f5f3ff', padding: '8px 14px', borderRadius: '8px', borderLeft: '3px solid var(--accent-purple)', lineHeight: 1.45 }}>
                    💬 <strong>Coach Note:</strong> {recommendations.coachAdvice}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', fontSize: '0.85rem', marginBottom: 8 }}>
                  {currentRec.task.subject && (
                    <span style={{ color: currentRec.task.subject.color, fontWeight: 600 }}>
                      {currentRec.task.subject.icon} {currentRec.task.subject.name}
                    </span>
                  )}
                  <span style={{ color: 'var(--text-secondary)' }}>
                    Technique: <strong>{currentRec.recommendedTechnique}</strong>
                  </span>
                  <span style={{ color: 'var(--text-secondary)' }}>
                    Duration: <strong>{currentRec.recommendedDuration} mins</strong>
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {currentRec.reasons.map((r, rIdx) => (
                    <span key={rIdx} style={{ fontSize: '0.78rem', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', padding: '3px 10px', borderRadius: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>
                      💡 {r}
                    </span>
                  ))}
                </div>
              </div>

              <button
                className="btn-primary"
                style={{ whiteSpace: 'nowrap', padding: '10px 22px' }}
                onClick={() =>
                  navigate('/timer', {
                    state: {
                      taskId: currentRec.task._id,
                      taskTitle: currentRec.task.title,
                      subjectId: currentRec.task.subject?._id,
                      duration: currentRec.recommendedDuration
                    }
                  })
                }
              >
                ▶ Start Focus Now
              </button>
            </div>
          </div>
        );
      })()}

      <div className="dashboard__grid">
        <div className="dashboard__section glass-card animate-fade-in-up stagger-3">
          <div className="dashboard__section-header">
            <h2>📋 Upcoming Tasks</h2>
            <Link to="/tasks" className="dashboard__see-all">View All →</Link>
          </div>

          {recentTasks.length === 0 ? (
            <div className="dashboard__empty">
              <p>🎉 No pending tasks! <Link to="/tasks">Add your first task</Link></p>
            </div>
          ) : (
            <div className="dashboard__tasks-list">
              {recentTasks.map((task) => (
                <div key={task._id} className="dashboard__task-item">
                  <button
                    className="dashboard__task-check"
                    onClick={() => handleCompleteTask(task._id)}
                    title="Mark as completed"
                  >
                    <span className={`priority-indicator priority-${task.priority}`}></span>
                  </button>
                  <div className="dashboard__task-info">
                    <div className="dashboard__task-title">{task.title}</div>
                    <div className="dashboard__task-meta">
                      {task.subject && (
                        <span
                          className="dashboard__task-subject"
                          style={{ color: task.subject.color }}
                        >
                          {task.subject.icon} {task.subject.name}
                        </span>
                      )}
                      <span className="dashboard__task-type badge badge-purple">{task.type}</span>
                    </div>
                  </div>
                  <div className={`dashboard__task-due ${new Date(task.dueDate) < new Date() ? 'overdue' : ''}`}>
                    {daysUntil(task.dueDate)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="dashboard__section glass-card animate-fade-in-up stagger-4">
          <div className="dashboard__section-header">
            <h2>💡 Study Insights</h2>
          </div>

          {schedule?.insights ? (
            <div className="dashboard__insights">
              {schedule.insights.map((insight, i) => (
                <div
                  key={i}
                  className={`dashboard__insight-card dashboard__insight--${insight.priority}`}
                >
                  <span className="dashboard__insight-icon">{insight.icon}</span>
                  <div>
                    <div className="dashboard__insight-title">{insight.title}</div>
                    <div className="dashboard__insight-msg">{insight.message}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="dashboard__empty">
              <p>💡 Add tasks and subjects to get personalized study insights!</p>
            </div>
          )}
        </div>

        <div className="dashboard__section glass-card animate-fade-in-up stagger-5">
          <div className="dashboard__section-header">
            <h2>📊 Progress</h2>
            <Link to="/analytics" className="dashboard__see-all">Details →</Link>
          </div>

          {overview ? (
            <div className="dashboard__progress">
              <div className="dashboard__progress-item">
                <div className="dashboard__progress-label">
                  <span>Task Completion</span>
                  <span className="dashboard__progress-pct">{overview.tasks.completionRate}%</span>
                </div>
                <div className="dashboard__progress-bar">
                  <div
                    className="dashboard__progress-fill"
                    style={{
                      width: `${overview.tasks.completionRate}%`,
                      background: 'var(--gradient-success)'
                    }}
                  ></div>
                </div>
              </div>

              <div className="dashboard__progress-item">
                <div className="dashboard__progress-label">
                  <span>Weekly Study Goal</span>
                  <span className="dashboard__progress-pct">
                    {Math.min(Math.round((overview.study.weeklyHours / ((user?.preferences?.studyHoursPerDay || 4) * 7)) * 100), 100)}%
                  </span>
                </div>
                <div className="dashboard__progress-bar">
                  <div
                    className="dashboard__progress-fill"
                    style={{
                      width: `${Math.min(Math.round((overview.study.weeklyHours / ((user?.preferences?.studyHoursPerDay || 4) * 7)) * 100), 100)}%`,
                      background: 'var(--gradient-primary)'
                    }}
                  ></div>
                </div>
              </div>

              <div className="dashboard__progress-stats">
                <div className="dashboard__mini-stat">
                  <div className="dashboard__mini-value">{overview.study.avgFocusScore}/10</div>
                  <div className="dashboard__mini-label">Avg Focus</div>
                </div>
                <div className="dashboard__mini-stat">
                  <div className="dashboard__mini-value">{overview.subjectCount}</div>
                  <div className="dashboard__mini-label">Subjects</div>
                </div>
                <div className="dashboard__mini-stat">
                  <div className="dashboard__mini-value">{overview.study.totalSessions}</div>
                  <div className="dashboard__mini-label">Sessions</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="dashboard__empty">
              <p>📈 Complete study sessions to see your progress!</p>
            </div>
          )}
        </div>

        <div className="dashboard__section glass-card animate-fade-in-up stagger-6">
          <div className="dashboard__section-header">
            <h2>⏰ Upcoming Deadlines</h2>
          </div>

          {overview?.upcomingDeadlines?.length > 0 ? (
            <div className="dashboard__deadlines">
              {overview.upcomingDeadlines.map((task) => (
                <div key={task._id} className="dashboard__deadline-item">
                  <div className="dashboard__deadline-date">
                    {formatDate(task.dueDate)}
                  </div>
                  <div className="dashboard__deadline-info">
                    <div className="dashboard__deadline-title">{task.title}</div>
                    {task.subject && (
                      <span style={{ color: task.subject.color, fontSize: '0.8rem' }}>
                        {task.subject.icon} {task.subject.name}
                      </span>
                    )}
                  </div>
                  <span className={`badge badge-${task.priority >= 4 ? 'rose' : task.priority >= 3 ? 'amber' : 'blue'}`}>
                    P{task.priority}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="dashboard__empty">
              <p>🎯 No upcoming deadlines this week!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
