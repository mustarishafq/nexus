import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { useActiveBroadcasts } from '@/hooks/useActiveBroadcasts';
import { sortBroadcastsByPriority } from '@/lib/broadcast';
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

function TickerItems({ broadcasts, suffix = '' }) {
  return broadcasts.map((broadcast) => (
    <span
      key={`${broadcast.id}${suffix}`}
      className="inline-flex shrink-0 items-center gap-1.5 pr-10 leading-none"
    >
      <span className="font-semibold leading-none tracking-tight">{broadcast.title}</span>
      {broadcast.message ? (
        <>
          <span className="opacity-40">·</span>
          <span className="font-normal leading-none opacity-85">{broadcast.message}</span>
        </>
      ) : null}
    </span>
  ));
}

function LiveBadge({ priority }) {
  const isUrgent = priority === 'critical' || priority === 'high';

  return (
    <div className="flex shrink-0 items-center gap-1.5 self-stretch border-r border-white/10 bg-black/25 px-2.5 backdrop-blur-sm">
      <span className="relative flex h-1.5 w-1.5 shrink-0">
        {isUrgent ? (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-70" />
        ) : null}
        <span
          className={cn(
            'relative inline-flex h-1.5 w-1.5 rounded-full',
            isUrgent ? 'bg-red-500' : 'bg-emerald-400'
          )}
        />
      </span>
      <span className="text-[9px] font-bold uppercase leading-none tracking-[0.16em] opacity-95">
        {badgeLabels[priority] || badgeLabels.medium}
      </span>
    </div>
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
  const trackRef = useRef(null);
  const [shouldScroll, setShouldScroll] = useState(false);
  const [duration, setDuration] = useState(40);

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

  const updateTickerLayout = useCallback(() => {
    const viewport = viewportRef.current;
    const measure = measureRef.current;
    if (!viewport || !measure) return;

    const contentWidth = measure.scrollWidth;
    const viewportWidth = viewport.clientWidth;
    const overflow = contentWidth > viewportWidth + 8;

    setShouldScroll(overflow);

    if (overflow && trackRef.current) {
      const halfWidth = trackRef.current.scrollWidth / 2;
      setDuration(Math.max(24, halfWidth / 55));
    }
  }, []);

  useEffect(() => {
    updateTickerLayout();

    const observer = new ResizeObserver(updateTickerLayout);
    if (viewportRef.current) observer.observe(viewportRef.current);
    if (measureRef.current) observer.observe(measureRef.current);
    if (trackRef.current) observer.observe(trackRef.current);

    return () => observer.disconnect();
  }, [visibleBroadcasts, updateTickerLayout]);

  useEffect(() => {
    if (!shouldScroll) return;
    updateTickerLayout();
  }, [shouldScroll, updateTickerLayout]);

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
      <div className="flex h-7 items-center shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] sm:h-8">
        <LiveBadge priority={topPriority} />

        <div
          ref={viewportRef}
          className={cn(
            'broadcast-ticker-viewport relative flex h-full min-w-0 flex-1 items-center overflow-hidden',
            shouldScroll ? 'broadcast-ticker-viewport--scroll' : 'justify-center'
          )}
        >
          <div
            ref={measureRef}
            aria-hidden
            className="pointer-events-none absolute left-0 top-0 flex w-max items-center whitespace-nowrap px-3 text-[10px] leading-none opacity-0 sm:text-[11px]"
          >
            <TickerItems broadcasts={visibleBroadcasts} />
          </div>

          <div
            ref={trackRef}
            className={cn(
              'flex items-center whitespace-nowrap px-3 text-[10px] leading-none sm:text-[11px]',
              shouldScroll ? 'broadcast-ticker-track w-max' : 'w-full justify-center'
            )}
            style={shouldScroll ? { animationDuration: `${duration}s` } : undefined}
          >
            <TickerItems broadcasts={visibleBroadcasts} />
            {shouldScroll ? <TickerItems broadcasts={visibleBroadcasts} suffix="-loop" /> : null}
          </div>
        </div>

        <button
          type="button"
          onClick={dismissAll}
          className="flex h-full shrink-0 items-center self-stretch border-l border-white/10 px-2.5 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
          aria-label="Dismiss announcements"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
