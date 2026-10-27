import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Moon, PanelLeftClose, PanelLeftOpen, Sun, X } from 'lucide-react';
import Brand from './Brand';
import Button from '../ui/Button';
import { NAV_ITEMS, SETTINGS_ITEM } from '../../config/navigation';
import { useApp } from '../../context/AppContext';
import { getInitialsColor, initials } from '../../lib/utils';

export default function Sidebar({ collapsed, onToggleCollapse, mobileOpen, onCloseMobile }) {
  const { user, theme, setTheme, connection } = useApp();
  const location = useLocation();
  const isCollapsed = collapsed && !mobileOpen;

  const renderLink = (item) => (
    <NavLink
      key={item.path}
      to={item.path}
      title={isCollapsed ? item.label : undefined}
      onClick={onCloseMobile}
      className={({ isActive }) => `sidebar-link ${isActive || location.pathname.startsWith(`${item.path}/`) ? 'active' : ''}`}
    >
      <item.icon size={18} strokeWidth={1.85} />
      {!isCollapsed && <span>{item.label}</span>}
    </NavLink>
  );

  return (
    <>
      {mobileOpen && <button type="button" className="sidebar-scrim" aria-label="Close navigation" onClick={onCloseMobile} />}
      <aside className={`sidebar ${isCollapsed ? 'is-collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`} aria-label="Main navigation">
        <div className="sidebar-top">
          <Brand collapsed={isCollapsed} />
          <Button
            variant="icon" size="sm" className="collapse-button"
            onClick={onToggleCollapse}
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </Button>
          <Button variant="icon" size="sm" className="mobile-close" onClick={onCloseMobile} aria-label="Close navigation"><X size={17} /></Button>
        </div>

        <nav className="sidebar-nav">
          <div className="sidebar-links">{NAV_ITEMS.map(renderLink)}</div>
          <div className="sidebar-divider" />
          <div className="sidebar-links">{renderLink(SETTINGS_ITEM)}</div>
        </nav>

        <div className="sidebar-bottom">
          <div className="connection-note" title={connection.detail}>
            <span className={connection.connected ? 'status-dot online' : 'status-dot demo'} />
            {!isCollapsed && <span>{connection.label}</span>}
          </div>
          {user ? (
            <div className="sidebar-user" title={`${user.name} · ${user.email}`}>
              <span className="avatar" style={{ background: getInitialsColor(user.name) }}>{initials(user.name)}</span>
              {!isCollapsed && (
                <span className="sidebar-user-copy">
                  <strong>{user.name}</strong>
                  <small>{user.email}</small>
                  <em>{user.role}</em>
                </span>
              )}
              <button
                type="button" className="theme-toggle"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              >
                {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
              </button>
            </div>
          ) : null}
        </div>
      </aside>
    </>
  );
}
