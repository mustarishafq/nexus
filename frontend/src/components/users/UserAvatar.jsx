import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useIsUserOnline } from '@/components/presence/UserPresenceGate';
import { toAbsoluteUrl } from '@/lib/media';
import { getDisplayName } from '@/lib/profile';
import { cn } from '@/lib/utils';

export default function UserAvatar({
  user,
  className,
  fallbackClassName,
  showOnlineStatus = true,
}) {
  const displayName = getDisplayName(user, '');
  const initial = displayName?.[0]?.toUpperCase() || '?';
  const presenceOnline = useIsUserOnline(user?.id);
  const isOnline = user?.is_online ?? presenceOnline;

  return (
    <div className="relative inline-flex shrink-0">
      <Avatar className={cn('h-10 w-10 shrink-0', className)}>
        <AvatarImage src={toAbsoluteUrl(user?.profile_picture)} alt={displayName} />
        <AvatarFallback
          className={cn(
            'bg-primary/10 text-sm font-semibold text-primary',
            fallbackClassName
          )}
        >
          {initial}
        </AvatarFallback>
      </Avatar>
      {showOnlineStatus && isOnline ? (
        <span
          className="absolute bottom-0 right-0 block h-3 w-3 rounded-full border-2 border-background bg-success"
          aria-label="Online"
          title="Online"
        />
      ) : null}
    </div>
  );
}
