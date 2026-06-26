import React from 'react';
import { cn } from '@/lib/utils';
import {
  getNotificationCategoryVisual,
  getNotificationPriorityVisual,
  getNotificationTypeVisual,
} from '@/lib/notificationVisuals';

export function NotificationTypeBadge({ type, className }) {
  const visual = getNotificationTypeVisual(type);
  const Icon = visual.icon;

  return (
    <span className={cn(
      'inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded',
      visual.bg,
      visual.color,
      className
    )}>
      <Icon className="w-2.5 h-2.5" />
      {visual.label}
    </span>
  );
}

export function NotificationCategoryBadge({ category, className }) {
  const visual = getNotificationCategoryVisual(category);
  const Icon = visual.icon;

  return (
    <span className={cn(
      'inline-flex items-center gap-1 text-[10px] font-medium text-foreground/80 dark:text-muted-foreground',
      'bg-background/90 dark:bg-muted border border-border/50 px-1.5 py-0.5 rounded',
      className
    )}>
      <Icon className="w-2.5 h-2.5" />
      {visual.label}
    </span>
  );
}

export function NotificationPriorityBadge({ priority, className }) {
  if (priority !== 'high' && priority !== 'critical') return null;

  const visual = getNotificationPriorityVisual(priority);

  return (
    <span className={cn(
      'inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide',
      visual.bg,
      visual.color,
      className
    )}>
      {visual.label}
    </span>
  );
}

export function NotificationSystemBadge({ systemId, className }) {
  if (!systemId?.trim()) return null;

  return (
    <span className={cn(
      'inline-flex items-center text-[10px] font-mono text-foreground/70 dark:text-muted-foreground',
      'bg-background/80 dark:bg-muted/80 border border-border/40 px-1.5 py-0.5 rounded',
      className
    )}>
      {systemId}
    </span>
  );
}
