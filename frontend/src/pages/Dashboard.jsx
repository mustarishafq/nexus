import db from '@/api/base44Client';
import React from 'react';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import RecentNotificationsWidget from '@/components/dashboard/RecentNotificationsWidget';
import SystemHealthWidget from '@/components/dashboard/SystemHealthWidget';
import ProfileDashboardHero from '@/components/dashboard/ProfileDashboardHero';
import { getDisplayName } from '@/lib/profile';
import ProfileAboutCard from '@/components/dashboard/ProfileAboutCard';
import CompanyFeedWidget from '@/components/dashboard/CompanyFeedWidget';
import ProfileRecentApplicationsWidget from '@/components/dashboard/ProfileRecentApplicationsWidget';
import TodaysCelebrationsWidget from '@/components/dashboard/TodaysCelebrationsWidget';
import WeeklyCalendarWidget from '@/components/dashboard/WeeklyCalendarWidget';
import { motion } from 'framer-motion';
import { useMetaTags } from '@/hooks/useMetaTags';
import { useAuth } from '@/lib/AuthContext';

export default function Dashboard() {
  const queryClient = useQueryClient();
  const { user: authUser } = useAuth();

  const { data: user } = useQuery({
    queryKey: ['current-user'],
    queryFn: () => db.auth.me(),
    initialData: authUser ?? undefined,
    staleTime: 0,
    refetchOnMount: 'always',
    retry: false,
  });

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications-dash'],
    queryFn: () =>
      db.entities.Notification.filter(
        { exclude_broadcasts: true, exclude_direct_messages: true },
        '-created_date',
        50
      ),
  });

  const { data: systems = [] } = useQuery({
    queryKey: ['applications'],
    queryFn: () => db.entities.Application.list('sort_order', 50),
  });

  const { data: activities = [] } = useQuery({
    queryKey: ['activities-dash', user?.id],
    queryFn: () =>
      db.entities.ActivityLog.filter(
        { user_id: String(user.id) },
        '-created_date',
        20
      ),
    enabled: Boolean(user?.id),
  });

  useMetaTags({
    title: `${getDisplayName(user, 'Dashboard')} - EMZI Nexus Brain`,
    description: `${notifications.filter((n) => !n.is_read).length} unread notifications`,
  });

  const refreshUser = async () => {
    await queryClient.refetchQueries({ queryKey: ['current-user'] });
  };

  const markRead = async (notif) => {
    await db.entities.Notification.update(notif.id, {
      is_read: true,
      read_at: new Date().toISOString(),
    });
    queryClient.invalidateQueries({ queryKey: ['notifications-dash'] });
  };

  return (
    <div className="space-y-6">
      <ProfileDashboardHero user={user} onUserUpdated={refreshUser} />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="grid grid-cols-1 xl:grid-cols-12 gap-6"
      >
        <div className="max-xl:contents xl:col-span-3 xl:flex xl:flex-col xl:gap-6">
          <div className="order-1 xl:order-none">
            <ProfileAboutCard user={user} />
          </div>
          <div className="order-6 xl:order-none">
            <RecentNotificationsWidget notifications={notifications} onMarkRead={markRead} />
          </div>
        </div>

        <div className="max-xl:contents xl:col-span-6 xl:flex xl:flex-col xl:gap-6">
          <div className="order-3 xl:order-none">
            <div className="bg-card rounded-2xl border border-border overflow-hidden">
              <WeeklyCalendarWidget embedded />
            </div>
          </div>
          <div className="order-2 xl:order-none">
            <CompanyFeedWidget />
          </div>
          <div className="order-4 xl:order-none">
            <ProfileRecentApplicationsWidget applications={systems} activities={activities} />
          </div>
        </div>

        <div className="max-xl:contents xl:col-span-3 xl:flex xl:flex-col xl:gap-6">
          <div className="order-3 xl:order-none">
            <TodaysCelebrationsWidget />
          </div>
          <div className="order-7 xl:order-none">
            <SystemHealthWidget systems={systems} />
          </div>
        </div>
      </motion.div>
    </div>
  );
}
