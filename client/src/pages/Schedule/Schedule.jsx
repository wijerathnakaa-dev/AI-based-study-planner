import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { scheduleAPI, tasksAPI } from '../../services/api';
import toast from 'react-hot-toast';
import './Schedule.css';

export default function Schedule() {
  const [days, setDays] = useState(7);
  const [scheduleData, setScheduleData] = useState(null);
  const [recommendations, setRecommendations] = useState(null);
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [sessionStatuses, setSessionStatuses] = useState({});
  const navigate = useNavigate();

  useEffect(() => {
    loadAllData(days);
  }, []);

  const loadAllData = async (numDays) => {
    setGenerating(true);
    try {
      const [schedRes, recRes] = await Promise.all([
        scheduleAPI.generate({ days: numDays }),
        scheduleAPI.getRecommendations()
      ]);
      setScheduleData(schedRes.data.data);
      setRecommendations(recRes.data.data);
      setSelectedDayIndex(0);
    } catch {
      toast.error('Failed to generate study schedule');
    } finally {
      setLoading(false);
      setGenerating(false);
    }
  };

  const handleDaysChange = (newDays) => {
    setDays(newDays);
    loadAllData(newDays);
  };

  const handleSessionDone = async (slot) => {
    try {
      await tasksAPI.updateStatus(slot.taskId, 'completed');
      setSessionStatuses(prev => ({ ...prev, [slot.id]: 'completed' }));
      toast.success(`Marked "${slot.taskTitle}" as completed! 🎉`);
    } catch {
      toast.error('Failed to update task status');
    }
  };

  const handleRescheduleSession = (slot) => {
    if (!scheduleData?.schedule || scheduleData.schedule.length <= 1) {
      toast.error('No later days in current schedule view. Select 3 or 7 Days to reschedule.');
      return;
    }

    const nextDayIndex = (selectedDayIndex + 1) % scheduleData.schedule.length;
    const targetDay = scheduleData.schedule[nextDayIndex];

    // Move slot to target day
    targetDay.sessions.push({ ...slot, id: `${slot.id}-rescheduled` });
    setSessionStatuses(prev => ({ ...prev, [slot.id]: 'rescheduled' }));

    toast.success(`Rescheduled "${slot.taskTitle}" to ${targetDay.dayName}! ⏩`);
  };

  const handleSkipSession = (slot) => {
    setSessionStatuses(prev => ({ ...prev, [slot.id]: 'skipped' }));
    toast('Session skipped', { icon: '⏭️' });
  };

  const currentDaySchedule = scheduleData?.schedule?.[selectedDayIndex];

  if (loading) {
    return (
      <div className="loader">
        <div className="spinner"></div>
      </div>
    );
  }

  const primaryRec = recommendations?.primaryRecommendation;

  return (
    <div className="schedule-page">
      <div className="schedule-header animate-fade-in">
        <div>
          <h1 className="schedule-title">
            Optimized <span className="gradient-text">Study Schedule</span>
          </h1>
          <p className="schedule-subtitle">
            Dynamically optimized with multi-day work distribution, deadline protection, and capacity constraints
          </p>
        </div>

        <div className="schedule-controls">
          <div className="days-select">
            {[1, 3, 7].map((d) => (
              <button
                key={d}
                className={`day-tab-btn ${days === d ? 'day-tab-btn--active' : ''}`}
                onClick={() => handleDaysChange(d)}
                disabled={generating}
              >
                {d === 1 ? 'Today' : `${d} Days`}
              </button>
            ))}
          </div>

          <button
            className="btn-primary"
            onClick={() => loadAllData(days)}
            disabled={generating}
          >
            {generating ? (
              <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }}></span>
            ) : (
              '⚡ Recalculate'
            )}
          </button>
        </div>
      </div>

      {/* Feature 1: Personalized Study Recommendation Banner */}
      {primaryRec && (
        <div className="ai-rec-hero glass-card animate-fade-in-up" style={{ marginBottom: 24, padding: '20px 24px', borderLeft: '4px solid var(--accent-purple)', background: 'linear-gradient(135deg, #f5f3ff 0%, #ffffff 100%)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: '1.2rem' }}>🎯</span>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, letterSpacing: '0.05em', color: 'var(--accent-purple-light)', textTransform: 'uppercase' }}>
                  Top Recommended Session
                </span>
                <span className="badge badge-purple">Match: {primaryRec.aiScore}/100</span>
              </div>
              <h3 style={{ fontSize: '1.2rem', margin: '4px 0', color: 'var(--text-primary)' }}>
                {primaryRec.task.title}
              </h3>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', margin: '6px 0 10px', flexWrap: 'wrap', fontSize: '0.85rem' }}>
                {primaryRec.task.subject && (
                  <span style={{ color: primaryRec.task.subject.color, fontWeight: 600 }}>
                    {primaryRec.task.subject.icon} {primaryRec.task.subject.name}
                  </span>
                )}
                <span style={{ color: 'var(--text-secondary)' }}>
                  🎯 Method: <strong>{primaryRec.recommendedTechnique}</strong>
                </span>
                <span style={{ color: 'var(--text-secondary)' }}>
                  ⏱️ Suggested: <strong>{primaryRec.recommendedDuration} mins</strong>
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {primaryRec.reasons.map((r, idx) => (
                  <span key={idx} style={{ fontSize: '0.78rem', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', padding: '3px 10px', borderRadius: '12px', color: 'var(--text-secondary)' }}>
                    {r}
                  </span>
                ))}
              </div>
            </div>

            <button
              className="btn-primary"
              style={{ padding: '10px 20px', whiteSpace: 'nowrap' }}
              onClick={() =>
                navigate('/timer', {
                  state: {
                    taskId: primaryRec.task._id,
                    taskTitle: primaryRec.task.title,
                    subjectId: primaryRec.task.subject?._id,
                    duration: primaryRec.recommendedDuration
                  }
                })
              }
            >
              ▶ Start Recommended Focus
            </button>
          </div>
        </div>
      )}

      {scheduleData?.insights && scheduleData.insights.length > 0 && (
        <div className="schedule-insights animate-fade-in-up">
          {scheduleData.insights.map((insight, idx) => (
            <div
              key={idx}
              className={`insight-card insight-card--${insight.priority || 'info'}`}
            >
              <div className="insight-icon">{insight.icon || '💡'}</div>
              <div>
                <div className="insight-title">{insight.title}</div>
                <div className="insight-message">{insight.message}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {scheduleData?.schedule && scheduleData.schedule.length > 1 && (
        <div className="day-selector-bar animate-fade-in-up stagger-1">
          {scheduleData.schedule.map((day, idx) => (
            <button
              key={day.date}
              className={`day-pill ${selectedDayIndex === idx ? 'day-pill--active' : ''}`}
              onClick={() => setSelectedDayIndex(idx)}
            >
              <div className="day-pill-name">{day.dayName}</div>
              <div className="day-pill-date">{day.date} ({day.sessions.filter(s => sessionStatuses[s.id] !== 'skipped').length} slots)</div>
            </button>
          ))}
        </div>
      )}

      <div className="timeline-container animate-fade-in-up stagger-2">
        {currentDaySchedule?.sessions && currentDaySchedule.sessions.filter(s => sessionStatuses[s.id] !== 'skipped').length > 0 ? (
          currentDaySchedule.sessions.map((slot, index) => {
            const status = sessionStatuses[slot.id];
            if (status === 'skipped') return null;

            return (
              <div
                key={slot.id || index}
                className={`timeline-slot glass-card ${status === 'completed' ? 'timeline-slot--done' : ''} ${status === 'rescheduled' ? 'timeline-slot--rescheduled' : ''}`}
              >
                <div className="slot-time">
                  <span className="slot-hours">
                    {slot.startTime} – {slot.endTime}
                  </span>
                  <span className="slot-duration">⏱️ {slot.duration} mins</span>
                </div>

                <div className="slot-content">
                  <div className="slot-title-row">
                    <span className="slot-title" style={{ textDecoration: status === 'completed' ? 'line-through' : 'none' }}>
                      {slot.taskTitle}
                    </span>
                    {slot.subject && (
                      <span
                        className="slot-subject-badge"
                        style={{ color: slot.subject.color }}
                      >
                        {slot.subject.icon} {slot.subject.name}
                      </span>
                    )}
                    <span className="badge badge-purple">{slot.type}</span>
                    {status === 'completed' && <span className="badge badge-emerald">✓ Done</span>}
                    {status === 'rescheduled' && <span className="badge badge-amber">⏩ Rescheduled</span>}
                  </div>

                  <div className="slot-meta">
                    <span
                      className={`slot-urgency ${
                        slot.urgencyScore >= 75
                          ? 'slot-urgency--high'
                          : slot.urgencyScore >= 50
                          ? 'slot-urgency--med'
                          : 'slot-urgency--low'
                      }`}
                    >
                      ⚡ Urgency: {slot.urgencyScore}/100
                    </span>
                    <span>Priority P{slot.priority}</span>
                    {slot.dueDate && (
                      <span>Due: {new Date(slot.dueDate).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>

                <div className="slot-actions">
                  <button
                    className="btn-start-focus"
                    onClick={() =>
                      navigate('/timer', {
                        state: {
                          taskId: slot.taskId,
                          taskTitle: slot.taskTitle,
                          subjectName: slot.subject?.name,
                          duration: slot.duration
                        }
                      })
                    }
                  >
                    ▶ Focus
                  </button>

                  <button
                    className="btn-secondary"
                    style={{ padding: '6px 10px', fontSize: '0.8rem' }}
                    onClick={() => handleSessionDone(slot)}
                    title="Mark session completed"
                  >
                    ✓ Done
                  </button>

                  <button
                    className="btn-secondary"
                    style={{ padding: '6px 10px', fontSize: '0.8rem' }}
                    onClick={() => handleRescheduleSession(slot)}
                    title="Reschedule to next day"
                  >
                    ⏩ Next Day
                  </button>

                  <button
                    className="btn-secondary"
                    style={{ padding: '6px 8px', fontSize: '0.8rem', opacity: 0.7 }}
                    onClick={() => handleSkipSession(slot)}
                    title="Skip session"
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="schedule-empty glass-card">
            <div className="schedule-empty-icon">🏖️</div>
            <h3>No study sessions scheduled for this day!</h3>
            <p>
              Either you have no active tasks remaining, or all tasks for this day are complete.{' '}
              <Link to="/tasks" style={{ color: 'var(--accent-purple-light)' }}>
                Add more tasks
              </Link>{' '}
              to generate a study plan.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
