export const MESSAGES_INBOX_QUERY_KEY = ['messages-inbox'];

export const MAIL_STATUS_QUERY_KEY = ['mail-status'];

export function mailInboxQueryKey(accountId, folder, search, unreadOnly) {
  return ['mail-inbox', accountId || 'default', folder || 'inbox', search || '', unreadOnly ? 'unread' : 'all'];
}
