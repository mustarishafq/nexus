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
