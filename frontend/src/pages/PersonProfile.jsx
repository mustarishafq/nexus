import React from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, MessageCircle } from 'lucide-react';
import db from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useMetaTags } from '@/hooks/useMetaTags';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import ProfileDashboardHero from '@/components/dashboard/ProfileDashboardHero';
import ProfileAboutCard from '@/components/dashboard/ProfileAboutCard';
import ProfileStaffDetails from '@/components/profile/ProfileStaffDetails';
import { useGoBack } from '@/hooks/useGoBack';
import { getDisplayName } from '@/lib/profile';

export default function PersonProfile() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const goBack = useGoBack('/people');
  const { user: authUser } = useAuth();
  const isOwnProfile = authUser?.id && String(authUser.id) === String(userId);

  if (isOwnProfile) {
    return <Navigate to="/profile" replace />;
  }

  const { data, isLoading, isError } = useQuery({
    queryKey: ['user-profile', userId],
    queryFn: () => db.getUserProfile(userId),
    enabled: Boolean(userId),
    retry: false,
  });

  const user = data?.user;

  useMetaTags({
    title: user ? `${getDisplayName(user)} - People` : 'Colleague Profile',
    description: user?.bio || user?.department || 'View colleague profile on EMZI Nexus Brain',
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
        <p className="text-muted-foreground">This profile could not be loaded.</p>
        <Button variant="outline" onClick={goBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" size="sm" className="h-8 px-2" onClick={goBack}>
          <ArrowLeft className="mr-2 h-3.5 w-3.5" />
          Back
        </Button>
        <Button
          type="button"
          size="sm"
          className="h-8"
          onClick={async () => {
            try {
              const payload = await db.messages.startConversation(user.id);
              if (payload?.conversation?.id) {
                navigate(`/messages/${payload.conversation.id}`);
                return;
              }
            } catch {
              // Fall through to compose view.
            }
            navigate(`/messages/new/${user.id}`);
          }}
        >
          <MessageCircle className="mr-2 h-3.5 w-3.5" />
          Message
        </Button>
      </div>

      <ProfileDashboardHero user={user} readOnly />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-1 gap-6 xl:grid-cols-12"
      >
        <div className="xl:col-span-5">
          <ProfileAboutCard user={user} showCompleteLink={false} />
        </div>

        <div className="xl:col-span-7 space-y-4">
          <ProfileStaffDetails user={user} />
        </div>
      </motion.div>
    </div>
  );
}
