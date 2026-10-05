import React from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { EyeOff, Images } from 'lucide-react';
import UserAvatar from '@/components/users/UserAvatar';
import { feedPostPath } from '@/lib/feedLinks';
import { getDisplayName } from '@/lib/profile';
import { cn } from '@/lib/utils';

/** Compact preview of a feed post shared in a direct message. */
export default function SharedPostCard({ post, className }) {
  if (!post?.is_available) {
    return (
      <div
        className={cn(
          'flex items-center gap-2 rounded-xl border border-border/70 bg-background px-3 py-2.5 text-xs text-muted-foreground',
          className
        )}
      >
        <EyeOff className="h-3.5 w-3.5 shrink-0" />
        This post is no longer available.
      </div>
    );
  }

  const extraImages = Math.max(0, (post.image_count || 0) - 1);

  return (
    <Link
      to={post.path || feedPostPath(post.id)}
      className={cn(
        'block overflow-hidden rounded-xl border border-border/70 bg-background text-foreground transition-colors hover:bg-muted/40',
        className
      )}
    >
      {post.image_url ? (
        <div className="relative aspect-[16/9] w-full bg-muted">
          <img src={post.image_url} alt="" loading="lazy" className="h-full w-full object-cover" />
          {extraImages > 0 ? (
            <span className="absolute bottom-1.5 right-1.5 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white">
              <Images className="h-3 w-3" />+{extraImages}
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-1.5 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <UserAvatar user={post.author} className="h-6 w-6" fallbackClassName="text-[9px]" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold">{getDisplayName(post.author)}</p>
            {post.created_date ? (
              <p className="text-[10px] text-muted-foreground">
                {formatDistanceToNow(new Date(post.created_date), { addSuffix: true })}
              </p>
            ) : null}
          </div>
        </div>
        {post.excerpt ? (
          <p className="line-clamp-3 break-words text-xs leading-relaxed">{post.excerpt}</p>
        ) : !post.image_url ? (
          <p className="text-xs text-muted-foreground">Shared a post</p>
        ) : null}
        <p className="text-[11px] font-medium text-primary">View post</p>
      </div>
    </Link>
  );
}
