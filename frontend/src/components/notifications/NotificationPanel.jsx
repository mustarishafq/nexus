import db from '@/api/apiClient';
import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { followNotificationAction } from '@/lib/notificationAction';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCheck, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Link } from 'react-router-dom';
import NotificationItem from './NotificationItem';
import {
  clearUnreadNotificationsCache,
  invalidateNotificationQueries,
  removeUnreadNotificationFromCache,
} from '@/hooks/useNotifications';
import { cn } from '@/lib/utils';
import { glassPanelStyles } from '@/components/layout/glassStyles';
import {
  isCriticalNotification,
  normalizeNotifications,
} from '@/lib/notificationVisuals';

export default function NotificationPanel({ open, onClose, onCountChange }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all');
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const invalidateSharedNotificationQueries = useCallback(() => {
    invalidateNotificationQueries(queryClient);
  }, [queryClient]);

  const { data: applications = [] } = useQuery({
    queryKey: ['applications'],
    queryFn: () => db.entities.Application.list(),
    enabled: open,
  });

  const load = useCallback(async () => {
    setLoading(true);
    const baseQuery = { exclude_broadcasts: true, exclude_direct_messages: true };
    const query = filter === 'unread' ? { ...baseQuery, is_read: false } : baseQuery;
    const data = await db.entities.Notification.filter(query, '-created_date', 50);
    setNotifications(normalizeNotifications(data));
    setLoading(false);
    const unread = data.filter(n => !n.is_read).length;
    onCountChange?.(unread);
  }, [filter, onCountChange]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (typeof db.entities.Notification.subscribe !== 'function') {
      return;
    }

    const unsub = db.entities.Notification.subscribe((event) => {
      if (event.type === 'create') {
        setNotifications(prev => [normalizeNotifications([event.data])[0], ...prev]);
        onCountChange?.(prev => (typeof prev === 'number' ? prev + 1 : 1));
      } else if (event.type === 'update') {
        setNotifications(prev => prev.map(n => n.id === event.id ? normalizeNotifications([event.data])[0] : n));
      } else if (event.type === 'delete') {
        setNotifications(prev => prev.filter(n => n.id !== event.id));
      }
    });

    return typeof unsub === 'function' ? unsub : undefined;
  }, [onCountChange]);

  const markRead = async (notif) => {
    if (notif.is_read) return;

    const readAt = new Date().toISOString();
    setNotifications((prev) =>
      prev.map((n) => (n.id === notif.id ? { ...n, is_read: true, read_at: readAt } : n))
    );
    removeUnreadNotificationFromCache(queryClient, notif.id);
    onCountChange?.((prev) => Math.max(0, (typeof prev === 'number' ? prev : 0) - 1));

    try {
      await db.entities.Notification.update(notif.id, { is_read: true, read_at: readAt });
      invalidateSharedNotificationQueries();
    } catch {
      await load();
      invalidateSharedNotificationQueries();
      toast.error('Failed to mark notification as read.');
    }
  };

  const markAllRead = async () => {
    const unread = notifications.filter((n) => !n.is_read);
    if (unread.length === 0) return;

    const readAt = new Date().toISOString();
    setNotifications((prev) =>
      prev.map((n) => (n.is_read ? n : { ...n, is_read: true, read_at: readAt }))
    );
    clearUnreadNotificationsCache(queryClient);
    onCountChange?.(0);

    try {
      await Promise.all(
        unread.map((n) =>
          db.entities.Notification.update(n.id, { is_read: true, read_at: readAt })
        )
      );
      invalidateSharedNotificationQueries();
    } catch {
      await load();
      invalidateSharedNotificationQueries();
      toast.error('Failed to mark all notifications as read.');
    }
  };

  const snooze = async (notif) => {
    const snoozeUntil = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    setNotifications((prev) =>
      prev.map((n) => (n.id === notif.id ? { ...n, snoozed_until: snoozeUntil } : n))
    );

    try {
      await db.entities.Notification.update(notif.id, { snoozed_until: snoozeUntil });
      invalidateSharedNotificationQueries();
    } catch {
      await load();
      invalidateSharedNotificationQueries();
      toast.error('Failed to snooze notification.');
    }
  };

  const dismiss = async (notif) => {
    setNotifications((prev) => prev.filter((n) => n.id !== notif.id));
    if (!notif.is_read) {
      removeUnreadNotificationFromCache(queryClient, notif.id);
      onCountChange?.((prev) => Math.max(0, (typeof prev === 'number' ? prev : 0) - 1));
    }

    try {
      await db.entities.Notification.delete(notif.id);
      invalidateSharedNotificationQueries();
    } catch {
      await load();
      invalidateSharedNotificationQueries();
      toast.error('Failed to dismiss notification.');
    }
  };

  const activateNotification = useCallback(async (notif) => {
    try {
      await followNotificationAction(notif, { applications, navigate, onClose });
    } catch (error) {
      toast.error(error?.message || 'Unable to open notification link.');
    }
  }, [applications, navigate, onClose]);

  const filtered = notifications.filter(n => {
    if (filter === 'unread') return !n.read_at && !n.is_read;
    if (filter === 'critical') return isCriticalNotification(n);
    return true;
  });

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[60] bg-black/20 backdrop-blur-sm"
          />

          {/* Panel */}
          <motion.div
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className={cn(
              'fixed right-0 top-0 bottom-0 z-[61] flex w-full max-w-md flex-col',
              'rounded-bl-2xl sm:rounded-none border-l',
              glassPanelStyles
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border/50">
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-primary" />
                <h2 className="font-semibold text-lg">Notifications</h2>
                {notifications.filter(n => !n.is_read).length > 0 && (
                  <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full font-medium">
                    {notifications.filter(n => !n.is_read).length}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={markAllRead} className="text-xs h-8">
                  <CheckCheck className="w-3.5 h-3.5 mr-1" /> Mark all read
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="px-4 pt-3">
              <Tabs value={filter} onValueChange={setFilter}>
                <TabsList className="w-full bg-muted/50 h-9 text-foreground/60">
                  <TabsTrigger value="all" className="text-xs flex-1 data-[state=active]:text-foreground">All</TabsTrigger>
                  <TabsTrigger value="unread" className="text-xs flex-1 data-[state=active]:text-foreground">Unread</TabsTrigger>
                  <TabsTrigger value="critical" className="text-xs flex-1 data-[state=active]:text-foreground">Critical</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Notifications List */}
            <ScrollArea className="flex-1 px-3 py-2">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-6 h-6 border-2 border-muted border-t-primary rounded-full animate-spin" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <Bell className="w-10 h-10 mb-3 opacity-30" />
                  <p className="text-sm font-medium">No notifications</p>
                  <p className="text-xs text-foreground/60 dark:text-muted-foreground mt-1">You're all caught up!</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {filtered.map(notif => (
                    <NotificationItem
                      key={notif.id}
                      notification={notif}
                      onMarkRead={markRead}
                      onSnooze={snooze}
                      onDelete={dismiss}
                      onActivate={activateNotification}
                    />
                  ))}
                </div>
              )}
            </ScrollArea>

            {/* Footer */}
            <div className="p-3 border-t border-border/50">
              <Link to="/notifications" onClick={onClose}>
                <Button variant="outline" className="w-full text-sm h-9">
                  View All Notifications
                </Button>
              </Link>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}