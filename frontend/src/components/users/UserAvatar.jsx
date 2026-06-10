import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toAbsoluteUrl } from '@/lib/media';
import { cn } from '@/lib/utils';

export default function UserAvatar({ user, className, fallbackClassName }) {
  const displayName = user?.full_name || user?.email || '';
  const initial = displayName?.[0]?.toUpperCase() || '?';

  return (
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
  );
}
