import React from 'react';
import { Check, ChevronDown } from 'lucide-react';

export function FieldLabel({ label, required, htmlFor, hint }) {
  return (
    <label className="field-label" htmlFor={htmlFor}>
      <span>{label}{required && <em aria-hidden="true"> *</em>}</span>
      {hint && <small>{hint}</small>}
    </label>
  );
}

export function FormField({ field, value, onChange, error }) {
  const id = `field-${field.name}`;
  const common = {
    id,
    name: field.name,
    value: value ?? '',
    onChange: (event) => onChange(field.name, event.target.value),
    disabled: field.disabled,
    placeholder: field.placeholder,
    required: field.required,
    'aria-invalid': Boolean(error),
    className: `form-control ${error ? 'has-error' : ''}`,
  };
  let control;
  if (field.type === 'textarea') {
    control = <textarea {...common} rows={field.rows || 3} />;
  } else if (field.type === 'select') {
    control = (
      <div className="select-wrap">
        <select {...common}>{field.options?.map((option) => {
          const [optionValue, optionLabel] = Array.isArray(option) ? option : [option, option];
          return <option key={optionValue} value={optionValue}>{optionLabel}</option>;
        })}</select>
        <ChevronDown size={15} aria-hidden="true" />
      </div>
    );
  } else if (field.type === 'checkbox') {
    control = (
      <label className="checkbox-line">
        <input id={id} type="checkbox" checked={Boolean(value)} onChange={(event) => onChange(field.name, event.target.checked)} disabled={field.disabled} />
        <span>{field.checkboxLabel || field.label}</span>
      </label>
    );
  } else if (field.type === 'multiselect') {
    const selected = Array.isArray(value) ? value : [];
    control = (
      <div className={`multiselect ${error ? 'has-error' : ''}`}>
        {field.options?.length ? field.options.map((option) => {
          const [optionValue, optionLabel] = Array.isArray(option) ? option : [option, option];
          const checked = selected.includes(optionValue);
          return (
            <label key={optionValue} className={`multiselect-option ${checked ? 'selected' : ''}`}>
              <input type="checkbox" checked={checked} onChange={() => onChange(field.name, checked ? selected.filter((item) => item !== optionValue) : [...selected, optionValue])} />
              <span className="check-box">{checked && <Check size={12} />}</span>
              <span>{optionLabel}</span>
            </label>
          );
        }) : <p className="muted small">No options available.</p>}
      </div>
    );
  } else {
    control = <input {...common} type={field.type || 'text'} min={field.min} max={field.max} step={field.step} autoComplete={field.autoComplete} />;
  }
  return (
    <div className={`form-field ${field.span === 2 ? 'span-2' : ''}`}>
      {field.type !== 'checkbox' && <FieldLabel label={field.label} required={field.required} htmlFor={id} hint={field.hint} />}
      {control}
      {error && <span className="field-error">{error}</span>}
      {field.help && !error && <span className="field-help">{field.help}</span>}
    </div>
  );
}

export function DynamicForm({ fields, values, onChange, errors = {}, id }) {
  return (
    <form id={id} className="form-grid" onSubmit={(event) => event.preventDefault()} noValidate>
      {fields.map((field) => (
        <FormField key={field.name} field={field} value={values[field.name]} onChange={onChange} error={errors[field.name]} />
      ))}
    </form>
  );
}

export function formInitialValues(fields, record = null) {
  return Object.fromEntries(fields.map((field) => {
    let value = record?.[field.name];
    if (value === undefined || value === null) value = field.defaultValue ?? (field.type === 'multiselect' ? [] : field.type === 'checkbox' ? false : '');
    if (field.type === 'multiselect' && !Array.isArray(value)) value = [];
    return [field.name, value];
  }));
}

export function validateForm(fields, values, customValidate) {
  const errors = {};
  fields.forEach((field) => {
    const value = values[field.name];
    if (field.required) {
      const empty = field.type === 'multiselect' ? !value?.length : field.type === 'checkbox' ? !value : String(value ?? '').trim() === '';
      if (empty) errors[field.name] = `${field.label} is required.`;
    }
    if (!errors[field.name] && value && (field.type === 'email' || field.name === 'email') && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      errors[field.name] = 'Enter a valid email address.';
    }
    if (!errors[field.name] && field.validate) {
      const message = field.validate(value, values);
      if (message) errors[field.name] = message;
    }
  });
  return { ...errors, ...(customValidate?.(values) || {}) };
}
