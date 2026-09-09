export const DEFAULT_SYSTEM_NAME = 'EMZI Nexus Brain';

/**
 * Longest prefixes first so nested modules (e.g. /admin/users) win.
 * Titles match the on-page heading / nav module, not the signed-in user.
 */
const PAGE_TITLES = [
  ['/forgot-password', 'Forgot Password'],
  ['/reset-password', 'Reset Password'],
  ['/privacy-policy', 'Privacy Policy'],
  ['/mcp-consent', 'Connect'],
  ['/event-check-in', 'Event Check-in'],
  ['/quiz-join', 'Join Game'],
  ['/login', 'Login'],
  ['/register', 'Register'],
  ['/notifications', 'Notification Center'],
  ['/network-health', 'Network Health'],
  ['/admin/network-health', 'Network Health'],
  ['/admin/attendance', 'Attendance'],
  ['/admin/broadcast', 'Broadcast Center'],
  ['/admin/calendar', 'Calendar'],
  ['/admin/settings', 'Settings'],
  ['/admin/events', 'System Events'],
  ['/admin/users', 'User Management'],
  ['/people/org-chart', 'Organization'],
  ['/organization', 'Organization'],
  ['/applications', 'Applications'],
  ['/assistant', 'Assistant'],
  ['/leaderboard', 'Missions'],
  ['/attendance', 'Attendance'],
  ['/analytics', 'Analytics'],
  ['/activity', 'Activity Timeline'],
  ['/calendar', 'Calendar'],
  ['/messages', 'Messages'],
  ['/missions', 'Missions'],
  ['/profile', 'Profile'],
  ['/scan-qr', 'Scan QR'],
  ['/settings', 'Settings'],
  ['/people', 'People'],
  ['/users', 'People'],
  ['/email', 'Email'],
  ['/games', 'Games'],
  ['/feed', 'Company Feed'],
];

function normalizePathname(pathname) {
  if (!pathname || pathname === '/') return '/';
  const trimmed = String(pathname).split('?')[0].split('#')[0];
  const withoutTrailing = trimmed.replace(/\/+$/, '');
  return withoutTrailing || '/';
}

const PAGE_TITLES_BY_LENGTH = [...PAGE_TITLES].sort((a, b) => b[0].length - a[0].length);

export function getPageTitle(pathname, { forcePasswordChange = false } = {}) {
  if (forcePasswordChange) return 'Change Password';

  const path = normalizePathname(pathname);
  if (path === '/') return 'Dashboard';

  for (const [prefix, title] of PAGE_TITLES_BY_LENGTH) {
    if (path === prefix || path.startsWith(`${prefix}/`)) {
      return title;
    }
  }

  return 'Page not found';
}

export function formatDocumentTitle(pageTitle, systemName = DEFAULT_SYSTEM_NAME) {
  const system = String(systemName || DEFAULT_SYSTEM_NAME).trim() || DEFAULT_SYSTEM_NAME;
  const page = String(pageTitle || '').trim();
  if (!page || page === system) return system;
  return `${page} - ${system}`;
}

export function applyDocumentTitle(title) {
  if (typeof document === 'undefined') return;

  document.title = title;

  const pageTitle = document.getElementById('page-title');
  if (pageTitle) {
    pageTitle.textContent = title;
  }

  const ogTitle = document.getElementById('og-title');
  if (ogTitle) {
    ogTitle.setAttribute('content', title);
  }

  const twitterTitle = document.getElementById('twitter-title');
  if (twitterTitle) {
    twitterTitle.setAttribute('content', title);
  }
}
