import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Newspaper } from 'lucide-react';
import db from '@/api/apiClient';
import { FeedComposer, FeedItem } from '@/components/feed/FeedItems';
import { EmptyState } from '@/components/ui/empty-state';

export default function ProfileUserPosts({ userId, showComposer = false }) {
  const { data, isLoading } = useQuery({
    queryKey: ['user-feed', userId],
    queryFn: () => db.feed.list({ authorUserId: userId, limit: 100 }),
    enabled: Boolean(userId),
    staleTime: 30_000,
  });

  const items = Array.isArray(data?.items) ? data.items : [];

  return (
    <div className="space-y-3 sm:space-y-4">
      {showComposer ? <FeedComposer /> : null}

      {isLoading ? (
        <div className="flex min-h-[20vh] items-center justify-center rounded-lg border border-border/40 bg-card py-10">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <div className="overflow-hidden rounded-lg border border-border/40 bg-card">
          <EmptyState
            icon={Newspaper}
            title={showComposer ? 'No posts yet' : 'No posts from this person yet'}
            description={
              showComposer
                ? 'Share an update with your team using the composer above.'
                : 'When they share updates on the company feed, they will show up here.'
            }
          />
        </div>
      ) : (
        <div className="space-y-2.5 sm:space-y-3">
          {items.map((item) => (
            <FeedItem key={`${item.type}-${item.id}`} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
