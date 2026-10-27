import React from 'react';

export default function Tabs({ tabs, value, onChange, className = '' }) {
  return (
    <div className={`tabs ${className}`} role="tablist">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <button key={tab.value} type="button" role="tab" aria-selected={value === tab.value} className={value === tab.value ? 'active' : ''} onClick={() => onChange(tab.value)}>
            {Icon && <Icon size={15} />}{tab.label}
          </button>
        );
      })}
    </div>
  );
}
