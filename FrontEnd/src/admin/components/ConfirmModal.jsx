/**
 * ConfirmModal — a reusable confirm dialog for the Command Center. Fills the
 * "no shared modal" gap noted in the audit. Supports an optional required
 * `reason` field (for audited actions like grants/deductions) and a `danger`
 * styling. Uses the .ssctl-* design tokens. Controlled: parent owns `open`.
 */
import { useEffect, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

export default function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  danger = false,
  requireReason = false,
  reasonLabel = 'Reason (audited)',
  busy = false,
  onConfirm,
  onClose,
}) {
  const [reason, setReason] = useState('');
  useEffect(() => { if (open) setReason(''); }, [open]);
  if (!open) return null;

  const canConfirm = !busy && (!requireReason || reason.trim().length > 0);

  return (
    <div
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
    >
      <div className="ssctl-card" style={{ width: 'min(460px, 96vw)', maxWidth: 460 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div className="ssctl-section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {danger && <AlertTriangle size={16} color="var(--ss-danger, #ff4b4b)" />} {title}
          </div>
          <button className="ssctl-btn ssctl-btn-ghost" style={{ minHeight: 28, padding: '4px 8px' }} onClick={() => !busy && onClose()} aria-label="Close"><X size={14} /></button>
        </div>
        {message && <p className="ssctl-muted" style={{ fontSize: 13, marginBottom: 12 }}>{message}</p>}
        {requireReason && (
          <div style={{ marginBottom: 12 }}>
            <label className="ssctl-label">{reasonLabel}</label>
            <input className="ssctl-input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why are you doing this?" autoFocus />
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="ssctl-btn ssctl-btn-ghost" style={{ minHeight: 36 }} onClick={() => !busy && onClose()}>Cancel</button>
          <button
            className={`ssctl-btn ${danger ? 'ssctl-btn-danger' : ''}`}
            style={{ minHeight: 36, opacity: canConfirm ? 1 : 0.5, cursor: canConfirm ? 'pointer' : 'not-allowed' }}
            disabled={!canConfirm}
            onClick={() => canConfirm && onConfirm(reason.trim())}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
