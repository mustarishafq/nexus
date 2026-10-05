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
 */
export function feedPostShareUrl(postId) {
  const path = `/share/posts/${encodeURIComponent(String(postId))}`;
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

const SHARED_POST_LINK_REGEX = /https?:\/\/\S+\/share\/posts\/\d+\/?/g;

/** Remove feed share links from message text (the post renders as a preview card instead). */
export function stripSharedPostLinks(text = '') {
  return String(text).replace(SHARED_POST_LINK_REGEX, '').replace(/\n{3,}/g, '\n\n').trim();
}

/** Inbox preview for a message body: shared post links read as "Shared a post". */
export function messagePreviewText(body = '') {
  const text = String(body || '');
  if (!new RegExp(SHARED_POST_LINK_REGEX.source).test(text)) {
    return text;
  }
  return stripSharedPostLinks(text) || 'Shared a post';
}
