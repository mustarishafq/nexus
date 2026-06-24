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
    border: 'border-info/20',
    dot: 'bg-info',
    chartFill: 'hsl(var(--info))',
  },
  success: {
    label: 'Success',
    icon: CheckCircle,
    color: 'text-success',
    bg: 'bg-success/10',
    border: 'border-success/20',
    dot: 'bg-success',
    chartFill: 'hsl(var(--success))',
  },
  warning: {
    label: 'Warning',
    icon: AlertTriangle,
    color: 'text-warning',
    bg: 'bg-warning/10',
    border: 'border-warning/20',
    dot: 'bg-warning',
    chartFill: 'hsl(var(--warning))',
  },
  error: {
    label: 'Error',
    icon: XCircle,
    color: 'text-destructive',
    bg: 'bg-destructive/10',
    border: 'border-destructive/20',
    dot: 'bg-destructive',
    chartFill: 'hsl(var(--destructive))',
  },
  critical: {
    label: 'Critical',
    icon: AlertOctagon,
    color: 'text-critical',
    bg: 'bg-critical/10',
    border: 'border-critical/20',
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
  low: { label: 'Low', color: 'text-muted-foreground', bg: 'bg-muted' },
  medium: { label: 'Medium', color: 'text-info', bg: 'bg-info/10' },
  high: { label: 'High', color: 'text-warning', bg: 'bg-warning/10' },
  critical: { label: 'Critical', color: 'text-critical', bg: 'bg-critical/10' },
};

export function getNotificationTypeVisual(type) {
  return notificationTypeVisuals[type] || notificationTypeVisuals.info;
}

export function getNotificationCategoryVisual(category) {
  return notificationCategoryVisuals[category] || notificationCategoryVisuals.other;
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
