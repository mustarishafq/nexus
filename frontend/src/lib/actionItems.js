export const ACTION_ITEMS_QUERY_KEY = ['dashboard', 'action-items'];

const CATEGORY_LABELS = {
  calendar: 'Meeting',
  approval: 'Approval',
  task: 'Task',
  hr: 'Profile',
  booking: 'Booking',
  inventory: 'Inventory',
  finance: 'Finance',
  security: 'Security',
  system: 'System',
  announcement: 'Announcement',
  other: 'Action',
};

export function filterActionItems(todos = []) {
  return todos.filter((todo) => !todo.completed_at);
}

export function formatTodoTitle(todo) {
  const title = todo?.title?.trim() || 'Untitled task';

  if (todo.category === 'calendar') {
    return title.replace(/^Meeting (invitation|rescheduled|cancelled):\s*/i, '');
  }

  return title;
}

export function getTodoCategoryLabel(todo) {
  return CATEGORY_LABELS[todo?.category] || CATEGORY_LABELS.other;
}

export function getTodoActionHint(todo) {
  if (todo.category === 'calendar') {
    return 'Review invite';
  }

  if (todo.category === 'approval') {
    return 'Needs approval';
  }

  if (todo.category === 'task' && todo.system_id) {
    return `Open ${todo.system_id.replace(/-/g, ' ')}`;
  }

  if (todo.action_url?.trim() || todo.system_id?.trim()) {
    return 'Open linked app';
  }

  return 'Review';
}
