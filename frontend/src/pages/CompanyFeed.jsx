import React, { useEffect, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Loader2, Newspaper } from 'lucide-react';
import db from '@/api/base44Client';
import { FeedComposer, FeedItem } from '@/components/feed/FeedItems';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { useMetaTags } from '@/hooks/useMetaTags';
import { feedPostElementId, parseFeedFocusParams } from '@/lib/feedLinks';
import { motion } from 'framer-motion';

export default function CompanyFeed() {
  const [searchParams, setSearchParams] = useSearchParams();
  const focusTarget = useMemo(() => parseFeedFocusParams(searchParams), [searchParams]);
  const lastFocusedKeyRef = useRef(null);

  useMetaTags({
    title: 'Company Feed - EMZI Nexus Brain',
    description: 'Announcements and team updates across your organization',
  });

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['company-feed', focusTarget?.postId ?? null],
    queryFn: () => db.feed.list({
      limit: 30,
      ...(focusTarget?.postId ? { focusPost: focusTarget.postId } : {}),
    }),
    staleTime: 20_000,
  });

  const items = Array.isArray(data?.items) ? data.items : [];

  useEffect(() => {
    if (!focusTarget?.postId || isLoading) {
      return;
    }

    const focusKey = `${focusTarget.postId}:${focusTarget.expandComments ? '1' : '0'}`;
    if (lastFocusedKeyRef.current === focusKey) {
      return;
    }

    const element = document.getElementById(feedPostElementId(focusTarget.postId));
    if (!element) {
      return;
    }

    lastFocusedKeyRef.current = focusKey;

    window.requestAnimationFrame(() => {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element.classList.add('ring-2', 'ring-primary/40', 'ring-offset-2', 'ring-offset-background');

      window.setTimeout(() => {
        element.classList.remove('ring-2', 'ring-primary/40', 'ring-offset-2', 'ring-offset-background');
      }, 2400);
    });

    if (searchParams.get('post') || searchParams.get('comments')) {
      const next = new URLSearchParams(searchParams);
      next.delete('post');
      next.delete('comments');
      setSearchParams(next, { replace: true });
      lastFocusedKeyRef.current = null;
    }
  }, [focusTarget, isLoading, items, searchParams, setSearchParams]);

  return (
    <div className="mx-auto max-w-3xl space-y-4 sm:space-y-6">
      <PageHeader
        icon={Newspaper}
        title="Company Feed"
        description="Announcements from leadership and updates shared by your colleagues."
        meta={isFetching ? 'Refreshing...' : `${items.length} items`}
      />

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
          <EmptyState
            icon={Newspaper}
            title="The feed is quiet right now"
            description="Share the first update with your team using the composer above."
          />
        ) : (
          items.map((item) => (
            <FeedItem
              key={`${item.type}-${item.id}`}
              item={item}
              initialExpanded={
                item.type === 'post'
                && focusTarget?.expandComments
                && String(item.id) === String(focusTarget.postId)
              }
            />
          ))
        )}
      </motion.div>
    </div>
  );
}
