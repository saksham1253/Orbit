/**
 * useConstellations.js — react-query hooks for co-op Binary Star streaks
 * (Orbit Engine, Tier 2). Mirrors useOrbit.js patterns.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';

const KEY = ['orbit', 'constellations'];

/** My active constellations + incoming/outgoing invites. */
export function useConstellations({ enabled = true } = {}) {
  return useQuery({
    queryKey: KEY,
    queryFn: () => api.get('/orbit/constellations').then((r) => r.data),
    enabled,
    staleTime: 60 * 1000,
    retry: 1,
  });
}

/** The viewer's established connections (partner picker for invites). */
export function useConnectionsForInvite(enabled = true) {
  return useQuery({
    queryKey: ['connections', 'all'],
    queryFn: () => api.get('/connections/all').then((r) => r.data),
    enabled,
    staleTime: 2 * 60 * 1000,
    retry: 1,
  });
}

export function useInviteConstellation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (partnerId) => api.post('/orbit/constellations/invite', { partnerId }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useRespondConstellation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }) => api.post(`/orbit/constellations/${id}/respond`, { action }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDissolveConstellation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.post(`/orbit/constellations/${id}/dissolve`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
