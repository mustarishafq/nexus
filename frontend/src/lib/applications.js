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

export async function launchApplication(db, system, navigate) {
  if (!system?.is_enabled) {
    throw new Error('Application is not enabled.');
  }

  const { launch_url, open_mode } = await db.launchSystem(system.id);
  const resolvedOpenMode = open_mode || system.open_mode || 'embedded';

  if (resolvedOpenMode === 'embedded') {
    navigate(`/applications/${system.id}/view`);
    return;
  }

  if (resolvedOpenMode === 'new_tab') {
    const tab = window.open(launch_url, '_blank', 'noopener,noreferrer');
    if (tab) {
      tab.opener = null;
    }
    return;
  }

  window.location.href = launch_url;
}
