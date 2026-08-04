export function feedPostElementId(postId) {
  return `feed-post-${postId}`;
}

export function feedPostPath(postId, { expandComments = false } = {}) {
  const params = new URLSearchParams({ post: String(postId) });
  if (expandComments) {
    params.set('comments', '1');
  }
  return `/feed?${params.toString()}`;
}

export function parseFeedFocusParams(searchParams) {
  const postId = searchParams.get('post');
  if (!postId) {
    return null;
  }

  return {
    postId,
    expandComments: searchParams.get('comments') === '1',
  };
}

/**
 * Smooth-scroll a feed post into view, then quietly re-align after layout
 * settles (lazy images / aspect frames) without interrupting the animation.
 */
export function scrollFeedPostIntoView(element, {
  behavior = 'smooth',
  settleMs = 2200,
  /** Don't snap-correct while the smooth animation is still running. */
  smoothGuardMs = 650,
} = {}) {
  if (!element || typeof element.scrollIntoView !== 'function') {
    return () => {};
  }

  const align = (scrollBehavior) => {
    element.scrollIntoView({ behavior: scrollBehavior, block: 'start' });
  };

  align(behavior);

  let cancelled = false;
  let rafId = 0;
  let lastCorrectAt = 0;
  const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
  // Matches FeedItem `scroll-mt-24` (6rem).
  const stickyOffsetPx = 96;

  const realignIfDrifted = () => {
    if (cancelled) return;

    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (behavior === 'smooth' && now - startedAt < smoothGuardMs) {
      return;
    }

    const top = element.getBoundingClientRect().top;
    if (Math.abs(top - stickyOffsetPx) <= 12) {
      return;
    }

    // Throttle instant corrections so we don't fight the browser mid-frame.
    if (now - lastCorrectAt < 80) {
      return;
    }
    lastCorrectAt = now;
    align('auto');
  };

  const scheduleRealign = () => {
    if (cancelled) return;
    if (rafId) window.cancelAnimationFrame(rafId);
    rafId = window.requestAnimationFrame(realignIfDrifted);
  };

  const resizeObserver = typeof ResizeObserver !== 'undefined'
    ? new ResizeObserver(scheduleRealign)
    : null;

  const feedRoot = element.parentElement;
  if (resizeObserver) {
    resizeObserver.observe(element);
    if (feedRoot) resizeObserver.observe(feedRoot);
  }

  const onImageLoad = (event) => {
    if (event.target instanceof HTMLImageElement) {
      scheduleRealign();
    }
  };

  document.addEventListener('load', onImageLoad, true);

  // Corrections only after the smooth scroll has had time to finish.
  const timers = [
    smoothGuardMs + 40,
    smoothGuardMs + 280,
    smoothGuardMs + 700,
    smoothGuardMs + 1200,
  ].map((ms) => window.setTimeout(scheduleRealign, ms));

  const stopTimer = window.setTimeout(() => {
    cleanup();
  }, settleMs);

  const cleanup = () => {
    if (cancelled) return;
    cancelled = true;
    if (rafId) window.cancelAnimationFrame(rafId);
    resizeObserver?.disconnect();
    document.removeEventListener('load', onImageLoad, true);
    timers.forEach((id) => window.clearTimeout(id));
    window.clearTimeout(stopTimer);
  };

  return cleanup;
}
