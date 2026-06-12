import React from 'react';
import { Eye } from 'lucide-react';
import { Label } from '@/components/ui/label';
import NotificationItem from './NotificationItem';
import {
  NotificationCategoryBadge,
  NotificationPriorityBadge,
  NotificationTypeBadge,
} from './NotificationVisualBadges';

export default function NotificationPreview({ payload }) {
  if (!payload?.title) return null;

  const previewNotification = {
    id: 'preview',
    title: payload.title,
    message: payload.message || '',
    type: payload.type || 'info',
    category: payload.category || 'other',
    priority: payload.priority || 'medium',
    system_id: payload.system_id || '',
    action_url: payload.action_url || '',
    is_read: false,
    created_date: new Date().toISOString(),
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Eye className="w-4 h-4 text-primary" />
        <Label>In-app preview</Label>
      </div>
      <p className="text-[11px] text-muted-foreground">
        How this notification will appear to users in Nexus.
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        <NotificationTypeBadge type={previewNotification.type} />
        <NotificationCategoryBadge category={previewNotification.category} />
        <NotificationPriorityBadge priority={previewNotification.priority} />
      </div>
      <div className="pointer-events-none opacity-95">
        <NotificationItem notification={previewNotification} />
      </div>
    </div>
  );
}
