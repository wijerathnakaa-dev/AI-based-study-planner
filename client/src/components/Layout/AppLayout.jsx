import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import NotificationBell from '../Notifications/NotificationBell';
import './AppLayout.css';

export default function AppLayout() {
  return (
    <div className="app-layout">
      <Sidebar />
      <main className="app-layout__main">
        <header className="app-topbar">
          <div className="app-topbar__search">
            <span className="app-topbar__tagline">
              ⚡ Academic Success Tracker &amp; Study Planner
            </span>
          </div>
          <div className="app-topbar__actions">
            <NotificationBell />
          </div>
        </header>
        <div className="app-layout__content">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
