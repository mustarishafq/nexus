import React from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, MessageCircle, Users } from 'lucide-react';
import db from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useMetaTags } from '@/hooks/useMetaTags';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import ProfileDashboardHero from '@/components/dashboard/ProfileDashboardHero';
import ProfileAboutCard from '@/components/dashboard/ProfileAboutCard';
import { formatTenure } from '@/lib/profile';
import { toast } from 'sonner';

export default function PersonProfile() {
  const { userId } = useParams();
  const navigate = useNavigate();
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
  const tenure = formatTenure(user?.joined_at);

  const startConversation = useMutation({
    mutationFn: () => db.messages.startConversation(user.id),
    onSuccess: (payload) => {
      navigate(`/messages/${payload.conversation.id}`);
    },
    onError: (error) => {
      toast.error(error?.message || 'Could not start conversation.');
    },
  });

  useMetaTags({
    title: user?.full_name ? `${user.full_name} - People` : 'Colleague Profile',
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
        <Button asChild variant="outline">
          <Link to="/people">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to People
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm" className="h-8 px-2">
          <Link to="/people">
            <ArrowLeft className="mr-2 h-3.5 w-3.5" />
            People
          </Link>
        </Button>
        <Button
          type="button"
          size="sm"
          className="h-8"
          disabled={startConversation.isPending}
          onClick={() => startConversation.mutate()}
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
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-3">
              <Users className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">At a glance</h2>
            </div>
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {user.department ? (
                <div>
                  <dt className="text-xs text-muted-foreground">Department</dt>
                  <dd className="text-sm font-medium mt-0.5">{user.department}</dd>
                </div>
              ) : null}
              {tenure ? (
                <div>
                  <dt className="text-xs text-muted-foreground">Tenure</dt>
                  <dd className="text-sm font-medium mt-0.5 capitalize">{tenure} with the team</dd>
                </div>
              ) : null}
              {user.email ? (
                <div>
                  <dt className="text-xs text-muted-foreground">Email</dt>
                  <dd className="text-sm font-medium mt-0.5 break-all">{user.email}</dd>
                </div>
              ) : null}
            </dl>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
