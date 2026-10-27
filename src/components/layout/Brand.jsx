import React from 'react';

export function BrandMark({ size = 38 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" role="img" aria-label="EduTrack CRM logo">
      <rect width="48" height="48" rx="13" fill="#F43F5E" />
      <path d="M12 25c4.3-8 8.6-8 12 0s7.7 8 12 0-7.7-8-12 0-7.7 8-12 0Z" fill="none" stroke="white" strokeWidth="3.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m24 13-4.8 3.1L24 19l4.8-2.9L24 13Z" fill="white" />
      <circle cx="24" cy="20" r="1.5" fill="white" />
    </svg>
  );
}

export default function Brand({ collapsed = false, compact = false }) {
  return (
    <div className={`brand ${collapsed ? 'collapsed' : ''} ${compact ? 'compact' : ''}`}>
      <BrandMark size={compact ? 34 : 38} />
      {!collapsed && (
        <span className="brand-text">
          <strong>EduTrack CRM</strong>
          <small>Training Institute Suite</small>
        </span>
      )}
    </div>
  );
}
