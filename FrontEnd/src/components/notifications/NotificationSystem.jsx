import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, UserPlus, UserCheck, Zap, PhoneOff, Star, Handshake } from 'lucide-react';
import { useSound } from '../../utils/soundManager';

/**
 * Centralized Notification System
 * Handles all popup notifications with sounds and animations
 */

const NotificationSystem = ({ notifications, onDismiss, onAction }) => {
  const { playNotification, playSuccess, playError } = useSound();

  useEffect(() => {
    // Play sound when new notification appears
    if (notifications.length > 0) {
      const latestNotification = notifications[notifications.length - 1];
      
      switch (latestNotification.type) {
        case 'match':
        case 'perfect_match':
        case 'connection_accepted':
          playSuccess();
          break;
        case 'connection_request':
          playNotification();
          break;
        case 'user_offline':
        case 'call_ended':
          playError();
          break;
        default:
          playNotification();
      }
    }
  }, [notifications.length]);

  // Map each notification type to a semantic status token (v7 §2) so colors
  // are theme-reactive and pass contrast in both light and dark.
  const TYPE_STATUS = {
    match: 'warning',
    perfect_match: 'success',
    connection_request: 'info',
    connection_accepted: 'success',
    user_offline: 'danger',
    call_ended: 'danger',
  };
  const statusVar = (type) => `var(--${TYPE_STATUS[type] || 'info'})`;

  const getNotificationIcon = (type) => {
    const color = statusVar(type);
    switch (type) {
      case 'match':
        return <Zap size={24} color={color} />;
      case 'perfect_match':
        return <Handshake size={24} color={color} />;
      case 'connection_request':
        return <UserPlus size={24} color={color} />;
      case 'connection_accepted':
        return <UserCheck size={24} color={color} />;
      case 'user_offline':
        return <PhoneOff size={24} color={color} />;
      case 'call_ended':
        return <Star size={24} color={color} />;
      default:
        return <Zap size={24} color={color} />;
    }
  };

  return (
    <div className="fixed top-20 right-4 z-50 space-y-3 max-w-sm w-full pointer-events-none">
      <AnimatePresence mode="multiple">
        {notifications.map((notification) => (
          <motion.div
            key={notification.id}
            initial={{ opacity: 0, x: 100, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 100, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 500, damping: 40 }}
            className="pointer-events-auto"
          >
            <div
              className="backdrop-blur-xl rounded-2xl p-4 border"
              style={{
                background: `linear-gradient(135deg, color-mix(in srgb, ${statusVar(notification.type)} 16%, transparent), var(--toast-bg))`,
                borderColor: 'var(--toast-border)',
                boxShadow: 'var(--toast-shadow)',
              }}
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  {getNotificationIcon(notification.type)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-bold text-text-primary mb-1">
                    {notification.title}
                  </h4>
                  <p className="text-xs text-text-secondary leading-relaxed">
                    {notification.message}
                  </p>
                  
                  {notification.actions && notification.actions.length > 0 && (
                    <div className="flex gap-2 mt-3">
                      {notification.actions.map((action, idx) => (
                        <button
                          key={idx}
                          onClick={() => onAction(notification.id, action.handler)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                            action.primary
                              ? 'bg-accent hover:bg-accent-light text-text-on-accent'
                              : 'bg-surface-hover hover:bg-surface text-text-secondary'
                          }`}
                        >
                          {action.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => onDismiss(notification.id)}
                  className="flex-shrink-0 text-text-muted hover:text-text-primary transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

export default NotificationSystem;
