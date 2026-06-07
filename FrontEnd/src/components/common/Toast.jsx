import { useUIStore } from '../../store/uiStore';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle2, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { useEffect } from 'react';
import soundManager from '../../utils/soundManager';

const CONFIG = {
  success: {
    icon: CheckCircle2,
    color: '#00e5a0',
    bg: 'rgba(0,229,160,0.08)',
    border: 'rgba(0,229,160,0.25)',
  },
  error: {
    icon: AlertCircle,
    color: '#ff4b4b',
    bg: 'rgba(255,75,75,0.08)',
    border: 'rgba(255,75,75,0.25)',
  },
  warning: {
    icon: AlertTriangle,
    color: '#ffb800',
    bg: 'rgba(255,184,0,0.08)',
    border: 'rgba(255,184,0,0.25)',
  },
  info: {
    icon: Info,
    color: '#00c6ff',
    bg: 'rgba(0,198,255,0.08)',
    border: 'rgba(0,198,255,0.25)',
  },
};

const ToastContainer = () => {
  const { toasts, removeToast } = useUIStore();

  // Play sound when toast appears
  useEffect(() => {
    if (toasts.length > 0) {
      const lastToast = toasts[toasts.length - 1];
      if (lastToast.type === 'success') {
        soundManager.play('success');
      } else if (lastToast.type === 'error') {
        soundManager.play('error');
      } else {
        soundManager.play('notification');
      }
    }
  }, [toasts.length]);

  return (
    <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2.5 pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => {
          const cfg = CONFIG[toast.type] || CONFIG.info;
          const Icon = cfg.icon;
          return (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, x: 60, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, scale: 0.92 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="pointer-events-auto flex items-center gap-3 px-4 py-3.5 rounded-2xl shadow-2xl max-w-[340px]"
              style={{
                background: `rgba(6,8,16,0.9)`,
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border: `1px solid ${cfg.border}`,
                boxShadow: `0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)`,
              }}
            >
              {/* Left color bar */}
              <div className="w-0.5 h-8 rounded-full flex-shrink-0" style={{ background: cfg.color }} />

              <Icon size={18} style={{ color: cfg.color, flexShrink: 0 }} />
              <p className="text-sm font-medium text-text-primary flex-1 leading-snug">{toast.message}</p>
              <button
                onClick={() => removeToast(toast.id)}
                className="flex-shrink-0 p-1 rounded-lg text-text-muted hover:text-text-primary transition-colors"
              >
                <X size={14} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};

export default ToastContainer;
