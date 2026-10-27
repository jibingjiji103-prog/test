import React, { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopHeader from './TopHeader';
import ToastStack from '../ui/Toast';
import { useApp } from '../../context/AppContext';

const SIDEBAR_KEY = 'edutrack.sidebar.collapsed';

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(SIDEBAR_KEY) === 'true');
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const { toasts, dismissToast } = useApp();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setMobileOpen(false);
  }, [location.pathname]);

  const toggle = () => setCollapsed((value) => {
    localStorage.setItem(SIDEBAR_KEY, String(!value));
    return !value;
  });

  return (
    <div className={`app-shell ${collapsed ? 'sidebar-collapsed' : ''}`}>
      <Sidebar
        collapsed={collapsed}
        onToggleCollapse={toggle}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />
      <div className="main-shell">
        <TopHeader onOpenMobile={() => setMobileOpen(true)} />
        <main className="main-content">
          <Outlet />
        </main>
        <footer className="app-footer">
          <span>© {new Date().getFullYear()} EduTrack CRM</span>
          <span>Original demo interface · Sample records are clearly marked</span>
        </footer>
      </div>
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
