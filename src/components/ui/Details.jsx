import React from 'react';
import { getInitialsColor, initials } from '../../lib/utils';

export function Avatar({ name = '', size = 'md', className = '' }) {
  return <span className={`avatar avatar-${size} ${className}`} style={{ background: getInitialsColor(name) }}>{initials(name)}</span>;
}

export function DetailGrid({ items = [], columns = 2 }) {
  return (
    <div className={`detail-grid detail-grid-${columns}`}>
      {items.map((item) => (
        <div className="detail-item" key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value ?? '—'}</strong>
        </div>
      ))}
    </div>
  );
}

export function DetailSection({ title, action, children, className = '' }) {
  return (
    <section className={`detail-section ${className}`}>
      <div className="detail-section-head"><h3>{title}</h3>{action}</div>
      {children}
    </section>
  );
}

export function ProgressBar({ value = 0, tone = 'accent', label, compact = false }) {
  const safeValue = Math.min(100, Math.max(0, Number(value) || 0));
  return (
    <div className={`progress-wrap ${compact ? 'compact' : ''}`}>
      {label && <div className="progress-label"><span>{label}</span><strong>{safeValue}%</strong></div>}
      <div className="progress-track" role="progressbar" aria-valuenow={safeValue} aria-valuemin="0" aria-valuemax="100">
        <div className={`progress-fill ${tone}`} style={{ width: `${safeValue}%` }} />
      </div>
    </div>
  );
}

export function MiniStat({ label, value, hint, icon: Icon, tone = 'neutral' }) {
  return (
    <div className={`mini-stat mini-stat-${tone}`}>
      {Icon && <span className="mini-stat-icon"><Icon size={16} /></span>}
      <span className="mini-stat-label">{label}</span>
      <strong>{value}</strong>
      {hint && <small>{hint}</small>}
    </div>
  );
}

export function KeyValueRows({ rows }) {
  return (
    <div className="key-value-rows">
      {rows.map((row, index) => (
        <div className="key-value-row" key={row.label || index}>
          <span>{row.label}</span>
          <strong>{row.value ?? '—'}</strong>
        </div>
      ))}
    </div>
  );
}
