import React from 'react';
import { ChevronDown } from 'lucide-react';

export default function FilterSelect({ label, value, onChange, options, allLabel = 'All', className = '' }) {
  return (
    <label className={`filter-select ${className}`}>
      <span>{label}</span>
      <span className="select-wrap">
        <select value={value} onChange={(event) => onChange(event.target.value)} aria-label={label}>
          <option value="">{allLabel}</option>
          {options.map((option) => {
            const [optionValue, optionLabel] = Array.isArray(option) ? option : [option, option];
            return <option key={optionValue} value={optionValue}>{optionLabel}</option>;
          })}
        </select>
        <ChevronDown size={14} />
      </span>
    </label>
  );
}
