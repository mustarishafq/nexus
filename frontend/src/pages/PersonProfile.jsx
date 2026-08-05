import React, { useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, MessageCircle, Newspaper, Pencil, User } from 'lucide-react';
import db from '@/api/apiClient';
import { useAuth } from '@/lib/AuthContext';
import { useMetaTags } from '@/hooks/useMetaTags';
import { useIsXlUp } from '@/hooks/use-mobile';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ProfileDashboardHero from '@/components/dashboard/ProfileDashboardHero';
import ProfileAboutCard from '@/components/dashboard/ProfileAboutCard';
import ProfileStaffDetails from '@/components/profile/ProfileStaffDetails';
import ProfileHrDetailsView from '@/components/profile/ProfileHrDetailsView';
import ProfileUserPosts from '@/components/profile/ProfileUserPosts';
import { useGoBack } from '@/hooks/useGoBack';
import { getDisplayName } from '@/lib/profile';
import { canManageUsers } from '@/lib/roles';

export default function PersonProfile() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const goBack = useGoBack('/people');
  const { user: authUser } = useAuth();
  const isXlUp = useIsXlUp();
  const [mobileTab, setMobileTab] = useState('posts');
  const isOwnProfile = Boolean(authUser?.id && String(authUser.id) === String(userId));
  const canViewHrProfiling = canManageUsers(authUser);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['user-profile', userId],
    queryFn: () => db.getUserProfile(userId),
    enabled: Boolean(userId) && !isOwnProfile,
    retry: false,
  });

  const user = data?.user;

  useMetaTags({
    title: user ? `${getDisplayName(user)} - People` : 'Colleague Profile',
    description: user?.bio || user?.department || 'View colleague profile on EMZI Nexus Brain',
  });

  if (isOwnProfile) {
    return <Navigate to="/profile" replace />;
  }

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

  const profileDetails = (
    <div className="space-y-4">
      <ProfileAboutCard user={user} showCompleteLink={false} />
      <ProfileStaffDetails user={user} />
      {canViewHrProfiling ? <ProfileHrDetailsView user={user} /> : null}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" size="sm" className="h-8 px-2" onClick={goBack}>
          <ArrowLeft className="mr-2 h-3.5 w-3.5" />
          Back
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          {canViewHrProfiling ? (
            <Button type="button" size="sm" variant="outline" className="h-8" asChild>
              <Link to={`/admin/users?q=${encodeURIComponent(user.email || user.full_name || '')}`}>
                <Pencil className="mr-2 h-3.5 w-3.5" />
                Edit in Users
              </Link>
            </Button>
          ) : null}
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
      </div>

      <ProfileDashboardHero user={user} readOnly />

      {isXlUp ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-12 items-start gap-6"
        >
          <aside className="col-span-3 space-y-4">
            <ProfileAboutCard user={user} showCompleteLink={false} />
          </aside>
          <div className="col-span-6 min-w-0">
            <ProfileUserPosts userId={user.id} />
          </div>
          <aside className="col-span-3 space-y-4">
            <ProfileStaffDetails user={user} />
            {canViewHrProfiling ? <ProfileHrDetailsView user={user} /> : null}
          </aside>
        </motion.div>
      ) : (
        <Tabs value={mobileTab} onValueChange={setMobileTab} className="w-full space-y-4">
          <TabsList className="grid h-auto w-full grid-cols-2 gap-1 rounded-xl p-1">
            <TabsTrigger value="posts" className="gap-1.5 px-2 py-2 text-xs sm:text-sm">
              <Newspaper className="h-3.5 w-3.5" />
              Posts
            </TabsTrigger>
            <TabsTrigger value="about" className="gap-1.5 px-2 py-2 text-xs sm:text-sm">
              <User className="h-3.5 w-3.5" />
              About
            </TabsTrigger>
          </TabsList>

          <TabsContent value="posts" className="mt-0">
            <ProfileUserPosts userId={user.id} />
          </TabsContent>

          <TabsContent value="about" className="mt-0">
            {profileDetails}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
