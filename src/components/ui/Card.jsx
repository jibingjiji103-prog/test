import React from 'react';

export function Card({ children, className = '', padded = true, ...props }) {
  return <section className={`card ${padded ? 'card-padded' : ''} ${className}`} {...props}>{children}</section>;
}

export function CardHeader({ title, subtitle, action, className = '' }) {
  return (
    <div className={`card-header ${className}`}>
      <div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function SectionTitle({ eyebrow, title, action }) {
  return (
    <div className="section-title">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
      </div>
      {action}
    </div>
  );
}
