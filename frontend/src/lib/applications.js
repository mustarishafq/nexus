import { pickSsoEmailForLaunch } from '@/lib/ssoCredentials';

const LAUNCH_ACTIONS = new Set(['login', 'view']);

export function getRecentApplications(applications = [], activities = [], limit = 6) {
  const bySlug = Object.fromEntries(applications.map((app) => [app.slug, app]));
  const seen = new Set();
  const recent = [];

  for (const log of activities) {
    if (!log.system_id || !LAUNCH_ACTIONS.has(log.action)) continue;
    if (seen.has(log.system_id)) continue;

    const app = bySlug[log.system_id];
    if (!app) continue;

    seen.add(log.system_id);
    recent.push({ ...app, lastUsed: log.created_date });

    if (recent.length >= limit) break;
  }

  if (recent.length > 0) return recent;

  return applications
    .filter((app) => app.is_enabled)
    .slice(0, limit)
    .map((app) => ({ ...app, lastUsed: null }));
}

export function isNexusInternalPath(actionUrl) {
  if (!actionUrl) return false;

  const trimmed = actionUrl.trim();
  // Any app-relative path is a Nexus SPA route.
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return true;
  }

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

function openExternalUrl(url, { newTab = true } = {}) {
  if (newTab) {
    const tab = window.open(url, '_blank', 'noopener,noreferrer');
    if (tab) {
      tab.opener = null;
      return;
    }
  }

  window.location.href = url;
}

export async function openApplicationTarget(db, system, {
  actionUrl,
  navigate,
  deferNavigation = false,
  ssoEmail,
  resolveSsoEmail,
} = {}) {
  if (!system?.is_enabled) {
    throw new Error('Application is not enabled.');
  }

  const redirectTo = actionUrl?.trim() || undefined;
  const resolvedOpenMode = system.open_mode || 'embedded';
  let selectedSsoEmail = ssoEmail ?? null;

  if (!selectedSsoEmail && system.auth_mode !== 'redirect') {
    if (typeof resolveSsoEmail === 'function') {
      selectedSsoEmail = await resolveSsoEmail(system);
    } else {
      selectedSsoEmail = await pickSsoEmailForLaunch(system, (applicationId) => db.getApplicationSsoCredentials(applicationId));
    }
  }

  if (resolvedOpenMode === 'embedded') {
    const params = new URLSearchParams();
    if (redirectTo) params.set('redirect_to', redirectTo);
    if (selectedSsoEmail) params.set('sso_email', selectedSsoEmail);
    const query = params.toString() ? `?${params.toString()}` : '';
    const path = `/applications/${system.id}/view${query}`;

    if (deferNavigation) {
      return { action: 'navigate', path };
    }

    navigate(path);
    return null;
  }

  const { launch_url, auth_mode } = await db.launchSystem(system.id, {
    redirect_to: redirectTo,
    sso_email: selectedSsoEmail || undefined,
  });
  const targetUrl = auth_mode === 'redirect' && redirectTo ? redirectTo : launch_url;

  if (resolvedOpenMode === 'new_tab') {
    if (deferNavigation) {
      return { action: 'open_external', url: targetUrl, newTab: true };
    }

    openExternalUrl(targetUrl, { newTab: true });
    return null;
  }

  if (deferNavigation) {
    return { action: 'open_external', url: targetUrl, newTab: false };
  }

  openExternalUrl(targetUrl, { newTab: false });
  return null;
}

export async function launchApplication(db, system, navigate, options = {}) {
  const result = await openApplicationTarget(db, system, { navigate, ...options });

  if (!options.deferNavigation) {
    if (result?.action === 'navigate') {
      navigate(result.path);
    } else if (result?.action === 'open_external') {
      openExternalUrl(result.url, { newTab: result.newTab });
    }
  }

  return result;
}
