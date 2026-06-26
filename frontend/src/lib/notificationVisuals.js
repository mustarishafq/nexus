import {
  Info, CheckCircle, AlertTriangle, XCircle, AlertOctagon,
  BookOpen, Users, Package, DollarSign, Shield, Monitor,
  ListTodo, ThumbsUp, Megaphone, Calendar,
} from 'lucide-react';

export const NOTIFICATION_TYPES = ['info', 'success', 'warning', 'error', 'critical'];

export const NOTIFICATION_CATEGORIES = [
  'booking', 'hr', 'inventory', 'finance', 'security',
  'system', 'task', 'approval', 'announcement', 'calendar', 'other',
];

export const NOTIFICATION_PRIORITIES = ['low', 'medium', 'high', 'critical'];

export const notificationTypeVisuals = {
  info: {
    label: 'Info',
    icon: Info,
    color: 'text-info',
    bg: 'bg-info/10',
    border: 'border-info/45 dark:border-info/30',
    dot: 'bg-info',
    chartFill: 'hsl(var(--info))',
  },
  success: {
    label: 'Success',
    icon: CheckCircle,
    color: 'text-success',
    bg: 'bg-success/10',
    border: 'border-success/45 dark:border-success/30',
    dot: 'bg-success',
    chartFill: 'hsl(var(--success))',
  },
  warning: {
    label: 'Warning',
    icon: AlertTriangle,
    color: 'text-warning',
    bg: 'bg-warning/10',
    border: 'border-warning/50 dark:border-warning/35',
    dot: 'bg-warning',
    chartFill: 'hsl(var(--warning))',
  },
  error: {
    label: 'Error',
    icon: XCircle,
    color: 'text-destructive',
    bg: 'bg-destructive/10',
    border: 'border-destructive/45 dark:border-destructive/30',
    dot: 'bg-destructive',
    chartFill: 'hsl(var(--destructive))',
  },
  critical: {
    label: 'Critical',
    icon: AlertOctagon,
    color: 'text-critical',
    bg: 'bg-critical/10',
    border: 'border-critical/45 dark:border-critical/30',
    dot: 'bg-critical',
    chartFill: 'hsl(var(--critical))',
  },
};

export const notificationCategoryVisuals = {
  booking: { label: 'Booking', icon: BookOpen },
  hr: { label: 'HR', icon: Users },
  inventory: { label: 'Inventory', icon: Package },
  finance: { label: 'Finance', icon: DollarSign },
  security: { label: 'Security', icon: Shield },
  system: { label: 'System', icon: Monitor },
  task: { label: 'Task', icon: ListTodo },
  approval: { label: 'Approval', icon: ThumbsUp },
  announcement: { label: 'Announcement', icon: Megaphone },
  calendar: { label: 'Calendar', icon: Calendar },
  other: { label: 'Other', icon: Info },
};

export const notificationPriorityVisuals = {
  low: {
    label: 'Low',
    color: 'text-foreground/70 dark:text-muted-foreground',
    bg: 'bg-muted',
  },
  medium: {
    label: 'Medium',
    color: 'text-info-foreground',
    bg: 'bg-info',
  },
  high: {
    label: 'High',
    color: 'text-warning-foreground dark:text-warning',
    bg: 'bg-warning dark:bg-warning/25 dark:border dark:border-warning/40',
  },
  critical: {
    label: 'Critical',
    color: 'text-critical-foreground dark:text-critical',
    bg: 'bg-critical dark:bg-critical/25 dark:border dark:border-critical/40',
  },
};

function compactSystemId(value) {
  if (!value?.trim()) return '';
  const id = value.trim();
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(id)) {
    return id.replace(/-/g, '').slice(0, 5);
  }
  return id.length > 8 ? id.slice(0, 5) : id;
}

export function inferBookingNotificationMeta(rawType = '') {
  const type = String(rawType).toLowerCase();
  let visualType = 'info';
  let priority = 'medium';
  let category = 'other';

  if (type.includes('rejected') || type.includes('cancelled')) {
    visualType = 'error';
    priority = 'critical';
  } else if (type.includes('pending')) {
    visualType = 'warning';
    priority = 'high';
  } else if (type.includes('confirmed') || type.includes('new_pic') || type.includes('submitted')) {
    visualType = 'success';
  }

  if (type.startsWith('booking')) {
    category = 'booking';
  } else if (type.includes('task') || type.includes('care')) {
    category = 'task';
  }

  return { visualType, priority, category };
}

export function normalizeNotification(raw) {
  if (!raw) return raw;

  const is_read = raw.is_read ?? Boolean(raw.read_at);
  const action_url = raw.action_url || raw.link || '';
  const system_id = compactSystemId(raw.system_id);

  let { type, priority, category } = raw;
  const rawType = raw.type || '';
  const isStandardType = NOTIFICATION_TYPES.includes(type);

  if (!category || category === 'other' || !priority || !isStandardType) {
    const inferred = inferBookingNotificationMeta(rawType);
    if (!category || category === 'other') category = inferred.category;
    if (!priority) priority = inferred.priority;
    if (!isStandardType) type = inferred.visualType;
  }

  return {
    ...raw,
    is_read,
    action_url,
    system_id,
    type: NOTIFICATION_TYPES.includes(type) ? type : 'info',
    priority: priority || 'medium',
    category: category || 'other',
  };
}

export function normalizeNotifications(items) {
  return Array.isArray(items) ? items.map(normalizeNotification) : [];
}

export function isCriticalNotification(notification) {
  const type = notification?.type;
  return type === 'error' || type === 'critical';
}

export function getNotificationTypeVisual(type) {
  return notificationTypeVisuals[type] || notificationTypeVisuals.info;
}

export function getNotificationCategoryVisual(category) {
  return notificationCategoryVisuals[category] || notificationCategoryVisuals.other;
}

export function getNotificationCategoryIcon(category) {
  return getNotificationCategoryVisual(category).icon;
}

export function getNotificationPriorityVisual(priority) {
  return notificationPriorityVisuals[priority] || notificationPriorityVisuals.medium;
}

export function buildNotificationChartData(notifications) {
  return NOTIFICATION_TYPES.map((type) => {
    const visual = getNotificationTypeVisual(type);
    return {
      name: visual.label,
      type,
      count: notifications.filter((n) => n.type === type).length,
      fill: visual.chartFill,
    };
  });
}

const pushToastByType = {
  success: 'success',
  error: 'error',
  warning: 'warning',
  critical: 'error',
  info: 'info',
};

export function showPushNotificationToast(payload, toast) {
  const title = payload.title || 'EMZI Nexus Brain';
  const body = payload.message || payload.body || 'You have a new notification.';
  const method = pushToastByType[payload.type] || 'info';

  toast[method](title, { description: body });
}
