import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X } from 'lucide-react';

/**
 * ConfirmDialog — accessible confirmation modal for destructive actions.
 *
 * @param {boolean}  isOpen      Controls visibility
 * @param {Function} onClose     Called on Cancel or backdrop click
 * @param {Function} onConfirm   Called when user confirms
 * @param {string}   title       Dialog heading
 * @param {string}   description What will happen / what will be deleted
 * @param {string}   confirmLabel Label for the confirm button (default "Confirm")
 * @param {boolean}  isLoading   Disables confirm button while action is in flight
 */
const ConfirmDialog = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Are you sure?',
  description,
  confirmLabel = 'Confirm',
  isLoading = false,
}) => {
  const confirmRef = useRef(null);
  const titleId = 'confirm-dialog-title';
  const descId = 'confirm-dialog-desc';

  // Trap focus and handle Escape
  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';

    // Focus the confirm button on open for quick keyboard access
    setTimeout(() => confirmRef.current?.focus(), 50);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={description ? descId : undefined}
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0"
            style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 12 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-sm rounded-2xl overflow-hidden z-10"
            style={{
              background: 'rgba(8,10,22,0.95)',
              backdropFilter: 'blur(28px)',
              border: '1px solid rgba(255,75,75,0.2)',
              boxShadow: '0 25px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,75,75,0.06)',
            }}
          >
            {/* Top glow line */}
            <div
              className="absolute top-0 left-0 right-0 h-px"
              style={{ background: 'linear-gradient(90deg, transparent, rgba(255,75,75,0.5), transparent)' }}
            />

            {/* Header */}
            <div
              className="flex items-center justify-between px-6 py-4"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0"
                  style={{ background: 'rgba(255,75,75,0.12)', border: '1px solid rgba(255,75,75,0.25)' }}
                >
                  <AlertTriangle size={15} style={{ color: '#ff4b4b' }} />
                </div>
                <h2
                  id={titleId}
                  className="text-base font-semibold text-text-primary"
                >
                  {title}
                </h2>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-white/08 transition-all"
                aria-label="Close dialog"
              >
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5">
              {description && (
                <p id={descId} className="text-text-secondary text-sm leading-relaxed mb-6">
                  {description}
                </p>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all text-text-secondary hover:text-text-primary"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                  }}
                >
                  Cancel
                </button>
                <button
                  ref={confirmRef}
                  onClick={onConfirm}
                  disabled={isLoading}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: isLoading ? 'rgba(255,75,75,0.15)' : 'rgba(255,75,75,0.18)',
                    border: '1px solid rgba(255,75,75,0.4)',
                    color: '#ff4b4b',
                  }}
                  onMouseEnter={(e) => { if (!isLoading) { e.currentTarget.style.background = '#ff4b4b'; e.currentTarget.style.color = '#fff'; } }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,75,75,0.18)'; e.currentTarget.style.color = '#ff4b4b'; }}
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-3.5 h-3.5 border-2 border-danger/30 border-t-danger rounded-full animate-spin" />
                      Please wait…
                    </span>
                  ) : confirmLabel}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default ConfirmDialog;
