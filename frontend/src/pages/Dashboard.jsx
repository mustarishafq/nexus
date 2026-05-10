import db from '@/api/base44Client';
import React from 'react';

import { useQuery } from '@tanstack/react-query';
import { Bell, Monitor, AlertTriangle, Clock } from 'lucide-react';
import StatsCard from '@/components/dashboard/StatsCard';
import RecentNotificationsWidget from '@/components/dashboard/RecentNotificationsWidget';
import SystemHealthWidget from '@/components/dashboard/SystemHealthWidget';
import ActivityWidget from '@/components/dashboard/ActivityWidget';
import NotificationChart from '@/components/dashboard/NotificationChart';
import { motion } from 'framer-motion';

export default function Dashboard() {
  const { data: user } = useQuery({
    queryKey: ['current-user'],
    queryFn: () => db.auth.me(),
    staleTime: 0,
    refetchOnMount: 'always',
    retry: false,
  });

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications-dash'],
    queryFn: () => db.entities.Notification.list('-created_date', 50),
  });

  const { data: activities = [] } = useQuery({
    queryKey: ['activities-dash'],
    queryFn: () => db.entities.ActivityLog.list('-created_date', 20),
  });

  const { data: systems = [] } = useQuery({
    queryKey: ['connected-systems'],
    queryFn: () => db.entities.ConnectedSystem.list('-created_date', 50),
  });

  const { data: events = [] } = useQuery({
    queryKey: ['events-dash'],
    queryFn: () => db.entities.SystemEvent.list('-created_date', 20),
  });

  const unreadCount = notifications.filter(n => !n.is_read).length;
  const criticalCount = notifications.filter(n => n.type === 'critical' || n.type === 'error').length;
  const onlineSystems = systems.filter(s => s.status === 'online').length;
  const pendingEvents = events.filter(e => e.status === 'pending').length;

  const markRead = async (notif) => {
    await db.entities.Notification.update(notif.id, { is_read: true, read_at: new Date().toISOString() });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold tracking-tight">
          Welcome back{user?.full_name ? `, ${user.full_name}` : ''}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Your command center overview
        </p>
      </motion.div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Unread"
          value={unreadCount}
          icon={Bell}
          color="bg-primary/10"
          subtitle={`${notifications.length} total notifications`}
          index={0}
        />
        <StatsCard
          title="Critical Alerts"
          value={criticalCount}
          icon={AlertTriangle}
          color="bg-destructive/10"
          subtitle="Requires attention"
          index={1}
        />
        <StatsCard
          title="Systems Online"
          value={`${onlineSystems}/${systems.length}`}
          icon={Monitor}
          color="bg-success/10"
          subtitle="Connected systems"
          index={2}
        />
        <StatsCard
          title="Pending Events"
          value={pendingEvents}
          icon={Clock}
          color="bg-warning/10"
          subtitle="Awaiting processing"
          index={3}
        />
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Notifications + Chart */}
        <div className="lg:col-span-2 space-y-6">
          <RecentNotificationsWidget notifications={notifications} onMarkRead={markRead} />
          <NotificationChart notifications={notifications} />
        </div>

        {/* Right: System Health + Activity */}
        <div className="space-y-6">
          <SystemHealthWidget systems={systems} />
          <ActivityWidget activities={activities} />
        </div>
      </div>
    </div>
  );
}