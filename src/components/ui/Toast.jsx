import React from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

const ICONS = { success: CheckCircle2, error: AlertCircle, info: Info };

export default function ToastStack({ toasts, onDismiss }) {
  return (
    <div className="toast-stack" role="region" aria-live="polite" aria-label="Notifications">
      {toasts.map((toast) => {
        const Icon = ICONS[toast.type] || Info;
        return (
          <div key={toast.id} className={`toast toast-${toast.type}`} role="status">
            <Icon size={17} />
            <span>{toast.message}</span>
            <button type="button" aria-label="Dismiss notification" onClick={() => onDismiss(toast.id)}><X size={14} /></button>
          </div>
        );
      })}
    </div>
  );
}
