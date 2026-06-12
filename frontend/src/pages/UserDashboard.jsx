import db from '@/api/base44Client';
import React from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Eye } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { useMetaTags } from '@/hooks/useMetaTags';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import ProfileDashboardHero from '@/components/dashboard/ProfileDashboardHero';
import ProfileAboutCard from '@/components/dashboard/ProfileAboutCard';
import ProfileAnnouncementsWidget from '@/components/dashboard/ProfileAnnouncementsWidget';
import { useActiveBroadcasts } from '@/hooks/useActiveBroadcasts';
import ProfileRecentApplicationsWidget from '@/components/dashboard/ProfileRecentApplicationsWidget';
import TodaysCelebrationsWidget from '@/components/dashboard/TodaysCelebrationsWidget';
import WeeklyCalendarWidget from '@/components/dashboard/WeeklyCalendarWidget';
import SystemHealthWidget from '@/components/dashboard/SystemHealthWidget';

export default function UserDashboard() {
  const { userId } = useParams();
  const { user: authUser } = useAuth();

  if (authUser?.id && String(authUser.id) === String(userId)) {
    return <Navigate to="/" replace />;
  }

  const { data, isLoading, isError } = useQuery({
    queryKey: ['user-dashboard-preview', userId],
    queryFn: () => db.getUserDashboardPreview(userId),
    enabled: Boolean(userId),
    retry: false,
  });

  const user = data?.user;
  const activities = Array.isArray(data?.activities) ? data.activities : [];

  const { data: activeBroadcasts = [] } = useActiveBroadcasts();

  const { data: systems = [] } = useQuery({
    queryKey: ['applications'],
    queryFn: () => db.entities.Application.list('sort_order', 50),
  });

  useMetaTags({
    title: user?.full_name ? `${user.full_name}'s Dashboard` : 'User Dashboard',
    description: user?.full_name ? `Preview ${user.full_name}'s Nexus dashboard` : 'Preview user dashboard',
  });

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-slate-800" />
      </div>
    );
  }

  if (isError || !user) {
    return (
      <div className="space-y-4 py-16 text-center">
        <p className="text-muted-foreground">This user dashboard could not be loaded.</p>
        <Button asChild variant="outline">
          <Link to="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to my dashboard
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
        <div className="flex items-center gap-2 text-sm">
          <Eye className="h-4 w-4 text-primary" />
          <span>
            Previewing <span className="font-semibold">{user.full_name || 'user'}</span>&apos;s dashboard
          </span>
        </div>
        <Button asChild variant="outline" size="sm" className="h-8">
          <Link to="/">
            <ArrowLeft className="mr-2 h-3.5 w-3.5" />
            Back to my dashboard
          </Link>
        </Button>
      </div>

      <ProfileDashboardHero user={user} readOnly />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="grid grid-cols-1 xl:grid-cols-12 gap-6"
      >
        <div className="max-xl:contents xl:col-span-3 xl:flex xl:flex-col xl:gap-6">
          <div className="order-1 xl:order-none">
            <ProfileAboutCard user={user} showCompleteLink={false} />
          </div>
        </div>

        <div className="max-xl:contents xl:col-span-6 xl:flex xl:flex-col xl:gap-6">
          <div className="order-3 xl:order-none">
            <div className="bg-card rounded-2xl border border-border overflow-hidden">
              <WeeklyCalendarWidget embedded />
            </div>
          </div>
          <div className="order-2 xl:order-none">
            <ProfileAnnouncementsWidget broadcasts={activeBroadcasts} isAdmin={false} />
          </div>
          <div className="order-4 xl:order-none">
            <ProfileRecentApplicationsWidget
              applications={systems}
              activities={activities}
              readOnly
            />
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
