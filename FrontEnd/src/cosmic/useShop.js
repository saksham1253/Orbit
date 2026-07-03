/**
 * useShop.js — react-query hooks for the Stardust Cosmetics Shop (Tier 3).
 * Mirrors useOrbit.js. Buying/equipping also refreshes the orbit balance.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';

const SHOP_KEY = ['orbit', 'shop'];

export function useShop({ enabled = true } = {}) {
  return useQuery({
    queryKey: SHOP_KEY,
    queryFn: () => api.get('/orbit/shop').then((r) => r.data),
    enabled,
    staleTime: 60 * 1000,
    retry: 1,
  });
}

export function useBuyCosmetic() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (key) => api.post('/orbit/shop/buy', { key }).then((r) => r.data),
    onSuccess: (data) => {
      qc.setQueryData(SHOP_KEY, (prev) => ({ ...prev, ...data }));
      qc.invalidateQueries({ queryKey: ['orbit', 'me'] }); // Stardust balance changed
    },
  });
}

export function useEquipCosmetic() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ type, key }) => api.post('/orbit/shop/equip', { type, key }).then((r) => r.data),
    onSuccess: (data) => {
      qc.setQueryData(SHOP_KEY, (prev) => ({ ...prev, ...data }));
      qc.invalidateQueries({ queryKey: ['profile'] }); // equipped look changed
    },
  });
}
