import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUp, Cake, Loader2, MessagesSquare, Newspaper } from 'lucide-react';
import { toast } from 'sonner';
import db from '@/api/apiClient';
import TodaysCelebrationsWidget from '@/components/dashboard/TodaysCelebrationsWidget';
import ActiveDiscussionsWidget from '@/components/feed/ActiveDiscussionsWidget';
import { FeedComposer, FeedItem } from '@/components/feed/FeedItems';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useMetaTags } from '@/hooks/useMetaTags';
import { feedPostElementId, parseFeedFocusParams, scrollFeedPostIntoView } from '@/lib/feedLinks';
import { cn } from '@/lib/utils';

const FEED_PAGE_SIZE = 30;
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

function FeedLoadMoreSentinel({ enabled, onVisible, isLoading }) {
  const sentinelRef = useRef(null);
  const onVisibleRef = useRef(onVisible);

  useEffect(() => {
    onVisibleRef.current = onVisible;
  }, [onVisible]);

  useEffect(() => {
    if (!enabled) return undefined;

    const node = sentinelRef.current;
    if (!node) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          onVisibleRef.current?.();
        }
      },
      { root: null, rootMargin: '240px 0px', threshold: 0 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [enabled]);

  return (
    <div
      ref={sentinelRef}
      className="flex min-h-10 items-center justify-center py-3"
      aria-hidden={!isLoading}
    >
      {isLoading ? (
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      ) : null}
    </div>
  );
}

function FeedList({
  items,
  isLoading,
  focusTarget,
  reveal,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
}) {
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
      <motion.div
        className="space-y-2.5 sm:space-y-3"
        initial={reveal ? 'hidden' : false}
        animate="show"
        variants={{
          hidden: {},
          show: {
            transition: { staggerChildren: 0.045, delayChildren: 0.06 },
          },
        }}
      >
        {items.map((item) => (
          <motion.div
            key={`${item.type}-${item.id}`}
            variants={{
              hidden: { opacity: 0, y: 14 },
              show: {
                opacity: 1,
                y: 0,
                transition: { duration: 0.28, ease: [0.16, 1, 0.3, 1] },
              },
            }}
          >
            <FeedItem
              item={item}
              initialExpanded={
                item.type === 'post'
                && focusTarget?.expandComments
                && String(item.id) === String(focusTarget.postId)
              }
            />
          </motion.div>
        ))}
      </motion.div>

      <FeedLoadMoreSentinel
        enabled={Boolean(hasNextPage) && !isFetchingNextPage}
        onVisible={onLoadMore}
        isLoading={isFetchingNextPage}
      />
    </div>
  );
}

