/**
 * useOrbit.js — react-query hooks for the Orbit Engine API (streak, Gravity
 * Assist freeze, Stardust, weekly missions). Mirrors useCosmic.js patterns.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';

const ORBIT_KEY = ['orbit', 'me'];

/** The viewer's full orbit state. Self-heals weekly rollovers server-side. */
export function useOrbit({ enabled = true } = {}) {
  return useQuery({
    queryKey: ORBIT_KEY,
    queryFn: () => api.get('/orbit/me').then((r) => r.data),
    enabled,
    staleTime: 60 * 1000,
    retry: 1,
  });
}

/** Claim a completed weekly mission's Stardust. Returns the fresh orbit state. */
export function useClaimMission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (key) => api.post(`/orbit/missions/${key}/claim`).then((r) => r.data),
    onSuccess: (data) => qc.setQueryData(ORBIT_KEY, (prev) => ({ ...prev, ...data })),
  });
}

/** Spend Stardust to bank one extra Gravity Assist freeze. */
export function useBuyFreeze() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post('/orbit/freeze/buy').then((r) => r.data),
    onSuccess: (data) => qc.setQueryData(ORBIT_KEY, (prev) => ({ ...prev, ...data })),
  });
}

/** Update engagement preferences (e.g. decay-reminder opt-out — Part 4). */
export function useOrbitPrefs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (prefs) => api.post('/orbit/prefs', prefs).then((r) => r.data),
    onSuccess: (data) => qc.setQueryData(ORBIT_KEY, (prev) => (prev ? { ...prev, prefs: data.prefs } : prev)),
  });
}
