import { useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { motion } from 'framer-motion';
import { Check, X, Video, Star, Clock, UserCheck, Trash2, MessageSquare, MessageCircle } from 'lucide-react';
import api from '../../services/api';
import Avatar from '../common/Avatar';
import { useUIStore } from '../../store/uiStore';
import { useAuthStore } from '../../store/authStore';
import { useNotificationStore } from '../../store/notificationStore';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import io from 'socket.io-client';

const ConnectionCard = ({ connection, type, onRate, onViewRatings }) => {
  const queryClient = useQueryClient();
  const { addToast } = useUIStore();
  const { user } = useAuthStore();
  const { notifyUserOffline } = useNotificationStore();
  const navigate = useNavigate();
  const [onlineUsers, setOnlineUsers] = useState(new Set());

  const isIncoming   = type === 'incoming';
  const isOutgoing   = type === 'outgoing';
  const isEstablished = type === 'established';
  const isCompleted = type === 'completed';

  // CRITICAL FIX: For established connections, determine who is the OTHER person
  let other;
  if (isEstablished || isCompleted) {
    // Check if current user is requester or receiver
    const isRequester = connection.requester?._id === user?._id || connection.requester === user?._id;
    other = isRequester ? connection.receiver : connection.requester;
  } else {
    // For pending connections, use existing logic
    other = isIncoming ? connection.requester : connection.receiver;
  }

  // Track online users via socket
  useEffect(() => {
    if (!isEstablished) return;

    const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:8000';
    const socket = io(socketUrl);

    socket.emit('register', user?._id);

    // Listen for online status updates
    socket.on('users-online', (userIds) => {
      setOnlineUsers(new Set(userIds));
    });

    socket.on('user-online', (userId) => {
      setOnlineUsers(prev => new Set([...prev, userId]));
    });

    socket.on('user-offline-status', (userId) => {
      setOnlineUsers(prev => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    });

    return () => {
      socket.disconnect();
    };
  }, [isEstablished, user]);

  const isOtherUserOnline = onlineUsers.has(other?._id);

  const handleCallClick = () => {
    // Check if other user is online
    if (!isOtherUserOnline) {
      notifyUserOffline(other?.name || 'User');
      return;
    }

    navigate(`/call/${connection._id}`, { state: { otherUser: other, isCaller: true } });
  };

  const ts = other?.trustScore;
  const trustColor = ts >= 70 ? '#00e5a0' : ts >= 40 ? '#ffb800' : '#ff4b4b';
  const trustBg    = ts >= 70 ? 'rgba(0,229,160,0.1)' : ts >= 40 ? 'rgba(255,184,0,0.1)' : 'rgba(255,75,75,0.1)';

  const respondMutation = useMutation({
    mutationFn: (action) =>
      api.put(`/connections/${connection._id}/respond`, {
        action: action === 'accept' ? 'accepted' : 'declined',
      }),
    onSuccess: () => {
      addToast('Response sent', 'success');
      queryClient.invalidateQueries({ queryKey: ['connections'] });
    },
    onError: (err) => addToast(err.response?.data?.message || 'Failed', 'error'),
  });

  const cancelMutation = useMutation({
    mutationFn: () => api.delete(`/connections/cancel/${connection._id}`),
    onSuccess: () => {
      addToast('Request cancelled', 'success');
      queryClient.invalidateQueries({ queryKey: ['connections'] });
    },
    onError: (err) => addToast(err.response?.data?.message || 'Failed to cancel', 'error'),
  });

  const handleCancel = () => {
    if (window.confirm('Cancel this swap request?')) {
      cancelMutation.mutate();
    }
  };

  return (
    <motion.div
      className="skill-card p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      layout
    >
      {/* Left — user info */}
      <div className="flex items-center gap-4 min-w-0">
        <div className="relative flex-shrink-0">
          <Avatar name={other?.name} url={other?.avatar} size="lg" userId={other?._id} />
          {isEstablished && (
            <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green rounded-full border-2 border-background"
              style={{ background: '#00e5a0' }}
            />
          )}
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-semibold text-white truncate">{other?.name || 'Unknown User'}</h4>
            {ts !== undefined && (
              <span className="text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1"
                style={{ background: trustBg, border: `1px solid ${trustColor}30`, color: trustColor }}
              >
                <Star size={9} fill="currentColor" /> {ts}
              </span>
            )}
          </div>

          <p className="text-xs text-white/40 mt-0.5 leading-relaxed">
            {isIncoming && <>Wants to connect over{' '}<span className="text-accent">{connection.skill?.skillOffered}</span></>}
            {isOutgoing && <>You requested to exchange{' '}<span className="text-secondary">{connection.skill?.skillOffered}</span></>}
            {isEstablished && <>Connected via{' '}<span className="text-white/70">{connection.skill?.skillOffered}</span></>}
            {isCompleted && <>Completed swap{' '}<span className="text-green">{connection.skill?.skillOffered}</span>{' '}⇄{' '}<span className="text-green">{connection.skill?.skillWanted}</span></>}
          </p>

          {/* Show swap request message */}
          {connection.message && (isIncoming || isOutgoing) && (
            <p className="text-xs text-white/30 mt-1 italic flex items-start gap-1">
              <MessageSquare size={10} className="mt-0.5 flex-shrink-0" />
              &ldquo;{connection.message}&rdquo;
            </p>
          )}

          <p className="text-xs text-white/25 mt-1 flex items-center gap-1">
            <Clock size={10} />
            {isCompleted && connection.completedAt
              ? `Completed ${formatDistanceToNow(new Date(connection.completedAt), { addSuffix: true })}`
              : connection.createdAt
                ? formatDistanceToNow(new Date(connection.createdAt), { addSuffix: true })
                : 'Recently'}
          </p>
        </div>
      </div>

      {/* Right — actions */}
      <div className="flex gap-2 flex-shrink-0">
        {isIncoming && (
          <>
            {/* View Ratings — check their reputation before accepting */}
            <button
              onClick={() => onViewRatings?.(other)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium text-white/50 hover:text-amber hover:bg-amber/10 border border-white/08 transition-all"
              title="View this person's ratings"
            >
              <Star size={14} /> Ratings
            </button>
            <button
              onClick={() => respondMutation.mutate('decline')}
              disabled={respondMutation.isPending}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium text-white/50 hover:text-danger hover:bg-danger/10 border border-white/08 transition-all"
            >
              <X size={15} /> Decline
            </button>
            <button
              onClick={() => respondMutation.mutate('accept')}
              disabled={respondMutation.isPending}
              className="btn-gradient flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium"
            >
              <Check size={15} /> Accept
            </button>
          </>
        )}

        {isOutgoing && (
          <div className="flex items-center gap-2">
            {/* Status badge */}
            {connection.status === 'pending' && (
              <span className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium"
                style={{ background: 'rgba(255,184,0,0.1)', border: '1px solid rgba(255,184,0,0.25)', color: '#ffb800' }}
              >
                <Clock size={14} /> Pending
              </span>
            )}
            {connection.status === 'accepted' && (
              <span className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium"
                style={{ background: 'rgba(0,229,160,0.1)', border: '1px solid rgba(0,229,160,0.25)', color: '#00e5a0' }}
              >
                <Check size={14} /> Accepted
              </span>
            )}
            {connection.status === 'declined' && (
              <span className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium"
                style={{ background: 'rgba(255,75,75,0.1)', border: '1px solid rgba(255,75,75,0.25)', color: '#ff4b4b' }}
              >
                <X size={14} /> Declined
              </span>
            )}
            {/* Cancel button only for pending */}
            {connection.status === 'pending' && (
              <button
                onClick={handleCancel}
                disabled={cancelMutation.isPending}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium text-white/50 hover:text-danger hover:bg-danger/10 border border-white/08 transition-all disabled:opacity-50"
                title="Cancel this request"
              >
                <Trash2 size={14} /> Cancel
              </button>
            )}
          </div>
        )}

        {isEstablished && (
          <>
            <button
              onClick={() => {
                // Dispatch event so Navbar can open ChatDrawer with this user
                window.dispatchEvent(new CustomEvent('open-chat', { detail: other }));
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium text-white/50 hover:text-accent hover:bg-accent/10 border border-white/08 transition-all"
            >
              <MessageCircle size={15} /> Chat
            </button>
            <button
              onClick={() => onRate?.(other?._id)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium text-white/60 hover:text-amber hover:bg-amber/10 border border-white/08 transition-all"
            >
              <Star size={15} /> Rate
            </button>
            <button
              onClick={handleCallClick}
              className="btn-gradient flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium relative"
            >
              <Video size={15} /> Call
              {!isOtherUserOnline && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-danger rounded-full" title="User offline" />
              )}
            </button>
          </>
        )}

        {isCompleted && (
          <>
            <button
              onClick={() => navigate(`/profile/${other?._id}`)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium text-white/50 hover:text-accent hover:bg-accent/10 border border-white/08 transition-all"
            >
              <UserCheck size={15} /> View Profile
            </button>
            <button
              onClick={() => onRate?.(other?._id)}
              className="btn-gradient flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium"
              title="Leave a rating for this completed swap"
            >
              <Star size={15} /> Leave Review
            </button>
          </>
        )}
      </div>
    </motion.div>
  );
};

export default ConnectionCard;
