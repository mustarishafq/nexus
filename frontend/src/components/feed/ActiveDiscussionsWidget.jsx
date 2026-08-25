import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Loader2, MessageCircle, MessagesSquare, SmilePlus } from 'lucide-react';
import db from '@/api/apiClient';
import UserAvatar from '@/components/users/UserAvatar';
import { feedPostPath } from '@/lib/feedLinks';
import { getDisplayName } from '@/lib/profile';
import { stripHtml } from '@/lib/richText';
import { cn } from '@/lib/utils';

const DISPLAY_LIMIT = 5;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function previewText(body) {
  return stripHtml(body || '').replace(/\s+/g, ' ').trim();
}

function engagementScore(item) {
  return (Number(item.reactions_count) || 0) + (Number(item.comments_count) || 0);
}

function isWithinLastWeek(isoDate) {
  if (!isoDate) return false;
  const ts = Date.parse(isoDate);
  if (Number.isNaN(ts)) return false;
  return Date.now() - ts <= WEEK_MS;
}

function deriveActiveFromFeed(feedPayload) {
  const posts = (Array.isArray(feedPayload?.items) ? feedPayload.items : [])
    .filter((item) => item?.type === 'post' && !item.is_deleted);

  const thisWeek = posts.filter(
    (item) => isWithinLastWeek(item.created_date) && engagementScore(item) > 0
  );

  const pool = thisWeek.length > 0
    ? thisWeek
    : posts.filter((item) => engagementScore(item) > 0);

  return pool
    .sort((a, b) => {
      const scoreDiff = engagementScore(b) - engagementScore(a);
      if (scoreDiff !== 0) return scoreDiff;
      return Date.parse(b.created_date || 0) - Date.parse(a.created_date || 0);
    })
    .slice(0, DISPLAY_LIMIT);
}

async function loadActiveDiscussions() {
  try {
    return await db.feed.activeDiscussions({ limit: DISPLAY_LIMIT });
  } catch (error) {
    // Remote/older APIs may not expose /feed/active yet — fall back to ranking the main feed.
    if (error?.status && error.status !== 404 && error.status < 500) {
      throw error;
    }
    const feed = await db.feed.list({ limit: 30, excludeDeleted: true });
    return { items: deriveActiveFromFeed(feed) };
  }
}

export default function ActiveDiscussionsWidget() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['feed-active-discussions', DISPLAY_LIMIT],
    queryFn: loadActiveDiscussions,
    staleTime: 30_000,
  });

  const items = useMemo(
    () => (Array.isArray(data?.items) ? data.items : []),
    [data]
  );

  return (
    <div className="bg-card rounded-2xl border border-border">
      <div className="p-5 pb-3">
        <div className="flex items-center gap-2">
          <MessagesSquare className="h-4 w-4 shrink-0 text-primary" />
          <h3 className="text-sm font-semibold">Active discussions</h3>
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Most engaged this week
        </p>
      </div>

      <div className="px-2 pb-3">
        {isLoading ? (
          <div className="flex min-h-[8rem] items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : isError ? (
          <p className="px-3 py-8 text-center text-sm text-muted-foreground">
            Couldn&apos;t load discussions.
          </p>
        ) : items.length === 0 ? (
          <p className="px-3 py-8 text-center text-sm text-muted-foreground">
            No active discussions this week
          </p>
        ) : (
          <ul className="space-y-0.5">
            {items.map((item) => {
              const authorName = getDisplayName(item.author);
              const preview = previewText(item.body);
              const reactionsCount = Number(item.reactions_count) || 0;
              const commentsCount = Number(item.comments_count) || 0;

              return (
                <li key={item.id}>
                  <Link
                    to={feedPostPath(item.id)}
                    className={cn(
                      'flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors',
                      'hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                    )}
                  >
                    <UserAvatar user={item.author} className="h-8 w-8 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium leading-tight">
                        {authorName}
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-muted-foreground">
                        {preview || 'View post'}
                      </p>
                      <div className="mt-1.5 flex items-center gap-3 text-[11px] text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <SmilePlus className="h-3 w-3" />
                          {reactionsCount}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <MessageCircle className="h-3 w-3" />
                          {commentsCount}
                        </span>
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
