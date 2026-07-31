import React, { useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ChevronRight, Newspaper } from 'lucide-react';
import db from '@/api/apiClient';
import { FeedItem } from '@/components/feed/FeedItems';
import { glassPanelStyles } from '@/components/layout/glassStyles';
import { cn } from '@/lib/utils';

const COLLAPSED_HEIGHT = 224; // ~14rem
const EXPAND_EASE = [0.16, 1, 0.3, 1];
const EXPAND_DURATION = 0.55;

function GlassPill({ children, className, as: Comp = 'span', ...props }) {
  return (
    <Comp
      className={cn(
        glassPanelStyles,
        'inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5',
        'text-xs font-medium text-foreground/85',
        'transition-all duration-200',
        'hover:bg-card/45 hover:text-foreground hover:shadow-[0_10px_28px_rgba(0,0,0,0.12)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
        'dark:hover:bg-card/50',
        className
      )}
      {...props}
    >
      {children}
    </Comp>
  );
}

export default function CompanyFeedWidget() {
  const [expanded, setExpanded] = useState(false);
  const [fullHeight, setFullHeight] = useState(0);
  const [measured, setMeasured] = useState(false);
  const contentRef = useRef(null);

  const { data } = useQuery({
    queryKey: ['company-feed', 'dashboard'],
    queryFn: () => db.feed.list({ limit: 1 }),
    staleTime: 30_000,
  });

  const latest = Array.isArray(data?.items) ? data.items[0] : null;
  const total = Number(data?.total) || (latest ? 1 : 0);
  const remaining = Math.max(0, total - (latest ? 1 : 0));
  const needsExpand = measured && fullHeight > COLLAPSED_HEIGHT + 8;
  const collapsed = !expanded && (needsExpand || !measured);
  const targetHeight = collapsed
    ? COLLAPSED_HEIGHT
    : fullHeight > 0
      ? fullHeight
      : COLLAPSED_HEIGHT;

  useLayoutEffect(() => {
    setExpanded(false);
    setMeasured(false);
    setFullHeight(0);
  }, [latest?.id, latest?.type]);

  useLayoutEffect(() => {
    const el = contentRef.current;
    if (!el || !latest) {
      setFullHeight(0);
      setMeasured(false);
      return undefined;
    }

    const measure = () => {
      const next = el.scrollHeight;
      setFullHeight(next);
      setMeasured(true);
    };

    measure();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    observer?.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [latest]);

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border/50 px-3 py-3 md:px-5 md:py-4">
        <div className="flex items-center gap-2">
          <Newspaper className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Company Feed</h3>
        </div>
      </div>

      {!latest ? (
        <div className="px-5 py-8 text-center text-sm text-muted-foreground">
          No updates yet.{' '}
          <Link to="/feed" className="font-medium text-primary hover:underline">
            Share something with your team
          </Link>
        </div>
      ) : (
        <div>
          <div className="relative">
            <motion.div
              initial={false}
              animate={{ height: targetHeight }}
              transition={{
                duration: EXPAND_DURATION,
                ease: EXPAND_EASE,
              }}
              className="overflow-hidden"
              style={{ willChange: 'height' }}
            >
              <div ref={contentRef}>
                <FeedItem key={`${latest.type}-${latest.id}`} item={latest} compact />
              </div>
            </motion.div>

            {/* Glass fade stays mounted and fades with the expand */}
            <motion.button
              type="button"
              initial={false}
              animate={{
                opacity: collapsed && needsExpand ? 1 : 0,
                y: collapsed && needsExpand ? 0 : 10,
              }}
              transition={{ duration: 0.35, ease: EXPAND_EASE }}
              onClick={() => {
                if (collapsed && needsExpand) setExpanded(true);
              }}
              disabled={!(collapsed && needsExpand)}
              tabIndex={collapsed && needsExpand ? 0 : -1}
              aria-hidden={!(collapsed && needsExpand)}
              aria-expanded={expanded}
              aria-label="Show full post"
              className={cn(
                'group absolute inset-x-0 bottom-0 flex h-28 items-end justify-center pb-3.5 outline-none',
                !(collapsed && needsExpand) && 'pointer-events-none'
              )}
            >
              <div
                aria-hidden
                className={cn(
                  'pointer-events-none absolute inset-0',
                  'bg-gradient-to-t from-card via-card/75 to-transparent',
                  'backdrop-blur-[6px]',
                  '[mask-image:linear-gradient(to_top,black_40%,transparent_100%)]',
                  '[-webkit-mask-image:linear-gradient(to_top,black_40%,transparent_100%)]'
                )}
              />
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-card to-transparent"
              />
              <GlassPill className="relative z-10 group-hover:bg-card/45 dark:group-hover:bg-card/50">
                Show more
                <ChevronRight className="h-3.5 w-3.5 opacity-70 transition-transform duration-200 group-hover:translate-x-0.5" />
              </GlassPill>
            </motion.button>
          </div>

          {remaining > 0 ? (
            <motion.div
              initial={false}
              animate={{
                opacity: collapsed ? 0 : 1,
                height: collapsed ? 0 : 52,
              }}
              transition={{
                duration: 0.4,
                ease: EXPAND_EASE,
                delay: collapsed ? 0 : 0.18,
              }}
              className="overflow-hidden"
            >
              <div className="flex h-[52px] items-center justify-center border-t border-border/40 px-3">
                <GlassPill as={Link} to="/feed" className="group" tabIndex={collapsed ? -1 : 0}>
                  View more
                  <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-primary">
                    +{remaining}
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 opacity-70 transition-transform duration-200 group-hover:translate-x-0.5" />
                </GlassPill>
              </div>
            </motion.div>
          ) : null}
        </div>
      )}
    </div>
  );
}
