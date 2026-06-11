export function canViewApplicationUsage(user, applications = []) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  return applications.some(
    (app) => Number(app.created_by_user_id) === Number(user.id)
  );
}

export function getManageableApplications(user, applications = []) {
  if (!user) return [];
  if (user.role === 'admin') return applications;
  return applications.filter(
    (app) => Number(app.created_by_user_id) === Number(user.id)
  );
}
