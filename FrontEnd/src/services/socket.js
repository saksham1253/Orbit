import { io } from 'socket.io-client';
import { useAuthStore } from '../store/authStore';

// Mirror api.js: fall back to the absolute Render URL in production builds
// (e.g. the Capacitor APK / PWA) so the socket never points at localhost.
const SOCKET_URL =
  import.meta.env.VITE_API_URL?.replace('/api', '') ||
  (import.meta.env.PROD ? 'https://skillswap-backend-mb4k.onrender.com' : 'http://localhost:8000');

let socket = null;

export const connectSocket = (userId) => {
  if (socket) return socket;

  socket = io(SOCKET_URL, {
    // Send the JWT on the handshake so the server can derive a trusted userId.
    // Function form → the latest token is read again on every (re)connect.
    auth: (cb) => cb({ token: useAuthStore.getState().token }),
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 2000,
  });

  socket.on('connect', () => {
    console.log('Socket connected:', socket.id);
    if (userId) {
      socket.emit('register', userId);
    }
  });

  socket.on('disconnect', (reason) => {
    console.log('Socket disconnected:', reason);
  });

  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export const getSocket = () => socket;

export default { connectSocket, disconnectSocket, getSocket };
