export const INITIAL_VISIBLE_COMMENTS = 3;
export const INITIAL_VISIBLE_COMMENTS_SHEET = 8;
export const INITIAL_VISIBLE_REPLIES = 2;

/**
 * Depth-first flatten of nested comment replies into a single list.
 * Used for Facebook-style threads: one indent level for all replies.
 */
export function flattenCommentReplies(replies = []) {
  const result = [];

  const walk = (items) => {
    for (const item of items || []) {
      result.push(item);
      if (Array.isArray(item.replies) && item.replies.length > 0) {
        walk(item.replies);
      }
    }
  };

  walk(replies);
  return result;
}

/**
 * Newest window over a chronological (oldest-first) list so recent replies stay visible.
 */
export function takeNewest(items = [], count) {
  if (!Array.isArray(items) || items.length === 0) return [];
  if (count == null || count >= items.length) return items;
  return items.slice(items.length - count);
}
