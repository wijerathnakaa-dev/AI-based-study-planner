import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { scheduleAPI } from '../../services/api';
import toast from 'react-hot-toast';
import './Schedule.css';

export default function Schedule() {
  const [days, setDays] = useState(7);
  const [scheduleData, setScheduleData] = useState(null);
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchSchedule(days);
  }, []);

  const fetchSchedule = async (numDays) => {
    setGenerating(true);
    try {
      const res = await scheduleAPI.generate({ days: numDays });
      setScheduleData(res.data.data);
      setSelectedDayIndex(0);
    } catch {
      toast.error('Failed to generate AI schedule');
    } finally {
      setLoading(false);
      setGenerating(false);
    }
  };

  const handleDaysChange = (newDays) => {
    setDays(newDays);
    fetchSchedule(newDays);
  };

  const currentDaySchedule = scheduleData?.schedule?.[selectedDayIndex];

  if (loading) {
    return (
      <div className="loader">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="schedule-page">
      {/* Header */}
      <div className="schedule-header animate-fade-in">
        <div>
          <h1 className="schedule-title">
            AI <span className="gradient-text">Study Schedule</span>
          </h1>
          <p className="schedule-subtitle">
            Dynamically optimized based on urgency, difficulty, and your daily capacity
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
            onClick={() => fetchSchedule(days)}
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

      {/* AI Insights */}
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

      {/* Day Selector Pills */}
      {scheduleData?.schedule && scheduleData.schedule.length > 1 && (
        <div className="day-selector-bar animate-fade-in-up stagger-1">
          {scheduleData.schedule.map((day, idx) => (
            <button
              key={day.date}
              className={`day-pill ${selectedDayIndex === idx ? 'day-pill--active' : ''}`}
              onClick={() => setSelectedDayIndex(idx)}
            >
              <div className="day-pill-name">{day.dayName}</div>
              <div className="day-pill-date">{day.date}</div>
            </button>
          ))}
        </div>
      )}

      {/* Timeline sessions */}
      <div className="timeline-container animate-fade-in-up stagger-2">
        {currentDaySchedule?.sessions && currentDaySchedule.sessions.length > 0 ? (
          currentDaySchedule.sessions.map((slot, index) => (
            <div key={index} className="timeline-slot glass-card">
              <div className="slot-time">
                <span className="slot-hours">
                  {slot.startTime} – {slot.endTime}
                </span>
                <span className="slot-duration">⏱️ {slot.duration} mins</span>
              </div>

              <div className="slot-content">
                <div className="slot-title-row">
                  <span className="slot-title">{slot.taskTitle}</span>
                  {slot.subject && (
                    <span
                      className="slot-subject-badge"
                      style={{ color: slot.subject.color }}
                    >
                      {slot.subject.icon} {slot.subject.name}
                    </span>
                  )}
                  <span className="badge badge-purple">{slot.type}</span>
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
                  ▶ Start Focus
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="schedule-empty glass-card">
            <div className="schedule-empty-icon">🏖️</div>
            <h3>No study sessions scheduled for this day!</h3>
            <p>
              Either you have no upcoming tasks, or all tasks for this day are complete.{' '}
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
