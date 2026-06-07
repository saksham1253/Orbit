import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, UserPlus, UserCheck, Zap, PhoneOff, Star } from 'lucide-react';
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

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'match':
        return <Zap size={24} className="text-amber" />;
      case 'connection_request':
        return <UserPlus size={24} className="text-accent" />;
      case 'connection_accepted':
        return <UserCheck size={24} className="text-green-400" />;
      case 'user_offline':
        return <PhoneOff size={24} className="text-danger" />;
      case 'call_ended':
        return <Star size={24} className="text-amber" />;
      default:
        return <Zap size={24} className="text-accent" />;
    }
  };

  const getNotificationColor = (type) => {
    switch (type) {
      case 'match':
        return 'rgba(255, 184, 0, 0.15)';
      case 'connection_request':
        return 'rgba(0, 198, 255, 0.15)';
      case 'connection_accepted':
        return 'rgba(0, 229, 160, 0.15)';
      case 'user_offline':
      case 'call_ended':
        return 'rgba(255, 75, 75, 0.15)';
      default:
        return 'rgba(0, 198, 255, 0.15)';
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
              className="backdrop-blur-xl rounded-2xl p-4 shadow-2xl border"
              style={{
                background: `linear-gradient(135deg, ${getNotificationColor(notification.type)}, rgba(0, 0, 0, 0.4))`,
                borderColor: 'rgba(255, 255, 255, 0.1)',
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
                              ? 'bg-accent hover:bg-accent-light text-text-primary'
                              : 'bg-surface-hover hover:bg-white/20 text-white/80'
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
