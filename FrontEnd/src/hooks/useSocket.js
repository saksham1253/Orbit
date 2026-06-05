import { useEffect, useRef } from 'react';
import { connectSocket, disconnectSocket, getSocket } from '../services/socket';
import { useAuthStore } from '../store/authStore';
import { useUIStore } from '../store/uiStore';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Hook that manages socket connection lifecycle and event listeners.
 * Call this once at the app level (e.g., in Layout).
 */
const useSocket = () => {
  const { user, token } = useAuthStore();
  const { addToast } = useUIStore();
  const queryClient = useQueryClient();
  const isConnected = useRef(false);

  useEffect(() => {
    if (!token || !user?._id) {
      disconnectSocket();
      isConnected.current = false;
      return;
    }

    if (isConnected.current) return;

    const socket = connectSocket(user._id);
    isConnected.current = true;

    // Listen for new skills in the community
    socket.on('new-skill', (skill) => {
      addToast(`New skill listed: ${skill.skillOffered}`, 'info');
      queryClient.invalidateQueries({ queryKey: ['skills', 'all'] });
    });

    // Listen for connection accepted
    socket.on('connection-accepted', (data) => {
      addToast(`${data.receiverName} accepted your connection request!`, 'success');
      queryClient.invalidateQueries({ queryKey: ['connections'] });
    });

    // Force disconnect from video call (AI moderation)
    socket.on('force-disconnect', (data) => {
      addToast(data.reason || 'Call terminated by moderator', 'error');
      window.location.href = '/connections';
    });

    return () => {
      disconnectSocket();
      isConnected.current = false;
    };
  }, [token, user?._id]);
};

export default useSocket;
