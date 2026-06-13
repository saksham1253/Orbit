/**
 * useCosmic.js — react-query hooks for the cosmic leaderboard API.
 * Read-only; mirrors the existing api + react-query patterns used app-wide.
 */
import { useQuery } from '@tanstack/react-query';
import api from '../services/api';

/**
 * Local leaderboard for a scope. Pass { lat, lng } to use a distance-based
 * board, or omit to let the server use the viewer's saved coordinates.
 */
export function useLeaderboard({ scope = 'city', lat, lng, season, enabled = true } = {}) {
  return useQuery({
    queryKey: ['cosmic', 'leaderboard', scope, lat ?? null, lng ?? null, season ?? null],
    queryFn: () => {
      const params = { scope };
      if (lat != null) params.lat = lat;
      if (lng != null) params.lng = lng;
      if (season) params.season = season;
      return api.get('/cosmic/leaderboard', { params }).then((r) => r.data);
    },
    enabled,
    staleTime: 2 * 60 * 1000,   // matches the server-side cache window
    retry: 1,
  });
}

/** A single mentor's cosmic profile (tier, title, flair, progress). */
export function useMentorCosmic(userId, enabled = true) {
  return useQuery({
    queryKey: ['cosmic', 'mentor', userId],
    queryFn: () => api.get(`/cosmic/mentor/${userId}`).then((r) => r.data),
    enabled: enabled && !!userId,
    staleTime: 2 * 60 * 1000,
    retry: 1,
  });
}

/** The Observatory (Hall of Fame) for a city. */
export function useObservatory(city, enabled = true) {
  const key = city && city.trim() ? city.trim() : 'me';
  return useQuery({
    queryKey: ['cosmic', 'observatory', key],
    queryFn: () => api.get(`/cosmic/observatory/${encodeURIComponent(key)}`).then((r) => r.data),
    enabled,
    staleTime: 3 * 60 * 1000,
    retry: 1,
  });
}
