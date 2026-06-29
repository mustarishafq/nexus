import db from '@/api/apiClient';
import React from 'react';

import ActionItemsWidget from '@/components/dashboard/ActionItemsWidget';
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
import { useQuery } from '@tanstack/react-query';

export default function Dashboard() {
  const { user, checkUserAuth } = useAuth();

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
    description: 'Your EMZI Nexus Brain dashboard',
  });

  const refreshUser = async () => {
    await checkUserAuth();
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
        {/* Mobile order: about (collapsed) → celebrations → todos → calendar → feed → apps → health */}
        <div className="max-xl:contents xl:col-span-3 xl:flex xl:flex-col xl:gap-6">
          <div className="max-xl:order-1 xl:order-none">
            <ProfileAboutCard user={user} compact defaultCollapsed isOwnProfile />
          </div>
        </div>

        <div className="max-xl:contents xl:col-span-6 xl:flex xl:flex-col xl:gap-6">
          <div className="max-xl:order-4 xl:order-none">
            <div className="bg-card rounded-2xl border border-border overflow-hidden">
              <WeeklyCalendarWidget embedded />
            </div>
          </div>
          <div className="max-xl:order-5 xl:order-none">
            <CompanyFeedWidget />
          </div>
          <div className="max-xl:order-6 xl:order-none">
            <ProfileRecentApplicationsWidget applications={systems} activities={activities} />
          </div>
        </div>

        <div className="max-xl:contents xl:col-span-3 xl:flex xl:flex-col xl:gap-6">
          <div className="max-xl:order-2 xl:order-none">
            <TodaysCelebrationsWidget />
          </div>
          <div className="max-xl:order-3 xl:order-none">
            <ActionItemsWidget />
          </div>
          <div className="max-xl:order-7 xl:order-none">
            <SystemHealthWidget systems={systems} />
          </div>
        </div>
      </motion.div>
    </div>
  );
}
