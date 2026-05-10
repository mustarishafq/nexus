import db from '@/api/base44Client';
import React, { useState, useEffect, useCallback } from 'react';

import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCheck, Filter, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Link } from 'react-router-dom';
import NotificationItem from './NotificationItem';

export default function NotificationPanel({ open, onClose, onCountChange }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    const query = filter === 'unread'
      ? { is_read: false, exclude_broadcasts: true }
      : { exclude_broadcasts: true };
    const data = await db.entities.Notification.filter(query, '-created_date', 50);
    setNotifications(data);
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
        setNotifications(prev => [event.data, ...prev]);
        onCountChange?.(prev => (typeof prev === 'number' ? prev + 1 : 1));
      } else if (event.type === 'update') {
        setNotifications(prev => prev.map(n => n.id === event.id ? event.data : n));
      } else if (event.type === 'delete') {
        setNotifications(prev => prev.filter(n => n.id !== event.id));
      }
    });

    return typeof unsub === 'function' ? unsub : undefined;
  }, [onCountChange]);

  const markRead = async (notif) => {
    await db.entities.Notification.update(notif.id, { is_read: true, read_at: new Date().toISOString() });
    load();
  };

  const markAllRead = async () => {
    const unread = notifications.filter(n => !n.is_read);
    await Promise.all(unread.map(n =>
      db.entities.Notification.update(n.id, { is_read: true, read_at: new Date().toISOString() })
    ));
    load();
  };

  const snooze = async (notif) => {
    const snoozeUntil = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    await db.entities.Notification.update(notif.id, { snoozed_until: snoozeUntil });
    load();
  };

  const dismiss = async (notif) => {
    await db.entities.Notification.delete(notif.id);
    load();
  };

  const filtered = notifications.filter(n => {
    if (filter === 'unread') return !n.is_read;
    if (filter === 'critical') return n.type === 'critical' || n.type === 'error';
    return true;
  });

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm"
          />

          {/* Panel */}
          <motion.div
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-card border-l border-border shadow-2xl flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
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
                <TabsList className="w-full bg-muted/50 h-9">
                  <TabsTrigger value="all" className="text-xs flex-1">All</TabsTrigger>
                  <TabsTrigger value="unread" className="text-xs flex-1">Unread</TabsTrigger>
                  <TabsTrigger value="critical" className="text-xs flex-1">Critical</TabsTrigger>
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
                  <p className="text-xs mt-1">You're all caught up!</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {filtered.map(notif => (
                    <NotificationItem
                      key={notif.id}
                      notification={notif}
                      onMarkRead={markRead}
                      onSnooze={snooze}
                      onDelete={dismiss}
                    />
                  ))}
                </div>
              )}
            </ScrollArea>

            {/* Footer */}
            <div className="p-3 border-t border-border">
              <Link to="/notifications" onClick={onClose}>
                <Button variant="outline" className="w-full text-sm h-9">
                  View All Notifications
                </Button>
              </Link>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}