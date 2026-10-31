import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { tasksAPI, subjectsAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import './NotificationBell.css';

export default function NotificationBell() {
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [readIds, setReadIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('read_notifications') || '[]');
    } catch {
      return [];
    }
  });

  const dropdownRef = useRef(null);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    loadReminders();
    const interval = setInterval(loadReminders, 60000); // Check every minute
    return () => clearInterval(interval);
  }, []);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadReminders = async () => {
    try {
      const [tasksRes, subjectsRes] = await Promise.all([
        tasksAPI.getAll(),
        subjectsAPI.getAll()
      ]);

      const allTasks = tasksRes.data?.data || [];
      const tasks = allTasks.filter((t) => t.status !== 'completed');
      const subjects = subjectsRes.data?.data || [];
      const now = new Date();
      const items = [];

      // 1. Task Overdue Reminders
      tasks.forEach((t) => {
        const due = new Date(t.dueDate);
        const diffHours = (due.getTime() - now.getTime()) / (1000 * 60 * 60);

        if (diffHours < 0) {
          items.push({
            id: `overdue-${t._id}`,
            taskId: t._id,
            title: `Task Overdue: ${t.title}`,
            message: `Was due on ${due.toLocaleDateString()}. Take action or reschedule!`,
            type: 'urgent',
            icon: '🚨',
            timestamp: due
          });
        } else if (diffHours <= 24) {
          items.push({
            id: `today-${t._id}`,
            taskId: t._id,
            title: `Due Today: ${t.title}`,
            message: `Only ${Math.max(1, Math.round(diffHours))} hours remaining before deadline.`,
            type: 'warning',
            icon: '⏰',
            timestamp: due
          });
        } else if (diffHours <= 48) {
          items.push({
            id: `tomorrow-${t._id}`,
            taskId: t._id,
            title: `Due Tomorrow: ${t.title}`,
            message: `Prepare now with a focused study session.`,
            type: 'info',
            icon: '📅',
            timestamp: due
          });
        }
      });

      // 2. Study Streak Reminder
      const streak = user?.studyStreak?.current || 0;
      if (streak > 0) {
        const lastStudy = user?.studyStreak?.lastStudyDate;
        const studiedToday = lastStudy && new Date(lastStudy).toISOString().split('T')[0] === now.toISOString().split('T')[0];
        if (!studiedToday) {
          items.push({
            id: 'streak-reminder',
            title: `${streak}-Day Study Streak at Risk!`,
            message: 'Complete a study session today to maintain your momentum.',
            type: 'streak',
            icon: '🔥',
            route: '/timer'
          });
        }
      }

      // 3. Performance / Grade gap reminders
      subjects.forEach((s) => {
        if (s.currentGrade > 0 && s.currentGrade < s.targetGrade - 10) {
          items.push({
            id: `gap-${s._id}`,
            title: `Grade Alert: ${s.name}`,
            message: `Current grade is ${s.currentGrade}% (${s.targetGrade - s.currentGrade}% below target ${s.targetGrade}%).`,
            type: 'performance',
            icon: '📊',
            route: '/analytics'
          });
        }
      });

      setNotifications(items);
    } catch {
    }
  };

  const markAllRead = () => {
    const allIds = notifications.map(n => n.id);
    setReadIds(allIds);
    localStorage.setItem('read_notifications', JSON.stringify(allIds));
  };

  const dismissNotification = (e, id) => {
    e.stopPropagation();
    const next = [...readIds, id];
    setReadIds(next);
    localStorage.setItem('read_notifications', JSON.stringify(next));
  };

  const handleNotificationClick = (item) => {
    // Mark as read
    if (!readIds.includes(item.id)) {
      const next = [...readIds, item.id];
      setReadIds(next);
      localStorage.setItem('read_notifications', JSON.stringify(next));
    }
    setIsOpen(false);

    if (item.taskId) {
      navigate('/timer', { state: { taskId: item.taskId } });
    } else if (item.route) {
      navigate(item.route);
    } else {
      navigate('/tasks');
    }
  };

  const unreadCount = notifications.filter(n => !readIds.includes(n.id)).length;

  return (
    <div className="notif-wrapper" ref={dropdownRef}>
      <button
        className="notif-bell-btn"
        onClick={() => setIsOpen(!isOpen)}
        title="Notifications & Reminders"
        aria-label="Notifications"
      >
        <span className="notif-bell-icon">🔔</span>
        {unreadCount > 0 && (
          <span className="notif-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
        )}
      </button>

      {isOpen && (
        <div className="notif-dropdown glass-card animate-scale-in">
          <div className="notif-dropdown-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>Reminders & Alerts</span>
              {unreadCount > 0 && (
                <span className="badge badge-purple" style={{ fontSize: '0.7rem' }}>
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button className="notif-mark-read-btn" onClick={markAllRead}>
                Mark all read
              </button>
            )}
          </div>

          <div className="notif-list">
            {notifications.length === 0 ? (
              <div className="notif-empty">
                <span>🎉</span>
                <p>All caught up! No active reminders or pending deadlines.</p>
              </div>
            ) : (
              notifications.map((item) => {
                const isRead = readIds.includes(item.id);
                return (
                  <div
                    key={item.id}
                    className={`notif-item notif-item--${item.type} ${isRead ? 'notif-item--read' : ''}`}
                    onClick={() => handleNotificationClick(item)}
                  >
                    <div className="notif-item-icon">{item.icon}</div>
                    <div className="notif-item-content">
                      <div className="notif-item-title">{item.title}</div>
                      <div className="notif-item-msg">{item.message}</div>
                    </div>
                    <button
                      className="notif-item-dismiss"
                      onClick={(e) => dismissNotification(e, item.id)}
                      title="Dismiss"
                    >
                      ✕
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

