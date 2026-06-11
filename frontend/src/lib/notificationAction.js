import db from '@/api/base44Client';
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

function openExternalUrl(url) {
  const tab = window.open(url, '_blank', 'noopener,noreferrer');
  if (tab) {
    tab.opener = null;
    return;
  }

  window.location.href = url;
}

export async function followNotificationAction(
  notification,
  { applications = [], navigate, onClose } = {}
) {
  const actionUrl = notification.action_url?.trim();
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
