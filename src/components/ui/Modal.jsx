import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import Button from './Button';

export default function Modal({
  open, onClose, title, subtitle, children, footer, size = 'md',
  closeOnOverlay = true, className = '',
}) {
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    const onKeyDown = (event) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKeyDown);
    document.body.classList.add('modal-open');
    const timer = window.setTimeout(() => {
      dialogRef.current?.querySelector('input:not([type=hidden]), select, textarea, button')?.focus();
    }, 40);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.classList.remove('modal-open');
      window.clearTimeout(timer);
      previous?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="modal-backdrop" onMouseDown={(event) => { if (closeOnOverlay && event.target === event.currentTarget) onClose(); }}>
      <div ref={dialogRef} className={`modal modal-${size} ${className}`} role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className="modal-header">
          <div>
            <h2 id="modal-title">{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <Button variant="icon" size="sm" onClick={onClose} aria-label="Close dialog" title="Close"><X size={17} /></Button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
