/**
 * useOnlineUsers — live online-presence for the admin Users table.
 *
 * Opens a lightweight socket (no auth token needed — it only LISTENS to the
 * public presence broadcasts the server already emits to every client) and
 * tracks who is connected right now. Returns a Set of online userId strings
 * that updates in real time as people connect / disconnect.
 *
 * Degrades silently: if the socket can't connect, the Set stays empty and the
 * table simply shows everyone as offline (the stored account status still
 * renders from the list payload).
 */
import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const API = import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD ? 'https://skillswap-backend-mb4k.onrender.com/api' : '/api');
const SOCKET_URL = API.replace(/\/api\/?$/, '');

export default function useOnlineUsers() {
  const [online, setOnline] = useState(() => new Set());

  useEffect(() => {
    const socket = io(SOCKET_URL || undefined, {
      transports: ['websocket', 'polling'],
      withCredentials: true,
      reconnectionAttempts: 5,
    });

    const replace = (ids) => setOnline(new Set((ids || []).map(String)));
    const add = (id) => setOnline((prev) => new Set(prev).add(String(id)));
    const remove = (id) => setOnline((prev) => {
      const next = new Set(prev);
      next.delete(String(id));
      return next;
    });

    socket.on('connect', () => socket.emit('get-online-users'));
    socket.on('users-online', replace);            // full snapshot
    socket.on('user-online', add);                 // someone connected
    socket.on('user-offline-status', remove);      // someone disconnected

    return () => {
      socket.off('users-online', replace);
      socket.off('user-online', add);
      socket.off('user-offline-status', remove);
      socket.disconnect();
    };
  }, []);

  return online;
}
