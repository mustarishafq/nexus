import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import AvatarStarBadge from '@/components/gamification/AvatarStarBadge';
import { useIsUserOnline } from '@/components/presence/UserPresenceGate';
import { levelProgress, starsFromLevel } from '@/lib/gamification';
import { getCoverCropBackgroundStyle, toAbsoluteUrl } from '@/lib/media';
import { getDisplayName } from '@/lib/profile';
import { cn } from '@/lib/utils';

function resolveStars(user) {
  if (typeof user?.stars === 'number') return Math.max(0, user.stars);
  if (typeof user?.level === 'number') return starsFromLevel(user.level);
  if (typeof user?.exp_total === 'number') return levelProgress(user.exp_total).stars;
  if (typeof user?.exp === 'number') return levelProgress(user.exp).stars;
  return 0;
}

export default function UserAvatar({
  user,
  className,
  fallbackClassName,
  showOnlineStatus = true,
  showStars = true,
  starSize = 'sm',
}) {
  const displayName = getDisplayName(user, '');
  const initial = displayName?.[0]?.toUpperCase() || '?';
  const presenceOnline = useIsUserOnline(user?.id);
  const isOnline = user?.is_online ?? presenceOnline;
  const avatarUrl = toAbsoluteUrl(user?.profile_picture);
  const crop = user?.profile_picture_crop;
  const stars = showStars ? resolveStars(user) : 0;

  return (
    <div className="relative inline-flex h-fit shrink-0 self-start">
      <Avatar className={cn('relative h-10 w-10 shrink-0 overflow-hidden', className)}>
        {avatarUrl ? (
          <span
            role="img"
            aria-label={displayName}
            className="absolute inset-0 overflow-hidden rounded-[inherit]"
            style={getCoverCropBackgroundStyle(avatarUrl, crop, { fullImageFit: 'cover' })}
          />
        ) : (
          <AvatarFallback
            className={cn(
              'bg-primary/10 text-sm font-semibold text-primary',
              fallbackClassName
            )}
          >
            {initial}
          </AvatarFallback>
        )}
      </Avatar>
      {showStars && stars > 0 ? <AvatarStarBadge stars={stars} size={starSize} /> : null}
      {showOnlineStatus && isOnline ? (
        <span
          className={cn(
            'absolute z-[11] block h-2.5 w-2.5 rounded-full border-2 border-background bg-success',
            stars > 0 ? 'right-0 top-0' : 'bottom-0 right-0 h-3 w-3'
          )}
          aria-label="Online"
          title="Online"
        />
      ) : null}
    </div>
  );
}
