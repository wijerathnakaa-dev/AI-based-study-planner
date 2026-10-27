import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './Sidebar.css';

const navItems = [
  { path: '/dashboard', icon: '📊', label: 'Dashboard' },
  { path: '/tasks', icon: '✅', label: 'Tasks' },
  { path: '/subjects', icon: '📚', label: 'Subjects' },
  { path: '/schedule', icon: '📅', label: 'Schedule' },
  { path: '/analytics', icon: '📈', label: 'Analytics' },
  { path: '/timer', icon: '⏱️', label: 'Study Timer' },
  { path: '/profile', icon: '👤', label: 'Profile' },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <aside className={`sidebar ${collapsed ? 'sidebar--collapsed' : ''}`}>
      <div className="sidebar__logo" onClick={() => navigate('/dashboard')}>
        <div className="sidebar__logo-icon">🧠</div>
        {!collapsed && <span className="sidebar__logo-text">StudyAI</span>}
      </div>

      <button
        className="sidebar__toggle"
        onClick={() => setCollapsed(!collapsed)}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? '→' : '←'}
      </button>

      <nav className="sidebar__nav">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `sidebar__link ${isActive ? 'sidebar__link--active' : ''}`
            }
            title={collapsed ? item.label : undefined}
          >
            <span className="sidebar__link-icon">{item.icon}</span>
            {!collapsed && <span className="sidebar__link-label">{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar__user">
        <div className="sidebar__user-avatar">
          {user?.name?.charAt(0).toUpperCase() || 'U'}
        </div>
        {!collapsed && (
          <div className="sidebar__user-info">
            <div className="sidebar__user-name">{user?.name || 'Student'}</div>
            <button className="sidebar__logout" onClick={handleLogout}>
              Sign out
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
