export const ROLES = {
  ADMIN: 'admin',
  USER: 'user',
  HR: 'hr',
};

export const ROLE_LABELS = {
  [ROLES.USER]: 'User',
  [ROLES.HR]: 'Human Resource',
  [ROLES.ADMIN]: 'Admin',
};

export const ROLE_OPTIONS = [
  { value: ROLES.USER, label: ROLE_LABELS[ROLES.USER] },
  { value: ROLES.HR, label: ROLE_LABELS[ROLES.HR] },
  { value: ROLES.ADMIN, label: ROLE_LABELS[ROLES.ADMIN] },
];

export function getRoleLabel(role, fallbackName) {
  if (ROLE_LABELS[role]) return ROLE_LABELS[role];
  return fallbackName || role || 'User';
}

export function resolveRole(role) {
  if (role === ROLES.ADMIN) return ROLES.ADMIN;
  if (role === ROLES.HR) return ROLES.HR;
  return ROLES.USER;
}

export function roleSlug(user) {
  return user?.access_role?.slug || user?.role || ROLES.USER;
}

export function can(user, key) {
  return Array.isArray(user?.permissions) && user.permissions.includes(key);
}

export function isAdmin(user) {
  return roleSlug(user) === ROLES.ADMIN;
}

export function isHr(user) {
  return roleSlug(user) === ROLES.HR;
}

export function isHrOrAdmin(user) {
  return isAdmin(user) || isHr(user);
}

export function canManageUsers(user) {
  return can(user, 'people.manage_users');
}

export function canViewAllAttendance(user) {
  return can(user, 'attendance.view_all');
}

export function canManageAttendance(user) {
  return canViewAllAttendance(user) || can(user, 'attendance.manage_policy');
}

export function canModerateFeed(user) {
  return can(user, 'feed.moderate');
}

export function canViewAllActivity(user) {
  return can(user, 'people.manage_users');
}

export function canManageAccessGroups(user) {
  return can(user, 'people.manage_groups');
}

export function canManageCalendar(user) {
  return can(user, 'calendar.manage');
}

export function canManageAnalytics(user) {
  return can(user, 'analytics.manage');
}

export function canManageApplications(user) {
  return can(user, 'applications.manage');
}

export function canBroadcast(user) {
  return can(user, 'broadcast.manage');
}

export function canViewNetworkHealth(user) {
  return can(user, 'network.view') || can(user, 'network.view_all');
}

export function canViewAllNetworkHealth(user) {
  return can(user, 'network.view_all');
}

export function canViewGames(user) {
  return can(user, 'quiz.view');
}
