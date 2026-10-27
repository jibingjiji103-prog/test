import React from 'react';
import { AlertTriangle } from 'lucide-react';
import Modal from './Modal';
import Button from './Button';

export default function ConfirmDialog({
  open, onClose, onConfirm, title = 'Are you sure?', message,
  confirmLabel = 'Delete', loading = false, tone = 'danger',
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={(
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>{confirmLabel}</Button>
        </>
      )}
    >
      <div className="confirm-content">
        <span className={`confirm-icon ${tone}`}><AlertTriangle size={21} /></span>
        <p>{message || 'This action cannot be undone.'}</p>
      </div>
    </Modal>
  );
}
