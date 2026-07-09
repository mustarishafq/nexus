export const ROLES = {
  ADMIN: 'admin',
  USER: 'user',
  HR: 'hr',
};

export const ROLE_OPTIONS = [
  { value: ROLES.USER, label: 'User' },
  { value: ROLES.HR, label: 'HR' },
  { value: ROLES.ADMIN, label: 'Admin' },
];

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
