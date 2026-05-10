import db from '@/api/base44Client';
import React, { useState } from 'react';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck, Search, Filter, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { motion } from 'framer-motion';
import NotificationItem from '@/components/notifications/NotificationItem';

export default function NotificationCenter() {
  const [filter, setFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications-center'],
    queryFn: () => db.entities.Notification.filter({ exclude_broadcasts: true }, '-created_date', 200),
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

  const markAllRead = async () => {
    const unread = notifications.filter(n => !n.is_read);
    await Promise.all(unread.map(n => db.entities.Notification.update(n.id, { is_read: true, read_at: new Date().toISOString() })));
    queryClient.invalidateQueries({ queryKey: ['notifications-center'] });
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
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Bell className="w-6 h-6 text-primary" /> Notification Center
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {notifications.filter(n => !n.is_read).length} unread of {notifications.length} total
          </p>
        </div>
        <Button onClick={markAllRead} variant="outline" size="sm" className="gap-1">
          <CheckCheck className="w-4 h-4" /> Mark All Read
        </Button>
      </motion.div>

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
              <SelectItem value="info">Info</SelectItem>
              <SelectItem value="success">Success</SelectItem>
              <SelectItem value="warning">Warning</SelectItem>
              <SelectItem value="error">Error</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-36 h-9 text-xs">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="booking">Booking</SelectItem>
              <SelectItem value="hr">HR</SelectItem>
              <SelectItem value="inventory">Inventory</SelectItem>
              <SelectItem value="finance">Finance</SelectItem>
              <SelectItem value="security">Security</SelectItem>
              <SelectItem value="system">System</SelectItem>
              <SelectItem value="task">Task</SelectItem>
              <SelectItem value="approval">Approval</SelectItem>
              <SelectItem value="announcement">Announcement</SelectItem>
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
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Bell className="w-12 h-12 mb-4 opacity-20" />
          <p className="font-medium">No notifications found</p>
          <p className="text-sm mt-1">Try adjusting your filters</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([date, notifs]) => (
            <div key={date}>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">{date}</h3>
              <div className="bg-card rounded-2xl border border-border p-2 space-y-0.5">
                {notifs.map(n => (
                  <NotificationItem key={n.id} notification={n} onMarkRead={markRead} onSnooze={snooze} onDelete={dismiss} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}