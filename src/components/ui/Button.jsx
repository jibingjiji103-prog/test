import React from 'react';
import { LoaderCircle } from 'lucide-react';

const VARIANTS = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  ghost: 'btn-ghost',
  danger: 'btn-danger',
  dark: 'btn-dark',
  icon: 'btn-icon',
};

export default function Button({
  children, variant = 'secondary', size = 'md', icon: Icon, iconRight: IconRight,
  loading = false, disabled = false, className = '', type = 'button', title, ...props
}) {
  return (
    <button
      type={type}
      title={title}
      className={`btn ${VARIANTS[variant] || VARIANTS.secondary} btn-${size} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <LoaderCircle size={15} className="spin" aria-hidden="true" /> : Icon ? <Icon size={15} aria-hidden="true" /> : null}
      {children}
      {IconRight && !loading ? <IconRight size={15} aria-hidden="true" /> : null}
    </button>
  );
}
