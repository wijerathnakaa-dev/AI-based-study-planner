import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './Landing.css';

const features = [
  {
    icon: '📅',
    title: 'Automated Schedule Optimization',
    description: 'Smart algorithms analyze your deadlines, priorities, and study habits to create the perfect study plan.',
    color: '#8b5cf6'
  },
  {
    icon: '📊',
    title: 'Performance Analytics',
    description: 'Track your grades, study hours, and focus scores with beautiful visualizations and trend analysis.',
    color: '#06b6d4'
  },
  {
    icon: '🎯',
    title: 'Smart Task Management',
    description: 'Organize assignments, exams, and projects with priority-based sorting and deadline tracking.',
    color: '#10b981'
  },
  {
    icon: '⏱️',
    title: 'Focus Timer',
    description: 'Built-in Pomodoro timer to maximize productivity with timed study sessions and break reminders.',
    color: '#f59e0b'
  },
  {
    icon: '🔥',
    title: 'Study Streaks',
    description: 'Build consistency with daily study streak tracking and milestone celebrations.',
    color: '#f43f5e'
  },
  {
    icon: '📚',
    title: 'Subject Tracking',
    description: 'Monitor grades and study time per subject. Identify weak areas and allocate time smartly.',
    color: '#3b82f6'
  }
];

const stats = [
  { value: '10K+', label: 'Students' },
  { value: '98%', label: 'Improved Grades' },
  { value: '2M+', label: 'Tasks Completed' },
  { value: '4.9★', label: 'Rating' }
];

export default function Landing() {
  const { user } = useAuth();

  return (
    <div className="landing">
      <nav className="landing__nav">
        <div className="landing__nav-brand">
          <span className="landing__nav-icon">📚</span>
          <span className="landing__nav-name">StudyPlanner</span>
        </div>
        <div className="landing__nav-links">
          {user ? (
            <Link to="/dashboard" className="btn-primary">Dashboard →</Link>
          ) : (
            <>
              <Link to="/login" className="btn-secondary">Sign In</Link>
              <Link to="/register" className="btn-primary">Get Started Free</Link>
            </>
          )}
        </div>
      </nav>

      <section className="landing__hero">
        <div className="landing__hero-bg">
          <div className="landing__orb landing__orb--1"></div>
          <div className="landing__orb landing__orb--2"></div>
          <div className="landing__orb landing__orb--3"></div>
        </div>

        <div className="landing__hero-content">
          <div className="landing__hero-badge animate-fade-in">
            <span>✨</span> Study Planner &amp; Academic Success Tracker
          </div>
          <h1 className="landing__hero-title animate-fade-in-up">
            Study Smarter,<br />
            <span className="gradient-text">Not Harder</span>
          </h1>
          <p className="landing__hero-desc animate-fade-in-up stagger-2">
            Your personalized study companion that creates optimized schedules,
            tracks your academic performance, and helps you achieve your goals with
            intelligent insights.
          </p>
          <div className="landing__hero-actions animate-fade-in-up stagger-3">
            <Link to="/register" className="btn-primary btn-lg">
              Start For Free →
            </Link>
            <Link to="/login" className="btn-secondary btn-lg">
              Sign In
            </Link>
          </div>

          <div className="landing__stats animate-fade-in-up stagger-4">
            {stats.map((stat) => (
              <div key={stat.label} className="landing__stat">
                <div className="landing__stat-value">{stat.value}</div>
                <div className="landing__stat-label">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="landing__features" id="features">
        <div className="landing__section-header">
          <h2 className="landing__section-title">
            Everything You Need to <span className="gradient-text">Excel</span>
          </h2>
          <p className="landing__section-desc">
            Powerful tools designed to transform your study routine and maximize academic performance.
          </p>
        </div>

        <div className="landing__features-grid">
          {features.map((feature, i) => (
            <div
              key={feature.title}
              className={`landing__feature-card glass-card animate-fade-in-up stagger-${i + 1}`}
            >
              <div
                className="landing__feature-icon"
                style={{ background: `${feature.color}20`, boxShadow: `0 0 30px ${feature.color}15` }}
              >
                {feature.icon}
              </div>
              <h3 className="landing__feature-title">{feature.title}</h3>
              <p className="landing__feature-desc">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="landing__cta">
        <div className="landing__cta-content glass-card">
          <h2>Ready to Transform Your Studies?</h2>
          <p>Join thousands of students already achieving their academic goals with smart study planning.</p>
          <Link to="/register" className="btn-primary btn-lg">
            Get Started Free →
          </Link>
        </div>
      </section>

      <footer className="landing__footer">
        <div className="landing__footer-brand">
          <span>📚</span> StudyPlanner
        </div>
        <p>&copy; 2026 StudyPlanner. Built for students, by students.</p>
      </footer>
    </div>
  );
}
