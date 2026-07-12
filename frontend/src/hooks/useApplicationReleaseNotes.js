import db from '@/api/apiClient';
import { useQuery } from '@tanstack/react-query';
import { BACKGROUND_POLL_INTERVAL_MS } from '@/lib/polling';

export const APPLICATION_RELEASE_NOTE_UNREAD_COUNTS_QUERY_KEY = ['application-release-notes', 'unread-counts'];

export function useApplicationReleaseNoteUnreadCounts({
  enabled = true,
  refetchInterval = BACKGROUND_POLL_INTERVAL_MS,
} = {}) {
  return useQuery({
    queryKey: APPLICATION_RELEASE_NOTE_UNREAD_COUNTS_QUERY_KEY,
    queryFn: async () => {
      const payload = await db.getApplicationReleaseNoteUnreadCounts();
      return payload?.counts && typeof payload.counts === 'object' ? payload.counts : {};
    },
    enabled,
    staleTime: 15_000,
    refetchInterval: enabled && refetchInterval ? refetchInterval : false,
  });
}

export function invalidateApplicationReleaseNoteQueries(queryClient, applicationId = null) {
  queryClient.invalidateQueries({ queryKey: APPLICATION_RELEASE_NOTE_UNREAD_COUNTS_QUERY_KEY });
  if (applicationId != null) {
    queryClient.invalidateQueries({ queryKey: ['application-release-notes', applicationId] });
  } else {
    queryClient.invalidateQueries({ queryKey: ['application-release-notes'] });
  }
}
