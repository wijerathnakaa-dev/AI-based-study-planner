import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { analyticsAPI, tasksAPI, scheduleAPI } from '../../services/api';
import toast from 'react-hot-toast';
import './Dashboard.css';

export default function Dashboard() {
  const { user } = useAuth();
  const [overview, setOverview] = useState(null);
  const [recentTasks, setRecentTasks] = useState([]);
  const [schedule, setSchedule] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [overviewRes, tasksRes, scheduleRes] = await Promise.all([
        analyticsAPI.getOverview(),
        tasksAPI.getAll({ sort: 'dueDate', status: 'pending' }),
        scheduleAPI.generate({ days: 1 })
      ]);
      setOverview(overviewRes.data.data);
      setRecentTasks(tasksRes.data.data.slice(0, 5));
      setSchedule(scheduleRes.data.data);
    } catch (err) {
      // If no data yet, set empty defaults
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
      {/* Header */}
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

      {/* Stats Grid */}
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

      <div className="dashboard__grid">
        {/* Upcoming Tasks */}
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

        {/* AI Insights */}
        <div className="dashboard__section glass-card animate-fade-in-up stagger-4">
          <div className="dashboard__section-header">
            <h2>🤖 AI Insights</h2>
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
              <p>💡 Add tasks and subjects to get AI-powered insights!</p>
            </div>
          )}
        </div>

        {/* Progress Overview */}
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

        {/* Upcoming Deadlines */}
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
