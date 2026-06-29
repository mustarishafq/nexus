import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useIsUserOnline } from '@/components/presence/UserPresenceGate';
import CoverPhotoUploader from '@/components/profile/CoverPhotoUploader';
import ProfilePictureUploader from '@/components/profile/ProfilePictureUploader';
import { COVER_PHOTO_DISPLAY_ASPECT, toAbsoluteUrl } from '@/lib/media';
import { getDisplayName } from '@/lib/profile';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

const DEFAULT_COVER = '/icons/cover-photo-new.png';

function CoverPhotoImage({ coverPicture, userReady }) {
  const [loaded, setLoaded] = useState(false);
  const coverUrl = userReady ? toAbsoluteUrl(coverPicture) || DEFAULT_COVER : null;

  useEffect(() => {
    setLoaded(false);
  }, [coverUrl]);

  return (
    <>
      <div
        className={cn(
          'absolute inset-0 bg-muted transition-opacity duration-300',
          loaded ? 'opacity-0' : 'opacity-100'
        )}
        aria-hidden
      />
      {coverUrl ? (
        <img
          src={coverUrl}
          alt=""
          onLoad={() => setLoaded(true)}
          onError={() => setLoaded(true)}
          className={cn(
            'absolute inset-0 h-full w-full object-cover object-center transition-opacity duration-300',
            loaded ? 'opacity-100' : 'opacity-0'
          )}
        />
      ) : null}
    </>
  );
}

export default function ProfileDashboardHero({ user, onUserUpdated, readOnly = false }) {
  const todayLabel = format(new Date(), 'EEEE, MMMM d');
  const userReady = user != null;
  const presenceOnline = useIsUserOnline(user?.id);
  const isOnline = user?.is_online ?? presenceOnline;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm"
    >
      <div className={cn('relative w-full group', COVER_PHOTO_DISPLAY_ASPECT)}>
        <CoverPhotoImage coverPicture={user?.cover_picture} userReady={userReady} />
        <div className="absolute inset-0 bg-gradient-to-t from-background/55 via-transparent to-transparent sm:from-background/75 sm:via-background/10" />
        <CoverPhotoUploader
          variant="overlay"
          coverPicture={user?.cover_picture}
          onUpdated={onUserUpdated}
          readOnly={readOnly}
        />
      </div>

      <div className="px-5 sm:px-6 pb-3 sm:pb-5 relative">
        <div className="flex flex-col items-center text-center sm:flex-row sm:items-end sm:text-left gap-1 sm:gap-5">
          <ProfilePictureUploader
            variant="overlay"
            profilePicture={user?.profile_picture}
            displayName={getDisplayName(user, '')}
            onUpdated={onUserUpdated}
            readOnly={readOnly}
            className="-mt-[5.5rem] sm:-mt-20 lg:-mt-[5.5rem] mx-auto sm:mx-0 self-center sm:self-start"
            avatarClassName="h-32 w-32 sm:h-36 sm:w-36 lg:h-40 lg:w-40 border-[5px]"
          />

          <div className="flex-1 min-w-0 w-full sm:w-auto sm:pb-1">
            <div className="flex flex-col items-center gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:justify-start sm:gap-2">
              <h1 className="text-lg sm:text-3xl font-bold tracking-tight leading-tight">
                {getDisplayName(user, 'Your Profile')}
              </h1>
              {user?.role === 'admin' ? (
                <Badge className="gap-1 shrink-0 h-5 text-[10px] sm:h-auto sm:text-xs">
                  <ShieldCheck className="w-3 h-3" />
                  Admin
                </Badge>
              ) : (
                <Badge variant="secondary" className="capitalize shrink-0 h-5 text-[10px] sm:h-auto sm:text-xs">
                  {user?.role || 'member'}
                </Badge>
              )}
              {readOnly && isOnline ? (
                <Badge className="gap-1 shrink-0 h-5 border-success/30 bg-success/10 text-[10px] text-success sm:h-auto sm:text-xs">
                  Online
                </Badge>
              ) : null}
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 sm:mt-1">
              {[user?.job_title, user?.department].filter(Boolean).join(' · ') || user?.email}
            </p>
            {user?.job_title && user?.email ? (
              <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">{user.email}</p>
            ) : null}
            <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1">{todayLabel}</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
