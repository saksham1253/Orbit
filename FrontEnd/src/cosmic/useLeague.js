/**
 * useLeague.js — react-query hook for the Weekly League (Orbit Engine, Tier 2b).
 * Read-only; mirrors useOrbit.js.
 */
import { useQuery } from '@tanstack/react-query';
import api from '../services/api';

/** The viewer's division + live group standings (ranked by this week's XP). */
export function useLeague({ enabled = true } = {}) {
  return useQuery({
    queryKey: ['orbit', 'league'],
    queryFn: () => api.get('/orbit/league').then((r) => r.data),
    enabled,
    staleTime: 60 * 1000,
    retry: 1,
  });
}
