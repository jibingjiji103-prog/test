import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LogOut, Menu, RefreshCw } from 'lucide-react';
import Button from '../ui/Button';
import { PAGE_META } from '../../config/navigation';
import { useApp } from '../../context/AppContext';
import { formatLongDate } from '../../lib/utils';

export default function TopHeader({ onOpenMobile }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { refresh, logout, notify, busy, user, connection } = useApp();
  const meta = PAGE_META[location.pathname] || PAGE_META['/dashboard'];
  const Icon = meta.icon;

  const handleRefresh = async () => {
    try {
      await refresh();
      notify('Records refreshed', 'success');
    } catch (error) {
      notify(error.message || 'Could not refresh records', 'error');
    }
  };

  const handleLogout = async () => {
    await logout();
    notify('You have been signed out', 'info');
    navigate('/login', { replace: true });
  };

  return (
    <header className="top-header">
      <div className="header-left">
        <Button variant="icon" size="sm" className="mobile-menu" onClick={onOpenMobile} aria-label="Open navigation"><Menu size={19} /></Button>
        <span className="page-icon"><Icon size={17} strokeWidth={1.9} /></span>
        <div className="header-title">
          <div className="header-title-row">
            <h1>{meta.title}</h1>
            {!connection.connected && <span className="demo-pill">Demo</span>}
          </div>
          <p>{meta.subtitle}</p>
        </div>
      </div>
      <div className="header-right">
        <span className="header-date">{formatLongDate(new Date())}</span>
        <span className="header-separator" />
        <Button variant="secondary" size="sm" icon={RefreshCw} onClick={handleRefresh} loading={busy}>Refresh</Button>
        <Button variant="dark" size="sm" icon={LogOut} onClick={handleLogout}>Log Out</Button>
      </div>
    </header>
  );
}
