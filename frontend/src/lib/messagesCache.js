import { MESSAGES_INBOX_QUERY_KEY } from '@/lib/queryKeys';

export function messagesThreadQueryKey(conversationId) {
  return ['messages-thread', conversationId];
}

/**
 * Refresh inbox + thread caches when a DM web push arrives.
 * Chat UI polls every 30s; push is instant — without this, toasts beat bubbles.
 */
export function invalidateDirectMessageQueries(queryClient, payload = {}) {
  if (payload.kind !== 'direct_message') {
    return false;
  }

  queryClient.invalidateQueries({ queryKey: MESSAGES_INBOX_QUERY_KEY });

  const conversationId = payload.conversation_id;
  if (conversationId) {
    queryClient.invalidateQueries({ queryKey: messagesThreadQueryKey(conversationId) });
  } else {
    queryClient.invalidateQueries({ queryKey: ['messages-thread'] });
  }

  return true;
}

export function isViewingDirectMessageConversation(payload = {}) {
  if (payload.kind !== 'direct_message' || !payload.conversation_id) {
    return false;
  }

  if (typeof window === 'undefined') {
    return false;
  }

  return window.location.pathname === `/messages/${payload.conversation_id}`;
}
