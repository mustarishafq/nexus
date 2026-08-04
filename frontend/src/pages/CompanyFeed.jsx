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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useMetaTags } from '@/hooks/useMetaTags';
import { feedPostElementId, parseFeedFocusParams } from '@/lib/feedLinks';
import { cn } from '@/lib/utils';

const XL_BREAKPOINT = 1280;
/** Hysteresis so scrollbar width can't flip desktop/mobile mid-scroll. */
const XL_EXIT_BREAKPOINT = XL_BREAKPOINT - 32;

function useIsXlUp() {
  const [isXlUp, setIsXlUp] = useState(() => (
    typeof window !== 'undefined'
      ? window.innerWidth >= XL_BREAKPOINT
      : false
  ));

  useEffect(() => {
    const sync = () => {
      const width = window.innerWidth;
      setIsXlUp((current) => {
        if (current) {
          return width >= XL_EXIT_BREAKPOINT;
        }
        return width >= XL_BREAKPOINT;
      });
    };

    sync();
    window.addEventListener('resize', sync);
    return () => window.removeEventListener('resize', sync);
  }, []);

  return isXlUp;
}

function findVisibleFeedPostElement(postId) {
  const id = feedPostElementId(postId);
  const nodes = document.querySelectorAll(`[id="${CSS.escape(id)}"]`);
  for (const node of nodes) {
    if (node.getClientRects().length > 0) {
      return node;
    }
  }
  return null;
}

function FeedList({ items, isLoading, focusTarget }) {
  if (isLoading) {
    return (
      <div className="flex min-h-[20vh] items-center justify-center rounded-lg border border-border/40 bg-card py-10">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="overflow-hidden rounded-lg border border-border/40 bg-card">
        <EmptyState
          icon={Newspaper}
          title="The feed is quiet right now"
          description="Share the first update with your team using the composer above."
        />
      </div>
    );
  }

  return (
    <div className="space-y-2.5 sm:space-y-3">
      {items.map((item) => (
        <FeedItem
          key={`${item.type}-${item.id}`}
          item={item}
          initialExpanded={
            item.type === 'post'
            && focusTarget?.expandComments
            && String(item.id) === String(focusTarget.postId)
          }
        />
      ))}
    </div>
  );
}

export default function CompanyFeed() {
  const [searchParams, setSearchParams] = useSearchParams();
  const focusTarget = useMemo(() => parseFeedFocusParams(searchParams), [searchParams]);
  const lastFocusedKeyRef = useRef(null);
  const [mobileTab, setMobileTab] = useState('feed');
  const isXlUp = useIsXlUp();
  const showFeedColumn = isXlUp || mobileTab === 'feed';

  useMetaTags({
    title: 'Company Feed - EMZI Nexus Brain',
    description: 'Announcements and team updates across your organization',
  });

  const { data, isLoading, isFetched } = useQuery({
    queryKey: ['company-feed', focusTarget?.postId ?? null],
    queryFn: () => db.feed.list({
      limit: 30,
      ...(focusTarget?.postId ? { focusPost: focusTarget.postId } : {}),
    }),
    staleTime: 20_000,
  });

  const items = Array.isArray(data?.items) ? data.items : [];
  const headerMeta = isLoading && !isFetched
    ? 'Loading...'
    : `${items.length} items`;

  useEffect(() => {
    if (focusTarget?.postId) {
      setMobileTab('feed');
    }
  }, [focusTarget?.postId]);

  useEffect(() => {
    if (!focusTarget?.postId || isLoading || !showFeedColumn) {
      return;
    }

    const focusKey = `${focusTarget.postId}:${focusTarget.expandComments ? '1' : '0'}`;
    if (lastFocusedKeyRef.current === focusKey) {
      return;
    }

    const element = findVisibleFeedPostElement(focusTarget.postId);
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
  }, [focusTarget, isLoading, isXlUp, items, mobileTab, searchParams, setSearchParams, showFeedColumn]);

  return (
    <div className="space-y-3 sm:space-y-6">
      <PageHeader
        icon={Newspaper}
        title="Company Feed"
        description="Announcements from leadership and updates shared by your colleagues."
        meta={headerMeta}
        className="relative z-[1] gap-2 sm:gap-4"
      />

      {!isXlUp ? (
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
        </Tabs>
      ) : null}

      {/*
        One stable feed column tree (keyed) so the composer/editor never remounts
        when the scrollbar toggles desktop ↔ mobile width.
      */}
      <div
        className={cn(
          showFeedColumn ? 'grid items-start gap-6' : 'hidden',
          isXlUp ? 'grid-cols-12' : 'grid-cols-1'
        )}
      >
        {isXlUp ? (
          <aside className="col-span-3 self-start">
            <div className="sticky top-24 flex max-h-[calc(100dvh-6.5rem)] flex-col gap-6 overflow-y-auto overscroll-contain">
              <ActiveDiscussionsWidget />
            </div>
          </aside>
        ) : null}

        <div
          key="feed-main-column"
          className={cn(
            'relative z-[1] min-w-0 space-y-2.5 sm:space-y-3',
            isXlUp ? 'col-span-6' : 'col-span-1'
          )}
        >
          <FeedComposer />
          <FeedList items={items} isLoading={isLoading} focusTarget={focusTarget} />
        </div>

        {isXlUp ? (
          <aside className="col-span-3 self-start">
            <div className="sticky top-24 flex max-h-[calc(100dvh-6.5rem)] flex-col gap-6 overflow-y-auto overscroll-contain">
              <TodaysCelebrationsWidget />
            </div>
          </aside>
        ) : null}
      </div>

      {!isXlUp && mobileTab === 'discussions' ? (
        <ActiveDiscussionsWidget />
      ) : null}
      {!isXlUp && mobileTab === 'celebrations' ? (
        <TodaysCelebrationsWidget />
      ) : null}
    </div>
  );
}
