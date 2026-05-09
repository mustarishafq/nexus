import React from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import {
  Info, CheckCircle, AlertTriangle, XCircle, AlertOctagon,
  BookOpen, Users, Package, DollarSign, Shield, Monitor,
  ListTodo, ThumbsUp, Megaphone, MoreHorizontal, Clock, Check, BellOff
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';

const typeConfig = {
  info: { icon: Info, color: 'text-info', bg: 'bg-info/10', border: 'border-info/20' },
  success: { icon: CheckCircle, color: 'text-success', bg: 'bg-success/10', border: 'border-success/20' },
  warning: { icon: AlertTriangle, color: 'text-warning', bg: 'bg-warning/10', border: 'border-warning/20' },
  error: { icon: XCircle, color: 'text-destructive', bg: 'bg-destructive/10', border: 'border-destructive/20' },
  critical: { icon: AlertOctagon, color: 'text-critical', bg: 'bg-critical/10', border: 'border-critical/20' },
};

const categoryIcons = {
  booking: BookOpen, hr: Users, inventory: Package, finance: DollarSign,
  security: Shield, system: Monitor, task: ListTodo, approval: ThumbsUp,
  announcement: Megaphone, other: Info,
};

export default function NotificationItem({ notification, onMarkRead, onSnooze, onDelete }) {
  const config = typeConfig[notification.type] || typeConfig.info;
  const TypeIcon = config.icon;
  const CategoryIcon = categoryIcons[notification.category] || Info;

  return (
    <div
      className={cn(
        "group relative flex gap-3 p-3.5 rounded-xl transition-all duration-200 cursor-pointer border",
        notification.is_read
          ? cn("border", config.border, "bg-muted/30 hover:bg-muted/50")
          : cn("border", config.border, config.bg, "hover:opacity-90")
      )}
      onClick={() => !notification.is_read && onMarkRead?.(notification)}
    >
      {/* Icon */}
      <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", config.bg)}>
        <TypeIcon className={cn("w-4.5 h-4.5", config.color)} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className={cn("text-sm font-medium leading-snug", !notification.is_read && "font-semibold")}>
              {notification.title}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
              {notification.message}
            </p>
          </div>

          {/* Actions */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-muted transition-all shrink-0">
                <MoreHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
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
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDelete?.(notification); }} className="text-destructive">
                <BellOff className="w-3.5 h-3.5 mr-2" /> Dismiss
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Meta */}
        <div className="flex items-center gap-2 mt-2">
          {notification.system_id && (
            <span className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
              <CategoryIcon className="w-2.5 h-2.5" />
              {notification.system_id}
            </span>
          )}
          {notification.priority === 'critical' && (
            <span className="text-[10px] font-bold text-critical bg-critical/10 px-1.5 py-0.5 rounded">
              CRITICAL
            </span>
          )}
          <span className="text-[10px] text-muted-foreground ml-auto">
            {formatDistanceToNow(new Date(notification.created_date), { addSuffix: true })}
          </span>
        </div>
      </div>

      {/* Unread dot */}
      {!notification.is_read && (
        <div className="absolute top-3.5 right-3.5 w-2 h-2 rounded-full bg-primary" />
      )}
    </div>
  );
}