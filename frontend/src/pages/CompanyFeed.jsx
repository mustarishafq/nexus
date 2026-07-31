import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Cake, Loader2, MessagesSquare, Newspaper } from 'lucide-react';
import db from '@/api/apiClient';
import TodaysCelebrationsWidget from '@/components/dashboard/TodaysCelebrationsWidget';
import ActiveDiscussionsWidget from '@/components/feed/ActiveDiscussionsWidget';
import { FeedComposer, FeedItem } from '@/components/feed/FeedItems';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useMetaTags } from '@/hooks/useMetaTags';
import { feedPostElementId, parseFeedFocusParams } from '@/lib/feedLinks';
import { motion } from 'framer-motion';

function FeedMain({ items, isLoading, focusTarget }) {
  return (
    <div className="space-y-3 sm:space-y-6">
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

export default function CompanyFeed() {
  const [searchParams, setSearchParams] = useSearchParams();
  const focusTarget = useMemo(() => parseFeedFocusParams(searchParams), [searchParams]);
  const lastFocusedKeyRef = useRef(null);
  const [mobileTab, setMobileTab] = useState('feed');

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
    if (focusTarget?.postId) {
      setMobileTab('feed');
    }
  }, [focusTarget?.postId]);

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
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
    <div className="space-y-3 sm:space-y-6">
      <PageHeader
        icon={Newspaper}
        title="Company Feed"
        description="Announcements from leadership and updates shared by your colleagues."
        meta={isFetching ? 'Refreshing...' : `${items.length} items`}
        className="gap-2 sm:gap-4"
      />

      {/* Mobile & tablet: tabbed sections */}
      <div className="xl:hidden">
        <Tabs value={mobileTab} onValueChange={setMobileTab} className="w-full">
          <TabsList className="grid h-auto w-full grid-cols-3 gap-1 rounded-xl p-1">
            <TabsTrigger value="feed" className="gap-1.5 px-2 py-2 text-xs sm:text-sm">
              <Newspaper className="hidden h-3.5 w-3.5 sm:block" />
              Feed
            </TabsTrigger>
            <TabsTrigger value="discussions" className="gap-1.5 px-2 py-2 text-xs sm:text-sm">
              <MessagesSquare className="hidden h-3.5 w-3.5 sm:block" />
              <span className="sm:hidden">Discussions</span>
              <span className="hidden sm:inline">Active discussions</span>
            </TabsTrigger>
            <TabsTrigger value="celebrations" className="gap-1.5 px-2 py-2 text-xs sm:text-sm">
              <Cake className="hidden h-3.5 w-3.5 sm:block" />
              Celebrations
            </TabsTrigger>
          </TabsList>

          <TabsContent value="feed" className="mt-4 focus-visible:ring-0">
            <FeedMain items={items} isLoading={isLoading} focusTarget={focusTarget} />
          </TabsContent>
          <TabsContent value="discussions" className="mt-4 focus-visible:ring-0">
            <ActiveDiscussionsWidget />
          </TabsContent>
          <TabsContent value="celebrations" className="mt-4 focus-visible:ring-0">
            <TodaysCelebrationsWidget />
          </TabsContent>
        </Tabs>
      </div>

      {/* Desktop xl+: three-column rails */}
      <div className="hidden gap-6 xl:grid xl:grid-cols-12 xl:items-start">
        <aside className="xl:col-span-3 xl:sticky xl:top-24 xl:flex xl:max-h-[calc(100dvh-6.5rem)] xl:flex-col xl:gap-6 xl:self-start xl:overflow-y-auto">
          <ActiveDiscussionsWidget />
        </aside>

        <div className="xl:col-span-6">
          <FeedMain items={items} isLoading={isLoading} focusTarget={focusTarget} />
        </div>

        <aside className="xl:col-span-3 xl:sticky xl:top-24 xl:flex xl:max-h-[calc(100dvh-6.5rem)] xl:flex-col xl:gap-6 xl:self-start xl:overflow-y-auto">
          <TodaysCelebrationsWidget />
        </aside>
      </div>
    </div>
  );
}
