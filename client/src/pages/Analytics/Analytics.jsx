import { useState, useEffect } from 'react';
import { analyticsAPI } from '../../services/api';
import toast from 'react-hot-toast';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line, Doughnut, Bar } from 'react-chartjs-2';
import './Analytics.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export default function Analytics() {
  const [timeRange, setTimeRange] = useState(7);
  const [overview, setOverview] = useState(null);
  const [trends, setTrends] = useState([]);
  const [subjectPerf, setSubjectPerf] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAllAnalytics(timeRange);
  }, [timeRange]);

  const fetchAllAnalytics = async (days) => {
    try {
      const [ovRes, trRes, spRes] = await Promise.all([
        analyticsAPI.getOverview(),
        analyticsAPI.getStudyTrends(days),
        analyticsAPI.getSubjectPerformance()
      ]);
      setOverview(ovRes.data.data);
      setTrends(trRes.data.data);
      setSubjectPerf(spRes.data.data);
    } catch {
      toast.error('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="loader">
        <div className="spinner"></div>
      </div>
    );
  }

  const trendLabels = trends.map((t) => {
    const d = new Date(t.date);
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' });
  });

  const trendHoursData = trends.map((t) => t.hours);
  const trendFocusData = trends.map((t) => t.avgFocus);

  const studyTrendsChartData = {
    labels: trendLabels,
    datasets: [
      {
        label: 'Study Hours',
        data: trendHoursData,
        borderColor: '#8b5cf6',
        backgroundColor: 'rgba(139, 92, 246, 0.15)',
        fill: true,
        tension: 0.4,
        yAxisID: 'y'
      },
      {
        label: 'Avg Focus (1-10)',
        data: trendFocusData,
        borderColor: '#06b6d4',
        backgroundColor: 'transparent',
        borderDash: [5, 5],
        pointRadius: 4,
        tension: 0.2,
        yAxisID: 'y1'
      }
    ]
  };

  const trendOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: { color: '#334155', font: { weight: '500' } }
      }
    },
    scales: {
      x: {
        ticks: { color: '#64748b' },
        grid: { color: 'rgba(226, 232, 240, 0.8)' }
      },
      y: {
        type: 'linear',
        display: true,
        position: 'left',
        ticks: { color: '#6366f1' },
        grid: { color: 'rgba(226, 232, 240, 0.8)' },
        title: { display: true, text: 'Hours', color: '#6366f1', font: { weight: '600' } }
      },
      y1: {
        type: 'linear',
        display: true,
        position: 'right',
        min: 0,
        max: 10,
        grid: { drawOnChartArea: false },
        ticks: { color: '#0284c7' },
        title: { display: true, text: 'Focus Score', color: '#0284c7', font: { weight: '600' } }
      }
    }
  };

  const taskData = overview?.tasks || { completed: 0, inProgress: 0, pending: 0, overdue: 0 };
  const doughnutData = {
    labels: ['Completed', 'In Progress', 'Pending', 'Overdue'],
    datasets: [
      {
        data: [
          taskData.completed,
          taskData.inProgress,
          taskData.pending,
          taskData.overdue
        ],
        backgroundColor: ['#10b981', '#3b82f6', '#f59e0b', '#f43f5e'],
        borderColor: '#ffffff',
        borderWidth: 2
      }
    ]
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: { color: '#334155', boxWidth: 12, font: { weight: '500' } }
      }
    },
    cutout: '72%'
  };

  const subjectNames = subjectPerf.map((s) => s.name);
  const currentGrades = subjectPerf.map((s) => s.currentGrade || 0);
  const targetGrades = subjectPerf.map((s) => s.targetGrade || 0);

  const subjectChartData = {
    labels: subjectNames,
    datasets: [
      {
        label: 'Current Grade',
        data: currentGrades,
        backgroundColor: '#6366f1',
        borderRadius: 6
      },
      {
        label: 'Target Grade',
        data: targetGrades,
        backgroundColor: 'rgba(2, 132, 199, 0.25)',
        borderColor: '#0284c7',
        borderWidth: 1.5,
        borderRadius: 6
      }
    ]
  };

  const subjectChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        ticks: { color: '#475569' },
        grid: { color: 'rgba(226, 232, 240, 0.8)' }
      },
      y: {
        min: 0,
        max: 100,
        ticks: { color: '#475569' },
        grid: { color: 'rgba(226, 232, 240, 0.8)' }
      }
    },
    plugins: {
      legend: {
        labels: { color: '#334155', font: { weight: '500' } }
      }
    }
  };

  return (
    <div className="analytics-page">
      <div className="analytics-header animate-fade-in">
        <div>
          <h1 className="analytics-title">
            Academic <span className="gradient-text">Analytics</span>
          </h1>
          <p className="analytics-subtitle">
            Insights, completion rates, and learning momentum
          </p>
        </div>

        <div className="analytics-time-filter">
          {[7, 14, 30].map((d) => (
            <button
              key={d}
              className={`time-btn ${timeRange === d ? 'time-btn--active' : ''}`}
              onClick={() => setTimeRange(d)}
            >
              Last {d} Days
            </button>
          ))}
        </div>
      </div>

      <div className="analytics-kpis animate-fade-in-up stagger-1">
        <div className="kpi-card glass-card">
          <div className="kpi-icon-wrap" style={{ background: '#ede9fe', color: '#6366f1' }}>
            ⏱️
          </div>
          <div>
            <div className="kpi-value" style={{ color: '#4f46e5' }}>
              {overview?.study?.totalHours || 0} hrs
            </div>
            <div className="kpi-label">Total Time Studied</div>
          </div>
        </div>

        <div className="kpi-card glass-card">
          <div className="kpi-icon-wrap" style={{ background: '#e0f2fe', color: '#0284c7' }}>
            🎯
          </div>
          <div>
            <div className="kpi-value" style={{ color: '#0284c7' }}>
              {overview?.study?.avgFocusScore || 0}/10
            </div>
            <div className="kpi-label">Average Focus Score</div>
          </div>
        </div>

        <div className="kpi-card glass-card">
          <div className="kpi-icon-wrap" style={{ background: '#d1fae5', color: '#059669' }}>
            ✅
          </div>
          <div>
            <div className="kpi-value" style={{ color: '#059669' }}>
              {overview?.tasks?.completionRate || 0}%
            </div>
            <div className="kpi-label">Task Completion Rate</div>
          </div>
        </div>

        <div className="kpi-card glass-card">
          <div className="kpi-icon-wrap" style={{ background: '#ffe4e6', color: '#e11d48' }}>
            🔥
          </div>
          <div>
            <div className="kpi-value" style={{ color: '#e11d48' }}>
              {overview?.streak?.current || 0} Days
            </div>
            <div className="kpi-label">Current Streak (Best: {overview?.streak?.longest || 0})</div>
          </div>
        </div>
      </div>

      <div className="charts-grid animate-fade-in-up stagger-2">
        <div className="chart-card glass-card">
          <div className="chart-card-title">Study Hours & Focus Score Trends</div>
          <div className="chart-card-subtitle">
            Daily distribution of study time and self-reported focus
          </div>
          <div className="chart-wrapper">
            {(overview?.study?.totalSessions || 0) > 0 ? (
              <Line data={studyTrendsChartData} options={trendOptions} />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-tertiary)', textAlign: 'center', padding: 20 }}>
                <span style={{ fontSize: '2rem', marginBottom: 8 }}>⏱️</span>
                <strong>No study sessions logged in this period</strong>
                <p style={{ fontSize: '0.85rem', marginTop: 4 }}>Complete your first session with the Focus Timer to track trends!</p>
              </div>
            )}
          </div>
        </div>

        <div className="chart-card glass-card">
          <div className="chart-card-title">Task Distribution</div>
          <div className="chart-card-subtitle">Breakdown of current task statuses</div>
          <div className="chart-wrapper">
            {(taskData.completed + taskData.inProgress + taskData.pending + taskData.overdue) > 0 ? (
              <Doughnut data={doughnutData} options={doughnutOptions} />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-tertiary)', textAlign: 'center', padding: 20 }}>
                <span style={{ fontSize: '2rem', marginBottom: 8 }}>📋</span>
                <strong>No tasks created yet</strong>
                <p style={{ fontSize: '0.85rem', marginTop: 4 }}>Add assignments or exams in Tasks to view your distribution.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {subjectPerf.length > 0 && (
        <div className="subject-performance-section glass-card animate-fade-in-up stagger-3">
          <div className="chart-card-title">Grade Targets vs Actuals</div>
          <div className="chart-card-subtitle">
            Identify subjects that need immediate attention and study reinforcement
          </div>
          <div className="chart-wrapper" style={{ minHeight: '280px' }}>
            <Bar data={subjectChartData} options={subjectChartOptions} />
          </div>

          <div className="subject-perf-grid">
            {subjectPerf.map((sub) => (
              <div key={sub._id} className="subject-perf-card">
                <div className="subject-perf-top">
                  <span className="subject-perf-name" style={{ color: sub.color }}>
                    {sub.icon} {sub.name}
                  </span>
                  <span className="subject-perf-hours">⏱️ {sub.studyHours}h logged</span>
                </div>
                <div className="subject-perf-grades">
                  <span>
                    Current: <span className="grade-val">{sub.currentGrade}%</span>
                  </span>
                  <span>
                    Target: <span className="grade-val">{sub.targetGrade}%</span>
                  </span>
                </div>
                <div className="dashboard__progress-bar">
                  <div
                    className="dashboard__progress-fill"
                    style={{
                      width: `${Math.min(sub.completionRate, 100)}%`,
                      background: sub.color
                    }}
                  ></div>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                  {sub.completedTasks} / {sub.totalTasks} tasks completed ({sub.completionRate}%)
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
