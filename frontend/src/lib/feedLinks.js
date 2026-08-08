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

/**
 * Frontend share URL for clipboard / WhatsApp OG previews.
 * Requires nginx (or similar) to proxy `/share/` to Laravel.
 * `og` query busts WhatsApp Web's aggressive preview cache after OG fixes.
 */
export function feedPostShareUrl(postId) {
  const path = `/share/posts/${encodeURIComponent(String(postId))}?og=4`;
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}${path}`;
  }
  return path;
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
 * Scroll a feed post into view once. Prefer instant alignment for deep-links so
 * we don't fight layout shifts with repeated smooth/auto corrections.
 */
export function scrollFeedPostIntoView(element, {
  behavior = 'auto',
  block = 'start',
} = {}) {
  if (!element || typeof element.scrollIntoView !== 'function') {
    return () => {};
  }

  element.scrollIntoView({ behavior, block });
  return () => {};
}
