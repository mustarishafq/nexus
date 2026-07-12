import db from '@/api/apiClient';
import { useQuery } from '@tanstack/react-query';
import { BACKGROUND_POLL_INTERVAL_MS } from '@/lib/polling';

export const PLATFORM_RELEASE_NOTE_UNREAD_COUNT_QUERY_KEY = ['platform-release-notes', 'unread-count'];
export const PLATFORM_RELEASE_NOTES_QUERY_KEY = ['platform-release-notes'];

export function usePlatformReleaseNoteUnreadCount({
  enabled = true,
  refetchInterval = BACKGROUND_POLL_INTERVAL_MS,
} = {}) {
  return useQuery({
    queryKey: PLATFORM_RELEASE_NOTE_UNREAD_COUNT_QUERY_KEY,
    queryFn: async () => {
      const payload = await db.getPlatformReleaseNoteUnreadCount();
      return Number(payload?.count) || 0;
    },
    enabled,
    staleTime: 15_000,
    refetchInterval: enabled && refetchInterval ? refetchInterval : false,
  });
}

export function invalidatePlatformReleaseNoteQueries(queryClient) {
  queryClient.invalidateQueries({ queryKey: PLATFORM_RELEASE_NOTE_UNREAD_COUNT_QUERY_KEY });
  queryClient.invalidateQueries({ queryKey: PLATFORM_RELEASE_NOTES_QUERY_KEY });
}
