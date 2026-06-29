import db from '@/api/apiClient';
import { useQuery } from '@tanstack/react-query';
import { ACTION_ITEMS_QUERY_KEY } from '@/lib/actionItems';
import { BACKGROUND_POLL_INTERVAL_MS } from '@/lib/polling';

export { ACTION_ITEMS_QUERY_KEY };

export function useActionItems({ enabled = true, refetchInterval = BACKGROUND_POLL_INTERVAL_MS } = {}) {
  return useQuery({
    queryKey: ACTION_ITEMS_QUERY_KEY,
    queryFn: () => db.dashboard.actionItems({ limit: 100 }),
    enabled,
    staleTime: 10_000,
    refetchInterval: enabled && refetchInterval ? refetchInterval : false,
  });
}

export function invalidateActionItemsCache(queryClient) {
  queryClient.invalidateQueries({ queryKey: ACTION_ITEMS_QUERY_KEY });
}
