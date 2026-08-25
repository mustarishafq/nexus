export function walkOrgTree(branches, visit, ancestors = []) {
  const list = Array.isArray(branches) ? branches : [];
  list.forEach((branch) => {
    const user = branch?.user;
    if (!user) return;
    const reports = Array.isArray(branch.reports) ? branch.reports : [];
    visit(branch, reports, ancestors);
    walkOrgTree(reports, visit, [...ancestors, String(user.id)]);
  });
}

export function summarizeOrgTree(tree) {
  const people = [];
  const departments = new Set();
  let managers = 0;
  let maxDepth = 0;

  walkOrgTree(tree, (branch, reports, ancestors) => {
    people.push(branch.user);
    if (branch.user.department) departments.add(branch.user.department);
    if (reports.length > 0) managers += 1;
    maxDepth = Math.max(maxDepth, ancestors.length + 1);
  });

  return {
    people,
    peopleCount: people.length,
    departmentCount: departments.size,
    managerCount: managers,
    depth: maxDepth,
  };
}

export function collectManagerIds(tree) {
  const ids = [];
  walkOrgTree(tree, (branch, reports) => {
    if (reports.length > 0 && branch.user?.id != null) ids.push(String(branch.user.id));
  });
  return ids;
}

export function collectAncestorIds(tree, userId) {
  const target = String(userId);
  let found = [];
  walkOrgTree(tree, (branch, _reports, ancestors) => {
    if (String(branch.user?.id) === target) found = ancestors;
  });
  return found;
}

export function personMatchesQuery(user, query) {
  if (!query) return false;
  const haystack = [user?.name, user?.full_name, user?.job_title, user?.department]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(query);
}
