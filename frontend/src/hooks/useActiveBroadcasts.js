import db from '@/api/apiClient';
import { useQuery } from '@tanstack/react-query';

export const ACTIVE_BROADCASTS_QUERY_KEY = ['active-broadcasts'];

export function useActiveBroadcasts({ enabled = true } = {}) {
  return useQuery({
    queryKey: ACTIVE_BROADCASTS_QUERY_KEY,
    queryFn: () => db.entities.Broadcast.filter({ active_only: true }, '-created_date', 20),
    enabled,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}
