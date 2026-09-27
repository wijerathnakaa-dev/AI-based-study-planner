import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { authAPI } from '../../services/api';
import toast from 'react-hot-toast';
import './Profile.css';

export default function Profile() {
  const { user, updateUser } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [preferences, setPreferences] = useState({
    studyHoursPerDay: user?.preferences?.studyHoursPerDay || 4,
    sessionDuration: user?.preferences?.sessionDuration || 45,
    breakDuration: user?.preferences?.breakDuration || 15,
    preferredStartTime: user?.preferences?.preferredStartTime || '09:00',
    preferredEndTime: user?.preferences?.preferredEndTime || '21:00'
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await authAPI.updateProfile({
        name,
        preferences: {
          studyHoursPerDay: Number(preferences.studyHoursPerDay),
          sessionDuration: Number(preferences.sessionDuration),
          breakDuration: Number(preferences.breakDuration),
          preferredStartTime: preferences.preferredStartTime,
          preferredEndTime: preferences.preferredEndTime
        }
      });
      updateUser(res.data.data);
      toast.success('Profile and preferences updated! ✨');
    } catch {
      toast.error('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="profile-page">
      <div className="profile-header animate-fade-in">
        <h1 className="profile-title">
          Student <span className="gradient-text">Profile & Preferences</span>
        </h1>
        <p className="profile-subtitle">
          Fine-tune how the AI schedule algorithm tailors your daily study sessions
        </p>
      </div>

      <div className="profile-grid animate-fade-in-up">
        {/* User Card */}
        <div className="profile-card glass-card">
          <div className="profile-avatar-large">
            {user?.name?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div className="profile-name">{user?.name || 'Student'}</div>
          <div className="profile-email">{user?.email}</div>

          <div className="streak-badge-card">
            <div className="streak-stat-item">
              <div className="streak-stat-val">🔥 {user?.studyStreak?.current || 0}</div>
              <div className="streak-stat-lbl">Current Streak</div>
            </div>
            <div className="streak-stat-item">
              <div className="streak-stat-val">🏆 {user?.studyStreak?.longest || 0}</div>
              <div className="streak-stat-lbl">Record Streak</div>
            </div>
          </div>
        </div>

        {/* Settings Form */}
        <div className="settings-card glass-card">
          <form onSubmit={handleSubmit}>
            <div className="settings-section-title">
              <span>👤</span> General Information
            </div>

            <div className="auth-field" style={{ marginBottom: '20px' }}>
              <label className="label" htmlFor="user-name">Full Name</label>
              <input
                id="user-name"
                type="text"
                className="input-field"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="settings-section-title" style={{ marginTop: '28px' }}>
              <span>⚙️</span> AI Study Scheduler Settings
            </div>

            <div className="form-row">
              <div className="auth-field">
                <label className="label" htmlFor="pref-study-hours">Study Hours / Day</label>
                <input
                  id="pref-study-hours"
                  type="number"
                  min="1"
                  max="16"
                  className="input-field"
                  value={preferences.studyHoursPerDay}
                  onChange={(e) =>
                    setPreferences({ ...preferences, studyHoursPerDay: e.target.value })
                  }
                />
              </div>

              <div className="auth-field">
                <label className="label" htmlFor="pref-session-dur">Session Duration (Mins)</label>
                <input
                  id="pref-session-dur"
                  type="number"
                  min="15"
                  max="120"
                  step="5"
                  className="input-field"
                  value={preferences.sessionDuration}
                  onChange={(e) =>
                    setPreferences({ ...preferences, sessionDuration: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="form-row">
              <div className="auth-field">
                <label className="label" htmlFor="pref-break-dur">Break Duration (Mins)</label>
                <input
                  id="pref-break-dur"
                  type="number"
                  min="5"
                  max="45"
                  step="5"
                  className="input-field"
                  value={preferences.breakDuration}
                  onChange={(e) =>
                    setPreferences({ ...preferences, breakDuration: e.target.value })
                  }
                />
              </div>

              <div className="auth-field">
                <label className="label" htmlFor="pref-start-time">Preferred Start Time</label>
                <input
                  id="pref-start-time"
                  type="time"
                  className="input-field"
                  value={preferences.preferredStartTime}
                  onChange={(e) =>
                    setPreferences({ ...preferences, preferredStartTime: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="form-row">
              <div className="auth-field">
                <label className="label" htmlFor="pref-end-time">Preferred End Time</label>
                <input
                  id="pref-end-time"
                  type="time"
                  className="input-field"
                  value={preferences.preferredEndTime}
                  onChange={(e) =>
                    setPreferences({ ...preferences, preferredEndTime: e.target.value })
                  }
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
