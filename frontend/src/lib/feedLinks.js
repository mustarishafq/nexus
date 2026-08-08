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
 * Absolute API share URL used for clipboard / WhatsApp OG previews.
 * Opens via Laravel `/share/posts/{id}` which serves OG HTML to crawlers
 * and redirects browsers into the SPA feed deep-link.
 */
export function feedPostShareUrl(postId) {
  const origin = `${import.meta.env.VITE_API_BASE_URL || ''}`.replace(/\/$/, '');
  const path = `/share/posts/${encodeURIComponent(String(postId))}`;
  return origin ? `${origin}${path}` : path;
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
