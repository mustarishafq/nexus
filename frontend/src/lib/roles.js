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

export function getRoleLabel(role) {
  return ROLE_LABELS[role] ?? role ?? 'User';
}

export function resolveRole(role) {
  if (role === ROLES.ADMIN) return ROLES.ADMIN;
  if (role === ROLES.HR) return ROLES.HR;
  return ROLES.USER;
}

export function isAdmin(user) {
  return user?.role === ROLES.ADMIN;
}

export function isHr(user) {
  return user?.role === ROLES.HR;
}

export function isHrOrAdmin(user) {
  return isAdmin(user) || isHr(user);
}

export function canManageUsers(user) {
  return isHrOrAdmin(user);
}

export function canManageAttendance(user) {
  return isHrOrAdmin(user);
}

export function canViewAllActivity(user) {
  return isHrOrAdmin(user);
}
