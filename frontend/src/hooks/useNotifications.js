import db from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';

export const UNREAD_NOTIFICATIONS_QUERY_KEY = ['notifications', 'unread'];
export const RECENT_NOTIFICATIONS_QUERY_KEY = ['notifications', 'recent'];

const UNREAD_FILTERS = {
  is_read: false,
  exclude_broadcasts: true,
  exclude_direct_messages: true,
};

const RECENT_FILTERS = {
  exclude_broadcasts: true,
  exclude_direct_messages: true,
};

export function useUnreadNotifications({ enabled = true, refetchInterval = 15_000 } = {}) {
  return useQuery({
    queryKey: UNREAD_NOTIFICATIONS_QUERY_KEY,
    queryFn: () => db.entities.Notification.filter(UNREAD_FILTERS, '-created_date', 100),
    enabled,
    staleTime: 10_000,
    refetchInterval: enabled && refetchInterval ? refetchInterval : false,
  });
}

export function useRecentNotifications({ enabled = true, refetchInterval = false } = {}) {
  return useQuery({
    queryKey: RECENT_NOTIFICATIONS_QUERY_KEY,
    queryFn: () => db.entities.Notification.filter(RECENT_FILTERS, '-created_date', 50),
    enabled,
    staleTime: 5_000,
    refetchInterval: enabled && refetchInterval ? refetchInterval : false,
  });
}

export function clearUnreadNotificationsCache(queryClient) {
  queryClient.setQueryData(UNREAD_NOTIFICATIONS_QUERY_KEY, []);
}

export function removeUnreadNotificationFromCache(queryClient, id) {
  queryClient.setQueryData(UNREAD_NOTIFICATIONS_QUERY_KEY, (old = []) =>
    old.filter((notification) => notification.id !== id)
  );
}

export function invalidateNotificationQueries(queryClient) {
  queryClient.invalidateQueries({ queryKey: UNREAD_NOTIFICATIONS_QUERY_KEY });
  queryClient.invalidateQueries({ queryKey: RECENT_NOTIFICATIONS_QUERY_KEY });
}