function FocusLoadingOverlay({ show }) {
  return (
    <AnimatePresence>
      {show ? (
        <motion.div
          key="focus-loading"
          className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 rounded-lg border border-border/40 bg-background/85 px-6 py-10 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
        >
          <motion.div
            className="flex h-12 w-12 items-center justify-center rounded-full border border-primary/20 bg-primary/10"
            initial={{ scale: 0.85 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          >
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </motion.div>
          <motion.div
            className="text-center"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08, duration: 0.28 }}
          >
            <p className="text-sm font-medium">Opening post</p>
            <p className="mt-1 text-xs text-muted-foreground">Finding it in the company feed…</p>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export default function CompanyFeed() {
  const [searchParams, setSearchParams] = useSearchParams();
  const focusTarget = useMemo(() => parseFeedFocusParams(searchParams), [searchParams]);
  const [pinnedFocus, setPinnedFocus] = useState(null);
  const [focusBootstrapping, setFocusBootstrapping] = useState(() => Boolean(focusTarget?.postId));
  const [feedReveal, setFeedReveal] = useState(() => !focusTarget?.postId);
  const lastFocusedKeyRef = useRef(null);
  const settleScrollRef = useRef(null);
  const [mobileTab, setMobileTab] = useState('feed');
  const isXlUp = useIsXlUp();
  const showFeedColumn = isXlUp || mobileTab === 'feed';

  // Keep the focused post pinned in the query even after ?post= is cleared from
  // the URL, so the feed doesn't refetch/reshuffle and jump mid-scroll.
  useEffect(() => {
    if (focusTarget?.postId) {
      lastFocusedKeyRef.current = null;
      setFocusBootstrapping(true);
      setFeedReveal(false);
      setPinnedFocus({
        postId: focusTarget.postId,
        expandComments: focusTarget.expandComments,
      });
    }
  }, [focusTarget?.expandComments, focusTarget?.postId]);

  const activeFocus = focusTarget ?? pinnedFocus;
  const isViewingFocusedPost = Boolean(pinnedFocus?.postId);

  useMetaTags({
    title: 'Company Feed - EMZI Nexus Brain',
    description: 'Announcements from leadership and updates shared by your colleagues.',
  });

  const {
    data,
    isLoading,
    isFetched,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['company-feed', activeFocus?.postId ?? null],
    queryFn: ({ pageParam }) => db.feed.list({
      limit: FEED_PAGE_SIZE,
      ...(pageParam ? { before: pageParam } : {}),
      ...(activeFocus?.postId && !pageParam ? { focusPost: activeFocus.postId } : {}),
    }),
    initialPageParam: null,
    getNextPageParam: (lastPage) => {
      if (!lastPage?.has_more || !lastPage?.next_before) return undefined;
      return lastPage.next_before;
    },
    staleTime: 20_000,
  });

  const items = useMemo(
    () => (data?.pages ?? []).flatMap((page) => (
      Array.isArray(page?.items) ? page.items : []
    )),
    [data?.pages]
  );
  const total = Number(data?.pages?.[0]?.total);
  const headerMeta = isLoading && !isFetched
    ? 'Loading...'
    : Number.isFinite(total) && total > 0
      ? `${items.length} of ${total}`
      : `${items.length} items`;

  const loadMore = () => {
    if (!hasNextPage || isFetchingNextPage) return;
    fetchNextPage();
  };

  const returnToLatestFeed = () => {
    settleScrollRef.current?.();
    settleScrollRef.current = null;
    lastFocusedKeyRef.current = null;
    setPinnedFocus(null);
    setFocusBootstrapping(false);
    setFeedReveal(true);
    setSearchParams((prev) => {
      if (!prev.get('post') && !prev.get('comments')) {
        return prev;
      }
      const next = new URLSearchParams(prev);
      next.delete('post');
      next.delete('comments');
      return next;
    }, { replace: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    if (activeFocus?.postId) {
      setMobileTab('feed');
    }
  }, [activeFocus?.postId]);

  useEffect(() => () => {
    settleScrollRef.current?.();
    settleScrollRef.current = null;
  }, []);

  useEffect(() => {
    if (!activeFocus?.postId || isLoading || !isFetched || !showFeedColumn) {
      return undefined;
    }

    const focusKey = `${activeFocus.postId}:${activeFocus.expandComments ? '1' : '0'}`;
    if (lastFocusedKeyRef.current === focusKey) {
      return undefined;
    }

    const focusId = String(activeFocus.postId);
    const focusedInItems = items.some(
      (item) => item?.type === 'post' && String(item.id) === focusId
    );

    if (!focusedInItems) {
      lastFocusedKeyRef.current = focusKey;
      setFocusBootstrapping(false);
      setFeedReveal(true);
      toast.error('That post could not be found in the feed.');
      setPinnedFocus(null);
      setSearchParams((prev) => {
        if (!prev.get('post') && !prev.get('comments')) {
          return prev;
        }
        const next = new URLSearchParams(prev);
        next.delete('post');
        next.delete('comments');
        return next;
      }, { replace: true });
      return undefined;
    }

    let cancelled = false;
    let attempts = 0;
    let rafId = 0;
    let retryTimer = 0;
    let highlightTimer = 0;
    let clearParamsTimer = 0;
    let revealTimer = 0;

    const clearFocusParams = () => {
      setSearchParams((prev) => {
        if (!prev.get('post') && !prev.get('comments')) {
          return prev;
        }
        const next = new URLSearchParams(prev);
        next.delete('post');
        next.delete('comments');
        return next;
      }, { replace: true });
    };

    const tryFocus = () => {
      if (cancelled) return;

      const element = findVisibleFeedPostElement(activeFocus.postId);
      if (!element) {
        attempts += 1;
        if (attempts < 40) {
          retryTimer = window.setTimeout(() => {
            rafId = window.requestAnimationFrame(tryFocus);
          }, 50);
        } else {
          setFocusBootstrapping(false);
          setFeedReveal(true);
        }
        return;
      }

      lastFocusedKeyRef.current = focusKey;
      settleScrollRef.current?.();
      settleScrollRef.current = scrollFeedPostIntoView(element, { behavior: 'auto' });

      setFocusBootstrapping(false);
      revealTimer = window.setTimeout(() => {
        if (!cancelled) setFeedReveal(true);
      }, 80);

      element.classList.add('ring-2', 'ring-primary/40', 'ring-offset-2', 'ring-offset-background');

      highlightTimer = window.setTimeout(() => {
        element.classList.remove('ring-2', 'ring-primary/40', 'ring-offset-2', 'ring-offset-background');
      }, 2400);

      // Clear URL only — keep pinnedFocus so the feed query doesn't reshuffle.
      clearParamsTimer = window.setTimeout(clearFocusParams, 300);
    };

    rafId = window.requestAnimationFrame(tryFocus);

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(retryTimer);
      window.clearTimeout(highlightTimer);
      window.clearTimeout(clearParamsTimer);
      window.clearTimeout(revealTimer);
    };
  }, [
    activeFocus?.expandComments,
    activeFocus?.postId,
    isFetched,
    isLoading,
    isXlUp,
    items,
    mobileTab,
    setSearchParams,
    showFeedColumn,
  ]);

  return (
    <div className="space-y-3 sm:space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      >
        <PageHeader
          icon={Newspaper}
          title="Company Feed"
          description="Announcements from leadership and updates shared by your colleagues."
          meta={headerMeta}
          className="relative z-[1] gap-2 sm:gap-4"
        />
      </motion.div>

      <AnimatePresence>
        {isViewingFocusedPost ? (
          <motion.div
            key="focused-banner"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22 }}
            className="sticky top-24 z-20 flex flex-col gap-3 rounded-xl border border-primary/25 bg-card/95 px-3 py-3 shadow-sm backdrop-blur-md sm:flex-row sm:items-center sm:justify-between sm:px-4"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium">Viewing a linked post</p>
              <p className="text-xs text-muted-foreground">
                This older update was opened from a link.
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              className="h-9 w-full shrink-0 gap-1.5 sm:w-auto"
              onClick={returnToLatestFeed}
            >
              <ArrowUp className="h-3.5 w-3.5" />
              Back to latest feed
            </Button>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05, duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
        className="space-y-3 sm:space-y-6"
      >
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
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                >
                  <ActiveDiscussionsWidget />
                </motion.div>
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
            <FocusLoadingOverlay show={Boolean(activeFocus?.postId) && focusBootstrapping} />

            <motion.div
              initial={false}
              animate={{
                opacity: focusBootstrapping ? 0.35 : 1,
                filter: focusBootstrapping ? 'blur(2px)' : 'blur(0px)',
              }}
              transition={{ duration: 0.25 }}
              className="space-y-2.5 sm:space-y-3"
            >
              <FeedComposer />
              <FeedList
                items={items}
                isLoading={isLoading}
                focusTarget={activeFocus}
                reveal={feedReveal}
                hasNextPage={hasNextPage}
                isFetchingNextPage={isFetchingNextPage}
                onLoadMore={loadMore}
              />
            </motion.div>
          </div>

          {isXlUp ? (
            <aside className="col-span-3 self-start">
              <div className="sticky top-24 flex max-h-[calc(100dvh-6.5rem)] flex-col gap-6 overflow-y-auto overscroll-contain">
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.12, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                >
                  <TodaysCelebrationsWidget />
                </motion.div>
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
      </motion.div>
    </div>
  );
}
