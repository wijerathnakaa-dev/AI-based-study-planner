import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { subjectsAPI, tasksAPI, analyticsAPI } from '../../services/api';
import toast from 'react-hot-toast';
import './Timer.css';

const MODES = {
  POMODORO: { name: 'Pomodoro', duration: 25 * 60, label: 'Focus Session' },
  DEEP_WORK: { name: 'Deep Work', duration: 45 * 60, label: 'Deep Study' },
  SHORT_BREAK: { name: 'Short Break', duration: 5 * 60, label: 'Short Rest' },
  LONG_BREAK: { name: 'Long Break', duration: 15 * 60, label: 'Long Rest' }
};

export default function Timer() {
  const location = useLocation();
  const [activeMode, setActiveMode] = useState('POMODORO');
  const [totalSeconds, setTotalSeconds] = useState(MODES.POMODORO.duration);
  const [timeLeft, setTimeLeft] = useState(MODES.POMODORO.duration);
  const [isRunning, setIsRunning] = useState(false);

  const [subjects, setSubjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedTask, setSelectedTask] = useState('');

  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [completedDuration, setCompletedDuration] = useState(25);
  const [focusScore, setFocusScore] = useState(8);
  const [sessionNotes, setSessionNotes] = useState('');
  const [savingSession, setSavingSession] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState(null);
  const [sessionEndTime, setSessionEndTime] = useState(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const timerRef = useRef(null);
  const sessionStartRef = useRef(null);
  const elapsedSecondsRef = useRef(0);

  const playChime = () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.3);

      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 1.2);
    } catch {
    }
  };

  useEffect(() => {
    loadInitialData();

    if (location.state?.taskId) {
      setSelectedTask(location.state.taskId);
    }
    if (location.state?.subjectId) {
      setSelectedSubject(location.state.subjectId);
    }
    if (location.state?.duration) {
      const customDur = Math.round(Number(location.state.duration) * 60);
      if (customDur > 0) {
        setTotalSeconds(customDur);
        setTimeLeft(customDur);
      }
    }
  }, [location.state]);

  const loadInitialData = async () => {
    try {
      const [subsRes, tasksRes] = await Promise.all([
        subjectsAPI.getAll(),
        tasksAPI.getAll({ status: 'pending' })
      ]);
      setSubjects(subsRes.data.data || []);
      setTasks(tasksRes.data.data || []);

      if (location.state?.taskId && tasksRes.data?.data) {
        const found = tasksRes.data.data.find(t => t._id === location.state.taskId);
        if (found && found.subject) {
          setSelectedSubject(found.subject._id || found.subject);
        }
      }
    } catch {
    }
  };

  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        elapsedSecondsRef.current += 1;
        setElapsedSeconds(elapsedSecondsRef.current);

        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            setIsRunning(false);
            playChime();
            triggerSessionCompletion(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning]);

  const triggerSessionCompletion = (isNaturalFinish) => {
    const now = new Date();
    const actualSeconds = elapsedSecondsRef.current;
    const actualMinutes = Math.max(1, Math.round(actualSeconds / 60));

    const calculatedStart = sessionStartRef.current
      ? sessionStartRef.current
      : new Date(now.getTime() - actualSeconds * 1000);

    setSessionStartTime(calculatedStart);
    setSessionEndTime(now);
    setCompletedDuration(actualMinutes);
    setShowCompleteModal(true);

    if (isNaturalFinish) {
      toast.success('Study session finished! 🎉 Great job staying focused!');
    } else {
      toast.success(`Completed ${actualMinutes} minute${actualMinutes > 1 ? 's' : ''} focus sprint!`);
    }
  };

  const handleManualComplete = () => {
    if (elapsedSecondsRef.current < 10) {
      toast.error('Session too short to record (focus for at least 10 seconds).');
      return;
    }
    setIsRunning(false);
    triggerSessionCompletion(false);
  };

  const handleModeChange = (modeKey) => {
    setIsRunning(false);
    setActiveMode(modeKey);
    const dur = MODES[modeKey].duration;
    setTotalSeconds(dur);
    setTimeLeft(dur);
    elapsedSecondsRef.current = 0;
    setElapsedSeconds(0);
    sessionStartRef.current = null;
    setSessionStartTime(null);
    setSessionEndTime(null);
  };

  const toggleStartPause = () => {
    if (!isRunning) {
      if (!sessionStartRef.current) {
        sessionStartRef.current = new Date();
        setSessionStartTime(sessionStartRef.current);
      }
      setIsRunning(true);
    } else {
      setIsRunning(false);
    }
  };

  const handleReset = () => {
    setIsRunning(false);
    elapsedSecondsRef.current = 0;
    setElapsedSeconds(0);
    sessionStartRef.current = null;
    setSessionStartTime(null);
    setSessionEndTime(null);
    setTimeLeft(totalSeconds);
    toast('Timer reset', { icon: '↺' });
  };

  const handleSaveSession = async () => {
    if (!sessionStartTime) {
      const derivedStart = new Date(Date.now() - completedDuration * 60 * 1000);
      setSessionStartTime(derivedStart);
    }

    const payloadStartTime = (sessionStartTime || new Date(Date.now() - completedDuration * 60 * 1000)).toISOString();
    const payloadEndTime = (sessionEndTime || new Date()).toISOString();

    setSavingSession(true);
    try {
      await analyticsAPI.createSession({
        subject: selectedSubject || undefined,
        task: selectedTask || undefined,
        startTime: payloadStartTime,
        endTime: payloadEndTime,
        duration: completedDuration,
        focusScore: Number(focusScore),
        notes: sessionNotes,
        type: activeMode === 'POMODORO' ? 'study' : 'revision'
      });

      toast.success('Study session logged to your analytics! 📈');
      setShowCompleteModal(false);
      setSessionNotes('');

      // Reset timer counters cleanly
      elapsedSecondsRef.current = 0;
      setElapsedSeconds(0);
      sessionStartRef.current = null;
      setSessionStartTime(null);
      setSessionEndTime(null);
      setTimeLeft(totalSeconds);

      // Reload tasks list to reflect updated completedMinutes
      loadInitialData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to log session');
    } finally {
      setSavingSession(false);
    }
  };

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const radius = 120;
  const circumference = 2 * Math.PI * radius;
  const progressOffset = circumference - (timeLeft / totalSeconds) * circumference;

  return (
    <div className="timer-page">
      <div className="timer-header animate-fade-in">
        <h1 className="timer-title">
          Focus <span className="gradient-text">Study Timer</span>
        </h1>
        <p className="timer-subtitle">
          Eliminate distractions, build deep focus, and log your study sessions
        </p>
      </div>

      <div className="timer-container glass-card animate-fade-in-up">
        <div className="timer-modes">
          {Object.keys(MODES).map((key) => (
            <button
              key={key}
              className={`mode-btn ${activeMode === key ? 'mode-btn--active' : ''}`}
              onClick={() => handleModeChange(key)}
            >
              {MODES[key].name}
            </button>
          ))}
        </div>

        <div className="timer-circle-wrapper">
          <svg className="timer-svg" viewBox="0 0 280 280">
            <defs>
              <linearGradient id="timerGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#8b5cf6" />
                <stop offset="100%" stopColor="#06b6d4" />
              </linearGradient>
            </defs>
            <circle
              className="timer-circle-bg"
              cx="140"
              cy="140"
              r={radius}
            />
            <circle
              className="timer-circle-progress"
              cx="140"
              cy="140"
              r={radius}
              strokeDasharray={circumference}
              strokeDashoffset={progressOffset}
            />
          </svg>

          <div className="timer-center-info">
            <div className="timer-countdown">{formatTime(timeLeft)}</div>
            <div className="timer-session-label">{MODES[activeMode].label}</div>
          </div>
        </div>

        <div className="timer-controls">
          <button
            className="btn-timer-secondary"
            onClick={handleReset}
            title="Reset timer"
          >
            ↺
          </button>

          <button className="btn-timer-primary" onClick={toggleStartPause}>
            {isRunning ? '❚❚ Pause' : '▶ Start Focus'}
          </button>

          <button
            className="btn-timer-secondary"
            onClick={handleManualComplete}
            title="Complete & log session early"
          >
            ✓
          </button>
        </div>

        <div className="timer-link-section">
          <div className="timer-select-group">
            <label className="label" htmlFor="timer-subject">Link Subject</label>
            <select
              id="timer-subject"
              className="input-field"
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
            >
              <option value="">None (General Study)</option>
              {subjects.map((sub) => (
                <option key={sub._id} value={sub._id}>
                  {sub.icon} {sub.name}
                </option>
              ))}
            </select>
          </div>

          <div className="timer-select-group">
            <label className="label" htmlFor="timer-task">Link Task</label>
            <select
              id="timer-task"
              className="input-field"
              value={selectedTask}
              onChange={(e) => setSelectedTask(e.target.value)}
            >
              <option value="">None (Free Focus)</option>
              {tasks.map((t) => (
                <option key={t._id} value={t._id}>
                  {t.title}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {showCompleteModal && (
        <div className="completion-modal-backdrop">
          <div className="completion-modal glass-card animate-scale-in">
            <h2 style={{ marginBottom: '8px', color: 'var(--text-primary)' }}>
              Session Logged! 🎉
            </h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '12px', fontSize: '0.9rem' }}>
              You completed <strong>{completedDuration} minute{completedDuration > 1 ? 's' : ''}</strong> of focused study.
            </p>
            {sessionStartTime && (
              <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginBottom: '16px', background: 'rgba(255,255,255,0.03)', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-glass)' }}>
                ⏱️ Started: {new Date(sessionStartTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })} · Finished: {new Date(sessionEndTime || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </div>
            )}

            <div style={{ marginBottom: '16px' }}>
              <div className="focus-slider-label">
                <span>Focus Score (1 - 10)</span>
                <span className="focus-score-number">{focusScore} / 10</span>
              </div>
              <input
                type="range"
                min="1"
                max="10"
                value={focusScore}
                onChange={(e) => setFocusScore(e.target.value)}
                style={{ width: '100%', accentColor: 'var(--accent-purple)' }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label className="label">Study Notes (optional)</label>
              <textarea
                className="input-field"
                rows={3}
                placeholder="What topics did you cover? Any key takeaways?"
                value={sessionNotes}
                onChange={(e) => setSessionNotes(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowCompleteModal(false)}
              >
                Skip Saving
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleSaveSession}
                disabled={savingSession}
              >
                {savingSession ? 'Saving...' : 'Save & Track'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
