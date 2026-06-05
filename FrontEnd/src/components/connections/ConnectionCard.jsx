import { useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { motion } from 'framer-motion';
import { Check, X, Video, Star, Clock, UserCheck } from 'lucide-react';
import api from '../../services/api';
import Avatar from '../common/Avatar';
import { useUIStore } from '../../store/uiStore';
import { useAuthStore } from '../../store/authStore';
import { useNotificationStore } from '../../store/notificationStore';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import io from 'socket.io-client';

const ConnectionCard = ({ connection, type, onRate }) => {
  const queryClient = useQueryClient();
  const { addToast } = useUIStore();
  const { user } = useAuthStore();
  const { notifyUserOffline } = useNotificationStore();
  const navigate = useNavigate();
  const [onlineUsers, setOnlineUsers] = useState(new Set());

  const isIncoming   = type === 'incoming';
  const isOutgoing   = type === 'outgoing';
  const isEstablished = type === 'established';

  // CRITICAL FIX: For established connections, determine who is the OTHER person
  let other;
  if (isEstablished) {
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

    navigate(`/call/${connection._id}`);
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
          </p>

          <p className="text-xs text-white/25 mt-1 flex items-center gap-1">
            <Clock size={10} />
            {connection.createdAt
              ? formatDistanceToNow(new Date(connection.createdAt), { addSuffix: true })
              : 'Recently'}
          </p>
        </div>
      </div>

      {/* Right — actions */}
      <div className="flex gap-2 flex-shrink-0">
        {isIncoming && (
          <>
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
          <span className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium"
            style={{ background: 'rgba(255,184,0,0.1)', border: '1px solid rgba(255,184,0,0.25)', color: '#ffb800' }}
          >
            <Clock size={14} /> Pending
          </span>
        )}

        {isEstablished && (
          <>
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
      </div>
    </motion.div>
  );
};

export default ConnectionCard;
