import db from '@/api/apiClient';
import {
  findApplicationBySystemId,
  isNexusInternalPath,
  openApplicationTarget,
  toInternalPath,
} from '@/lib/applications';

export { findApplicationBySystemId, isNexusInternalPath, toInternalPath };

export function isInternalActionUrl(actionUrl) {
  return isNexusInternalPath(actionUrl);
}

function parseNotificationData(data) {
  if (!data) return {};
  if (typeof data === 'object') return data;
  try {
    return JSON.parse(data);
  } catch {
    return {};
  }
}

export function resolveNotificationActionUrl(notification) {
  const actionUrl = notification?.action_url?.trim();
  if (!actionUrl) return null;

  const data = parseNotificationData(notification.data);
  const postId = data.post_id;

  if (!postId) {
    return actionUrl;
  }

  const isFeedLink = actionUrl === '/feed' || actionUrl.startsWith('/feed?');
  if (!isFeedLink) {
    return actionUrl;
  }

  const url = new URL(actionUrl, window.location.origin);
  if (!url.searchParams.has('post')) {
    url.searchParams.set('post', String(postId));
  }

  const shouldExpandComments =
    data.kind === 'post_comment'
    || (data.kind === 'mention' && url.searchParams.get('comments') === '1');

  if (shouldExpandComments && !url.searchParams.has('comments')) {
    url.searchParams.set('comments', '1');
  }

  return `${url.pathname}${url.search}${url.hash}`;
}

function openExternalUrl(url) {
  // With "noopener", browsers may open the tab and still return null.
  // Never fall through to same-tab navigation in that case.
  window.open(url, '_blank', 'noopener,noreferrer');
}

export async function followNotificationAction(
  notification,
  { applications = [], navigate, onClose } = {}
) {
  const actionUrl = resolveNotificationActionUrl(notification);
  if (!actionUrl) return;

  const app = findApplicationBySystemId(applications, notification.system_id);

  if (app?.is_enabled && !isNexusInternalPath(actionUrl)) {
    onClose?.();
    await openApplicationTarget(db, app, { actionUrl, navigate });
    return;
  }

  if (isNexusInternalPath(actionUrl)) {
    onClose?.();
    navigate(toInternalPath(actionUrl));
    return;
  }

  onClose?.();
  openExternalUrl(actionUrl);
}
