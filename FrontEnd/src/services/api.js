import axios from 'axios';
import { useAuthStore } from '../store/authStore';

const api = axios.create({
  // Fallback to absolute Render URL in production if VITE_API_URL is missing/malformed
  baseURL: import.meta.env.VITE_API_URL || (import.meta.env.PROD ? 'https://skillswap-backend-mb4k.onrender.com/api' : '/api'),
  // Generous timeout so a Render free-tier cold start (instance waking from
  // sleep, ~30–60s) doesn't abort before the server is ready to respond.
  timeout: 45000,
  withCredentials: true,
});

// Request interceptor: attach JWT
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor: handle 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && window.location.pathname !== '/login') {
      useAuthStore.getState().logout();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
