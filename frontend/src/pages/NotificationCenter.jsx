import db from '@/api/apiClient';
import React, { useState, useCallback } from 'react';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { followNotificationAction } from '@/lib/notificationAction';
import { Bell, CheckCheck, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import NotificationItem from '@/components/notifications/NotificationItem';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import {
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_TYPES,
  getNotificationCategoryVisual,
  getNotificationTypeVisual,
  normalizeNotifications,
} from '@/lib/notificationVisuals';
import { useMetaTags } from '@/hooks/useMetaTags';
import { buildSystemStatusDescription } from '@/lib/MetaTagManager';
import {
  clearUnreadNotificationsCache,
  invalidateNotificationQueries,
} from '@/hooks/useNotifications';

export default function NotificationCenter() {
  const [filter, setFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications-center'],
    queryFn: () =>
      db.entities.Notification.filter(
        { exclude_broadcasts: true, exclude_direct_messages: true },
        '-created_date',
        200
      ),
    select: normalizeNotifications,
  });

  const { data: applications = [] } = useQuery({
    queryKey: ['applications'],
    queryFn: () => db.entities.Application.list(),
  });

  // Update meta tags for sharing
  const unreadCount = notifications.filter(n => !n.is_read).length;
  useMetaTags({
    title: 'Notification Center - EMZI Nexus Brain',
    description: buildSystemStatusDescription(unreadCount, notifications.length),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => db.entities.Notification.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications-center'] }),
  });

  const deleteMut = useMutation({
    mutationFn: (id) => db.entities.Notification.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications-center'] }),
  });

  const markRead = (notif) => updateMut.mutate({ id: notif.id, data: { is_read: true, read_at: new Date().toISOString() } });
  const snooze = (notif) => updateMut.mutate({ id: notif.id, data: { snoozed_until: new Date(Date.now() + 3600000).toISOString() } });
  const dismiss = (notif) => deleteMut.mutate(notif.id);

  const activateNotification = useCallback(async (notif) => {
    try {
      await followNotificationAction(notif, { applications, navigate });
    } catch (error) {
      toast.error(error?.message || 'Unable to open notification link.');
    }
  }, [applications, navigate]);

  const markAllRead = async () => {
    const unread = notifications.filter((n) => !n.is_read);
    if (unread.length === 0) return;

    const readAt = new Date().toISOString();
    queryClient.setQueryData(['notifications-center'], (old = []) =>
      old.map((n) => (n.is_read ? n : { ...n, is_read: true, read_at: readAt }))
    );
    clearUnreadNotificationsCache(queryClient);

    try {
      await Promise.all(
        unread.map((n) =>
          db.entities.Notification.update(n.id, { is_read: true, read_at: readAt })
        )
      );
      queryClient.invalidateQueries({ queryKey: ['notifications-center'] });
      invalidateNotificationQueries(queryClient);
    } catch {
      queryClient.invalidateQueries({ queryKey: ['notifications-center'] });
      invalidateNotificationQueries(queryClient);
      toast.error('Failed to mark all notifications as read.');
    }
  };

  const filtered = notifications.filter(n => {
    if (filter === 'unread' && n.is_read) return false;
    if (filter === 'read' && !n.is_read) return false;
    if (typeFilter !== 'all' && n.type !== typeFilter) return false;
    if (categoryFilter !== 'all' && n.category !== categoryFilter) return false;
    if (search && !n.title?.toLowerCase().includes(search.toLowerCase()) && !n.message?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // Group by date
  const grouped = {};
  filtered.forEach(n => {
    const date = new Date(n.created_date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    if (!grouped[date]) grouped[date] = [];
    grouped[date].push(n);
  });

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Bell}
        title="Notification Center"
        description={`${notifications.filter((n) => !n.is_read).length} unread of ${notifications.length} total`}
        actions={unreadCount > 0 ? (
          <Button onClick={markAllRead} variant="outline" size="sm" className="gap-1">
            <CheckCheck className="h-4 w-4" /> Mark all read
          </Button>
        ) : null}
      />

      {/* Filters */}
      <div className="bg-card rounded-2xl border border-border p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search notifications..." className="pl-9 h-9 bg-muted/50 border-0" />
          </div>
          <Tabs value={filter} onValueChange={setFilter}>
            <TabsList className="h-9 bg-muted/50">
              <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
              <TabsTrigger value="unread" className="text-xs">Unread</TabsTrigger>
              <TabsTrigger value="read" className="text-xs">Read</TabsTrigger>
            </TabsList>
          </Tabs>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-32 h-9 text-xs">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {NOTIFICATION_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {getNotificationTypeVisual(type).label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-36 h-9 text-xs">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {NOTIFICATION_CATEGORIES.filter((c) => c !== 'other').map((category) => (
                <SelectItem key={category} value={category}>
                  {getNotificationCategoryVisual(category).label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Notification List */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-muted border-t-primary rounded-full animate-spin" />
        </div>
      ) : Object.keys(grouped).length === 0 ? (
        <EmptyState
          variant="inline"
          icon={Bell}
          title="No notifications found"
          description="Try adjusting your filters or check back later."
        />
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([date, notifs]) => (
            <div key={date}>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">{date}</h3>
              <div className="bg-card rounded-2xl border border-border p-2.5 space-y-2.5">
                {notifs.map(n => (
                  <NotificationItem
                    key={n.id}
                    notification={n}
                    onMarkRead={markRead}
                    onSnooze={snooze}
                    onDelete={dismiss}
                    onActivate={activateNotification}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}