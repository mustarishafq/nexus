import db from '@/api/base44Client';

export function isInternalActionUrl(actionUrl) {
	if (!actionUrl) return false;

	const trimmed = actionUrl.trim();
	if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return true;

	try {
		return new URL(trimmed).origin === window.location.origin;
	} catch {
		return false;
	}
}

export function toInternalPath(actionUrl) {
	const trimmed = actionUrl.trim();
	if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return trimmed;

	const parsed = new URL(trimmed);
	return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

export function findApplicationBySystemId(applications, systemId) {
	if (!systemId || !applications?.length) return null;

	return (
		applications.find(
			(app) => app.slug === systemId || String(app.id) === String(systemId)
		) || null
	);
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

	if (isInternalActionUrl(actionUrl)) {
		onClose?.();
		navigate(toInternalPath(actionUrl));
		return;
	}

	const app = findApplicationBySystemId(applications, notification.system_id);
	if (app?.is_enabled) {
		const { launch_url, auth_mode } = await db.launchSystem(app.id, {
			redirect_to: actionUrl,
		});
		const targetUrl = auth_mode === 'redirect' ? actionUrl : launch_url;

		onClose?.();
		// Notification deep links always go through SSO (when configured) and open the target page.
		openExternalUrl(targetUrl);
		return;
	}

	onClose?.();
	openExternalUrl(actionUrl);
}
