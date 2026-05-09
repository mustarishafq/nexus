import React from 'react';
import { Bell, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import NotificationItem from '@/components/notifications/NotificationItem';

export default function RecentNotificationsWidget({ notifications, onMarkRead }) {
  const recent = notifications.slice(0, 5);

  return (
    <div className="bg-card rounded-2xl border border-border">
      <div className="flex items-center justify-between p-5 pb-3">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-sm">Recent Notifications</h3>
        </div>
        <Link to="/notifications">
          <Button variant="ghost" size="sm" className="text-xs h-7 gap-1">
            View all <ArrowRight className="w-3 h-3" />
          </Button>
        </Link>
      </div>
      <div className="px-3 pb-3 space-y-0.5">
        {recent.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No recent notifications</p>
        ) : (
          recent.map(n => (
            <NotificationItem key={n.id} notification={n} onMarkRead={onMarkRead} />
          ))
        )}
      </div>
    </div>
  );
}