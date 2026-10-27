import React from 'react';

const TONE_MAP = {
  Active: 'success', Present: 'success', Paid: 'success', Completed: 'success', Pass: 'success', Published: 'info',
  Upcoming: 'info', 'To Do': 'neutral', Draft: 'neutral', Low: 'neutral', Medium: 'info',
  Absent: 'danger', Urgent: 'danger', Dropped: 'danger', Overdue: 'danger', Fail: 'danger', Cancelled: 'danger',
  Late: 'warning', Excused: 'warning', Partial: 'warning', Pending: 'warning', 'In Progress': 'warning',
  'On Hold': 'warning', High: 'warning',
};

export default function Badge({ children, tone = 'neutral', dot = false, className = '' }) {
  const resolved = tone === 'auto' ? (TONE_MAP[children] || 'neutral') : tone;
  return (
    <span className={`badge badge-${resolved} ${className}`}>
      {dot && <span className="badge-dot" />}
      {children}
    </span>
  );
}
