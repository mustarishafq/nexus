import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { useActiveBroadcasts } from '@/hooks/useActiveBroadcasts';
import { sortBroadcastsByPriority } from '@/lib/broadcast';
import { TopStripBadge, TopStripDismissButton, TOP_STRIP_ROW_CLASS } from '@/components/layout/TopStripBadge';
import { cn } from '@/lib/utils';

const stripStyles = {
  critical:
    'bg-gradient-to-r from-red-900/95 via-red-800/95 to-red-900/95 text-white border-red-950/30',
  high:
    'bg-gradient-to-r from-amber-800/95 via-amber-700/95 to-amber-800/95 text-white border-amber-950/30',
  medium:
    'bg-gradient-to-r from-slate-800/95 via-slate-700/95 to-slate-800/95 text-slate-50 border-slate-900/30',
  low:
    'bg-gradient-to-r from-slate-700/95 via-slate-600/95 to-slate-700/95 text-slate-100 border-slate-800/30',
};

const badgeLabels = {
  critical: 'Alert',
  high: 'Update',
  medium: 'News',
  low: 'Info',
};

function formatBroadcastText(broadcast) {
  if (broadcast.message) {
    return `${broadcast.title} — ${broadcast.message}`;
  }
  return broadcast.title;
}

function TickerItems({ broadcasts, suffix = '', copy = false }) {
  return broadcasts.map((broadcast) => {
    const content = (
      <>
        <span className="font-semibold leading-none tracking-tight">{broadcast.title}</span>
        {broadcast.message ? (
          <>
            <span className="opacity-40">·</span>
            <span className="font-normal leading-none opacity-85">{broadcast.message}</span>
          </>
        ) : null}
      </>
    );

    // With a link (e.g. Insan's letter to sign), the item works like the announcement's Open button.
    if (broadcast.action_url) {
      return (
        <a
          key={`${broadcast.id}${suffix}`}
          href={broadcast.action_url}
          target="_blank"
          rel="noopener noreferrer"
          title="Open"
          tabIndex={copy ? -1 : undefined}
          className="inline-flex shrink-0 items-center gap-1.5 pr-10 leading-none underline-offset-2 hover:underline focus-visible:underline focus-visible:outline-none"
        >
          {content}
          <ExternalLink className="h-2.5 w-2.5 shrink-0 opacity-70" aria-hidden />
        </a>
      );
    }

    return (
      <span
        key={`${broadcast.id}${suffix}`}
        className="inline-flex shrink-0 items-center gap-1.5 pr-10 leading-none"
      >
        {content}
      </span>
    );
  });
}

function LiveBadge({ priority }) {
  const isUrgent = priority === 'critical' || priority === 'high';

  return (
    <TopStripBadge
      label={badgeLabels[priority] || badgeLabels.medium}
      pulse={isUrgent}
      dotClassName={isUrgent ? 'bg-red-500' : 'bg-emerald-400'}
    />
  );
}

export default function GlobalBroadcastStrip({
  embedded = false,
  sidebarWidth = 0,
  isMobile = false,
  onVisibilityChange,
}) {
  const { user } = useAuth();
  const { data: broadcasts = [] } = useActiveBroadcasts({ enabled: Boolean(user?.id) });
  const [dismissedIds, setDismissedIds] = useState(new Set());
  const viewportRef = useRef(null);
  const measureRef = useRef(null);
  // Copies of the items in each half of the ticker, so it fills the strip and loops seamlessly.
  const [repeat, setRepeat] = useState(1);
  const [duration, setDuration] = useState(24);

  const visibleBroadcasts = useMemo(
    () =>
      sortBroadcastsByPriority(
        broadcasts.filter((broadcast) => !dismissedIds.has(String(broadcast.id)))
      ),
    [broadcasts, dismissedIds]
  );

  const isVisible = visibleBroadcasts.length > 0;
  const topPriority = visibleBroadcasts[0]?.priority || 'medium';

  useEffect(() => {
    onVisibilityChange?.(isVisible);
  }, [isVisible, onVisibilityChange]);

  // The ticker always moves; short text is repeated until it spans the strip.
  const updateTickerLayout = useCallback(() => {
    const viewport = viewportRef.current;
    const measure = measureRef.current;
    if (!viewport || !measure) return;

    const contentWidth = measure.scrollWidth;
    if (!contentWidth) return;

    const nextRepeat = Math.max(1, Math.ceil(viewport.clientWidth / contentWidth));
    setRepeat(nextRepeat);
    setDuration(Math.max(12, (contentWidth * nextRepeat) / 55));
  }, []);

  useEffect(() => {
    updateTickerLayout();

    const observer = new ResizeObserver(updateTickerLayout);
    if (viewportRef.current) observer.observe(viewportRef.current);
    if (measureRef.current) observer.observe(measureRef.current);

    return () => observer.disconnect();
  }, [visibleBroadcasts, updateTickerLayout]);

  if (!user || !isVisible) {
    return null;
  }

  const dismissAll = () => {
    setDismissedIds((prev) => {
      const next = new Set(prev);
      visibleBroadcasts.forEach((broadcast) => next.add(String(broadcast.id)));
      return next;
    });
  };

  return (
    <div
      className={cn(
        'border-b backdrop-blur-sm transition-all duration-200',
        embedded ? 'w-full' : 'fixed right-0 z-[25]',
        stripStyles[topPriority] || stripStyles.medium
      )}
      style={
        embedded
          ? undefined
          : {
              top: '4rem',
              left: isMobile ? 0 : sidebarWidth,
            }
      }
      role="marquee"
      aria-live="polite"
      aria-label={visibleBroadcasts.map(formatBroadcastText).join('. ')}
    >
      <div className={TOP_STRIP_ROW_CLASS}>
        <LiveBadge priority={topPriority} />

        <div
          ref={viewportRef}
          className="broadcast-ticker-viewport broadcast-ticker-viewport--scroll relative flex h-full min-w-0 flex-1 items-center overflow-hidden"
        >
          <div
            ref={measureRef}
            aria-hidden
            className="pointer-events-none invisible absolute left-0 top-0 flex w-max items-center whitespace-nowrap text-[11px] leading-none"
          >
            <TickerItems broadcasts={visibleBroadcasts} />
          </div>

          <div
            className="broadcast-ticker-track flex w-max items-center whitespace-nowrap text-[11px] leading-none"
            style={{ animationDuration: `${duration}s` }}
          >
            {Array.from({ length: repeat * 2 }, (_, i) => (
              <span key={i} className="flex items-center" aria-hidden={i > 0 || undefined}>
                <TickerItems broadcasts={visibleBroadcasts} suffix={`-${i}`} copy={i > 0} />
              </span>
            ))}
          </div>
        </div>

        <TopStripDismissButton onClick={dismissAll} ariaLabel="Dismiss announcements" />
      </div>
    </div>
  );
}
