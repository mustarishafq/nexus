import db from '@/api/apiClient';
import { useQuery } from '@tanstack/react-query';
import { BACKGROUND_POLL_INTERVAL_MS } from '@/lib/polling';

export const UNREAD_NOTIFICATIONS_COUNT_QUERY_KEY = ['notifications', 'unread-count'];
export const NOTIFICATION_TAB_COUNTS_QUERY_KEY = ['notifications', 'counts'];
export const RECENT_NOTIFICATIONS_QUERY_KEY = ['notifications', 'recent'];

const RECENT_FILTERS = {
  exclude_broadcasts: true,
  exclude_direct_messages: true,
  limit: 50,
};

// Counted server-side so the badge is not capped by the list page size.
export function useUnreadNotificationCount({ enabled = true, refetchInterval = BACKGROUND_POLL_INTERVAL_MS } = {}) {
  return useQuery({
    queryKey: UNREAD_NOTIFICATIONS_COUNT_QUERY_KEY,
    queryFn: async () => {
      const payload = await db.getNotificationUnreadCount();
      return Number(payload?.count) || 0;
    },
    enabled,
    staleTime: 10_000,
    refetchInterval: enabled && refetchInterval ? refetchInterval : false,
  });
}

// Totals { all, unread, critical, filtered: { all, unread } }; filters (type, category, search) narrow `filtered`.
export function useNotificationTabCounts({ enabled = true, filters } = {}) {
  return useQuery({
    queryKey: filters ? [...NOTIFICATION_TAB_COUNTS_QUERY_KEY, filters] : NOTIFICATION_TAB_COUNTS_QUERY_KEY,
    queryFn: () => db.getNotificationCounts(filters),
    placeholderData: (previous) => previous,
    enabled,
    staleTime: 10_000,
  });
}

export function useRecentNotifications({ enabled = true, refetchInterval = false } = {}) {
  return useQuery({
    queryKey: RECENT_NOTIFICATIONS_QUERY_KEY,
    queryFn: () => db.entities.Notification.filter(RECENT_FILTERS, '-created_date'),
    enabled,
    staleTime: 5_000,
    refetchInterval: enabled && refetchInterval ? refetchInterval : false,
  });
}

export function clearUnreadNotificationsCache(queryClient) {
  queryClient.setQueryData(UNREAD_NOTIFICATIONS_COUNT_QUERY_KEY, 0);
  queryClient.setQueryData(NOTIFICATION_TAB_COUNTS_QUERY_KEY, (old) => (old ? { ...old, unread: 0 } : old));
}

// Callers must only pass notifications that were unread, so the count stays accurate.
export function removeUnreadNotificationFromCache(queryClient) {
  queryClient.setQueryData(UNREAD_NOTIFICATIONS_COUNT_QUERY_KEY, (old) =>
    Math.max(0, (Number(old) || 0) - 1)
  );
  queryClient.setQueryData(NOTIFICATION_TAB_COUNTS_QUERY_KEY, (old) =>
    old ? { ...old, unread: Math.max(0, (Number(old.unread) || 0) - 1) } : old
  );
}

export function invalidateNotificationQueries(queryClient) {
  queryClient.invalidateQueries({ queryKey: UNREAD_NOTIFICATIONS_COUNT_QUERY_KEY });
  queryClient.invalidateQueries({ queryKey: NOTIFICATION_TAB_COUNTS_QUERY_KEY });
  queryClient.invalidateQueries({ queryKey: RECENT_NOTIFICATIONS_QUERY_KEY });
}
