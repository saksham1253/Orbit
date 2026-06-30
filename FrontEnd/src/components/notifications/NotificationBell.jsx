import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, Handshake, Users, CheckCheck, Inbox } from 'lucide-react';
import api from '../../services/api';
import { useUIStore } from '../../store/uiStore';

const ICON_BY_TYPE = {
  perfect_match:       Handshake,
  connection_request:  Users,
  connection_accepted: Users,
};

// Compact relative time ("3m", "2h", "5d") without pulling in a date lib.
function timeAgo(date) {
  const s = Math.max(0, (Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

/**
 * NotificationBell — the durable notification center.
 *
 * Reads from the persistent /api/notifications endpoints, so notifications
 * survive offline / a not-yet-connected socket (the bug that lost perfect-match
 * alerts on mobile). The unread badge polls; App.jsx invalidates these queries
 * on the live "notification:new" socket event for instant updates.
 */
const NotificationBell = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const addToast = useUIStore((s) => s.addToast);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const { data: unread } = useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: () => api.get('/notifications/unread-count').then(r => r.data),
    refetchInterval: 25000,
    refetchOnWindowFocus: true,
  });

  const { data: list } = useQuery({
    queryKey: ['notifications', 'list'],
    queryFn: () => api.get('/notifications', { params: { limit: 30 } }).then(r => r.data),
    enabled: open,
  });

  const markRead = useMutation({
    mutationFn: (id) => api.patch(`/notifications/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread'] });
      queryClient.invalidateQueries({ queryKey: ['notifications', 'list'] });
    },
  });

  const markAllRead = useMutation({
    mutationFn: () => api.patch('/notifications/read-all'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread'] });
      queryClient.invalidateQueries({ queryKey: ['notifications', 'list'] });
      addToast("You're all caught up.", 'success');
    },
  });

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const count = unread?.count || 0;
  const items = list?.items || [];

  const onItemClick = (n) => {
    if (!n.read) markRead.mutate(n._id);
    setOpen(false);
    const link = n.data?.link;
    if (link) navigate(link);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        aria-label="Notifications"
        title="Notifications"
        className="relative flex items-center justify-center w-8 h-8 rounded-xl text-text-muted hover:text-accent transition-all bg-surface border border-border-subtle"
      >
        <Bell size={15} />
        {count > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 flex items-center justify-center text-[10px] font-bold rounded-full"
            style={{ background: 'linear-gradient(135deg, var(--accent-2), var(--accent-3))', color: '#fff', boxShadow: '0 2px 8px var(--border-glow)' }}
            aria-label={`${count} unread notification${count !== 1 ? 's' : ''}`}
          >
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.16 }}
            // Sizing/position live in the `.notif-panel` CSS class (index.css):
            // desktop = an anchored 340px dropdown; phones = a fixed full-width
            // sheet under the navbar. This avoids the bug where a Tailwind
            // `max-w-[calc(100vw-24px)]` emitted invalid CSS (no spaces around
            // the `-`), got dropped, and the global `* { max-width:100% }` guard
            // then collapsed the panel to its ~32px bell wrapper — the sliver
            // seen on both desktop and the APK WebView.
            className="notif-panel absolute right-0 mt-2 rounded-2xl overflow-hidden z-50 nav-glass-scrolled"
            style={{
              border: '1px solid var(--border-subtle)',
              boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
            }}
            role="dialog"
            aria-label="Notifications"
          >
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <span className="text-sm font-semibold text-text-primary">Notifications</span>
              {count > 0 && (
                <button
                  onClick={() => markAllRead.mutate()}
                  className="flex items-center gap-1 text-xs text-text-muted hover:text-accent transition-colors"
                >
                  <CheckCheck size={13} /> Mark all read
                </button>
              )}
            </div>

            <div className="max-h-[60vh] overflow-y-auto">
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-10 text-text-muted">
                  <Inbox size={26} />
                  <span className="text-xs">You're all caught up</span>
                </div>
              ) : (
                items.map((n) => {
                  const Icon = ICON_BY_TYPE[n.type] || Bell;
                  return (
                    <button
                      key={n._id}
                      onClick={() => onItemClick(n)}
                      className="w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-surface"
                      style={{ borderBottom: '1px solid var(--border-subtle)', background: n.read ? 'transparent' : 'rgba(0,198,255,0.06)' }}
                    >
                      <span className="flex-shrink-0 mt-0.5 flex items-center justify-center w-8 h-8 rounded-lg"
                        style={{ background: 'var(--bg-surface-glass)', border: '1px solid var(--border-subtle)', color: 'var(--accent-1)' }}
                      >
                        <Icon size={15} />
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-text-primary truncate">{n.title || 'Notification'}</span>
                          <span className="text-[10px] text-text-muted flex-shrink-0">{timeAgo(n.createdAt)}</span>
                        </span>
                        {n.body && <span className="block text-xs text-text-secondary mt-0.5 leading-snug">{n.body}</span>}
                      </span>
                      {!n.read && (
                        <span className="flex-shrink-0 mt-1 w-2 h-2 rounded-full" style={{ background: 'var(--accent-2)' }} />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NotificationBell;
