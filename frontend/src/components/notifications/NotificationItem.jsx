import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { MoreHorizontal, Clock, Check, BellOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getNotificationTypeVisual } from '@/lib/notificationVisuals';
import {
  NotificationCategoryBadge,
  NotificationPriorityBadge,
  NotificationSystemBadge,
} from '@/components/notifications/NotificationVisualBadges';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';

export default function NotificationItem({ notification, onMarkRead, onSnooze, onDelete, onActivate }) {
  const config = getNotificationTypeVisual(notification.type);
  const TypeIcon = config.icon;
  const hasAction = Boolean(notification.action_url?.trim());

  const handleClick = async () => {
    if (!notification.is_read) {
      await onMarkRead?.(notification);
    }

    if (hasAction && onActivate) {
      await onActivate(notification);
    }
  };

  return (
    <div
      className={cn(
        'group relative flex gap-3 p-3.5 rounded-xl border transition-all duration-200 cursor-pointer',
        notification.is_read
          ? 'border-border bg-card/70 shadow-sm hover:border-border/90 hover:bg-muted/40 dark:bg-muted/30 dark:hover:bg-muted/50'
          : cn(
              config.border,
              config.bg,
              'shadow-sm ring-1 ring-black/[0.05] dark:ring-white/[0.08] hover:opacity-95'
            )
      )}
      onClick={handleClick}
    >
      <div
        className={cn(
          'w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border border-black/[0.06] dark:border-white/10',
          config.bg
        )}
      >
        <TypeIcon className={cn('w-[18px] h-[18px]', config.color)} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p
              className={cn(
                'text-sm text-foreground leading-snug font-medium',
                !notification.is_read && 'font-semibold'
              )}
            >
              {notification.title}
            </p>
            {notification.message ? (
              <p className="text-xs text-foreground/75 dark:text-muted-foreground mt-0.5 line-clamp-2">
                {notification.message}
              </p>
            ) : null}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="opacity-0 group-hover:opacity-100 h-6 w-6 shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              {!notification.is_read && (
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onMarkRead?.(notification); }}>
                  <Check className="w-3.5 h-3.5 mr-2" /> Mark as read
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onSnooze?.(notification); }}>
                <Clock className="w-3.5 h-3.5 mr-2" /> Snooze 1hr
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => { e.stopPropagation(); onDelete?.(notification); }}
                className="text-destructive"
              >
                <BellOff className="w-3.5 h-3.5 mr-2" /> Dismiss
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center flex-wrap gap-1.5 mt-2">
          {notification.category ? (
            <NotificationCategoryBadge category={notification.category} />
          ) : null}
          <NotificationSystemBadge systemId={notification.system_id} />
          <NotificationPriorityBadge priority={notification.priority} />
          <span className="text-[10px] text-foreground/60 dark:text-muted-foreground ml-auto">
            {formatDistanceToNow(new Date(notification.created_date), { addSuffix: true })}
          </span>
        </div>
      </div>

      {!notification.is_read && (
        <div className={cn('absolute top-3.5 right-3.5 w-2 h-2 rounded-full', config.dot)} />
      )}
    </div>
  );
}
