import React, { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { Eye, Loader2, Radio } from 'lucide-react';
import { Link } from 'react-router-dom';
import db from '@/api/apiClient';
import UserAvatar from '@/components/users/UserAvatar';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { getDisplayName } from '@/lib/profile';
import { cn } from '@/lib/utils';

function InsightUserList({ items, emptyLabel, timeKey, isLoading, isFetching, isError, onRetry }) {
  if (isLoading || isFetching) {
    return (
      <div className="flex items-center gap-2 px-2 py-3 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Loading...
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-2 px-2 py-3">
        <p className="text-xs text-destructive">Could not load list.</p>
        <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={onRetry}>
          Retry
        </Button>
      </div>
    );
  }

  if (!items.length) {
    return <p className="px-2 py-3 text-xs text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <ul className="space-y-1.5">
      {items.map((entry) => {
        const user = entry.user;
        const at = entry[timeKey];
        if (!user?.id) return null;

        return (
          <li key={user.id}>
            <Link
              to={`/people/${user.id}`}
              className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted/60"
            >
              <UserAvatar user={user} className="h-7 w-7 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-foreground">{getDisplayName(user)}</p>
                {user.department ? (
                  <p className="truncate text-[10px] text-muted-foreground">{user.department}</p>
                ) : null}
              </div>
              {at ? (
                <span className="shrink-0 whitespace-nowrap text-[10px] text-muted-foreground">
                  {formatDistanceToNow(new Date(at), { addSuffix: true })}
                </span>
              ) : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function InsightPopover({
  postId,
  count,
  label,
  title,
  subtitle,
  emptyLabel,
  icon: Icon,
  queryKey,
  queryFn,
  listKey,
  timeKey,
  canViewInsights,
  className,
}) {
  const { data, isLoading, isFetching, refetch, isError } = useQuery({
    queryKey: [queryKey, postId],
    queryFn,
    enabled: false,
    staleTime: 30_000,
  });

  const items = Array.isArray(data?.[listKey]) ? data[listKey] : [];
  const countLabel = (
    <>
      <span>{label}</span>
      <span className="tabular-nums">{Number(count).toLocaleString()}</span>
    </>
  );

  const triggerClassName = cn(
    'inline-flex items-center gap-1 whitespace-nowrap text-xs text-muted-foreground',
    canViewInsights && 'transition-colors hover:text-foreground',
    className
  );

  if (!canViewInsights) {
    return (
      <span className={triggerClassName} title={title}>
        <Icon className="h-3.5 w-3.5 opacity-70" />
        {countLabel}
      </span>
    );
  }

  return (
    <Popover
      onOpenChange={(open) => {
        if (open) refetch();
      }}
    >
      <PopoverTrigger asChild>
        <button type="button" className={triggerClassName} title={title}>
          <Icon className="h-3.5 w-3.5 opacity-70" />
          {countLabel}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(20rem,calc(100vw-2rem))] p-0">
        <div className="border-b border-border/60 px-3 py-2">
          <p className="text-xs font-medium">{title}</p>
          <p className="text-[11px] text-muted-foreground">{subtitle}</p>
        </div>
        <div className="max-h-72 overflow-y-auto p-2">
          <InsightUserList
            items={items}
            emptyLabel={emptyLabel}
            timeKey={timeKey}
            isLoading={isLoading}
            isFetching={isFetching}
            isError={isError}
            onRetry={() => refetch()}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function PostInsights({ item, className }) {
  const canViewInsights = Boolean(item?.can_view_insights);
  const seenCount = Number(item?.seen_count) || 0;
  const reachCount = Number(item?.reach_count) || 0;

  return (
    <div className={cn('inline-flex flex-wrap items-center gap-x-2 gap-y-1', className)}>
      <InsightPopover
        postId={item.id}
        count={seenCount}
        label="Seen"
        title="Seen by"
        subtitle="People who scrolled this post into view"
        emptyLabel="No one has seen this post yet."
        icon={Eye}
        queryKey="post-seen"
        queryFn={() => db.feed.listPostSeen(item.id)}
        listKey="views"
        timeKey="seen_at"
        canViewInsights={canViewInsights}
      />
      <span className="text-[10px] leading-none text-muted-foreground/40" aria-hidden>·</span>
      <InsightPopover
        postId={item.id}
        count={reachCount}
        label="Reach"
        title="Reached"
        subtitle="Successful web push deliveries"
        emptyLabel="No successful push deliveries yet."
        icon={Radio}
        queryKey="post-reaches"
        queryFn={() => db.feed.listPostReaches(item.id)}
        listKey="reaches"
        timeKey="reached_at"
        canViewInsights={canViewInsights}
      />
    </div>
  );
}

const markedSeenSession = new Set();
const pendingSeenIds = new Set();
let flushTimer = null;

function flushPendingSeen() {
  flushTimer = null;
  const ids = Array.from(pendingSeenIds);
  pendingSeenIds.clear();
  if (ids.length === 0) return;

  // Keep mark-seen out of the React Query cache while scrolling.
  // Updating every post forced the feed page to re-render and made the
  // composer/title flash until layout settled. Session set is enough to
  // avoid duplicate API calls; counts refresh on the next natural fetch.
  db.feed.markPostsSeen(ids).catch(() => {
    ids.forEach((id) => markedSeenSession.delete(id));
  });
}

function queueMarkSeen(postId) {
  const id = Number(postId);
  if (!id || markedSeenSession.has(id) || pendingSeenIds.has(id)) {
    return;
  }

  pendingSeenIds.add(id);
  if (flushTimer) return;
  flushTimer = window.setTimeout(flushPendingSeen, 400);
}

/**
 * Marks an approved post as seen once it enters the viewport.
 * Skips the author and pending posts.
 */
export function useMarkPostSeen({ postId, enabled, articleRef }) {
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  useEffect(() => {
    const node = articleRef?.current;
    if (!node || !postId || !enabled) {
      return undefined;
    }

    if (markedSeenSession.has(Number(postId))) {
      return undefined;
    }

    if (typeof IntersectionObserver === 'undefined') {
      queueMarkSeen(postId);
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting || !enabledRef.current) {
          return;
        }

        queueMarkSeen(postId);
        observer.disconnect();
      },
      { threshold: 0.5 }
    );

    observer.observe(node);

    return () => observer.disconnect();
  }, [articleRef, postId, enabled]);
}

export default PostInsights;
