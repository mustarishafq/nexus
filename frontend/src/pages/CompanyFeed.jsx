import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Newspaper } from 'lucide-react';
import db from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { FeedComposer, FeedItem } from '@/components/feed/FeedItems';
import { useMetaTags } from '@/hooks/useMetaTags';
import { motion } from 'framer-motion';

export default function CompanyFeed() {
  useMetaTags({
    title: 'Company Feed - EMZI Nexus Brain',
    description: 'Announcements and team updates across your organization',
  });

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['company-feed'],
    queryFn: () => db.feed.list({ limit: 30 }),
    staleTime: 20_000,
  });

  const items = Array.isArray(data?.items) ? data.items : [];

  return (
    <div className="mx-auto max-w-3xl space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-2 sm:gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Newspaper className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Company Feed</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Announcements from leadership and updates shared by your colleagues.
          </p>
        </div>
        <p className="text-xs text-muted-foreground sm:text-sm">
          {isFetching ? 'Refreshing...' : `${items.length} items`}
        </p>
      </div>

      <FeedComposer />

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="overflow-hidden rounded-2xl border border-border bg-card"
      >
        {isLoading ? (
          <div className="flex min-h-[20vh] items-center justify-center py-10">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <div className="px-4 py-12 text-center sm:px-6 sm:py-16">
            <Newspaper className="mx-auto h-10 w-10 text-muted-foreground/60" />
            <p className="mt-4 text-sm font-medium">The feed is quiet right now</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Share the first update with your team using the composer above.
            </p>
          </div>
        ) : (
          items.map((item) => <FeedItem key={`${item.type}-${item.id}`} item={item} />)
        )}
      </motion.div>
    </div>
  );
}
