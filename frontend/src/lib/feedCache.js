/**
 * Shared React Query cache helpers for company/user feed items and comments.
 */

function isInfiniteFeedData(current) {
  return Boolean(current && Array.isArray(current.pages));
}

function mapFeedItems(current, mapper) {
  if (!current) return current;

  if (isInfiniteFeedData(current)) {
    return {
      ...current,
      pages: current.pages.map((page) => {
        if (!page || !Array.isArray(page.items)) return page;
        return { ...page, items: page.items.map(mapper) };
      }),
    };
  }

  if (!Array.isArray(current.items)) return current;
  return {
    ...current,
    items: current.items.map(mapper),
  };
}

function isMatchingPost(entry, postId) {
  return entry?.type === 'post' && String(entry.id) === String(postId);
}

/**
 * Merge a full (or partial) post into company-feed / user-feed / active-discussions caches.
 */
export function patchFeedItem(queryClient, nextItem) {
  if (!nextItem?.id) return;

  queryClient.setQueriesData({ queryKey: ['company-feed'] }, (current) => (
    mapFeedItems(current, (entry) => (
      isMatchingPost(entry, nextItem.id) ? { ...entry, ...nextItem } : entry
    ))
  ));

  queryClient.setQueriesData({ queryKey: ['user-feed'] }, (current) => (
    mapFeedItems(current, (entry) => (
      isMatchingPost(entry, nextItem.id) ? { ...entry, ...nextItem } : entry
    ))
  ));

  queryClient.setQueriesData({ queryKey: ['feed-active-discussions'] }, (current) => {
    if (!current || !Array.isArray(current.items)) return current;
    return {
      ...current,
      items: current.items.map((entry) => (
        String(entry?.id) === String(nextItem.id)
          ? { ...entry, ...nextItem }
          : entry
      )),
    };
  });
}

/**
 * Functional update for a post across feed caches.
 */
export function updateFeedItem(queryClient, postId, updater) {
  if (postId == null || typeof updater !== 'function') return;

  const apply = (current) => mapFeedItems(current, (entry) => (
    isMatchingPost(entry, postId) ? updater(entry) : entry
  ));

  queryClient.setQueriesData({ queryKey: ['company-feed'] }, apply);
  queryClient.setQueriesData({ queryKey: ['user-feed'] }, apply);
  queryClient.setQueriesData({ queryKey: ['feed-active-discussions'] }, (current) => {
    if (!current || !Array.isArray(current.items)) return current;
    return {
      ...current,
      items: current.items.map((entry) => (
        String(entry?.id) === String(postId) ? updater(entry) : entry
      )),
    };
  });
}

/**
 * Prepend a post to company-feed / user-feed (optimistic create).
 */
export function prependFeedItem(queryClient, item) {
  if (!item?.id) return;

  const prepend = (current) => {
    if (!current) {
      return { items: [item] };
    }

    if (isInfiniteFeedData(current)) {
      const alreadyPresent = current.pages.some((page) => (
        Array.isArray(page?.items)
        && page.items.some((entry) => String(entry?.id) === String(item.id))
      ));
      if (alreadyPresent) return current;

      if (current.pages.length === 0) {
        return {
          ...current,
          pages: [{ items: [item], has_more: false, next_before: null }],
        };
      }

      const [first, ...rest] = current.pages;
      return {
        ...current,
        pages: [
          {
            ...first,
            items: [item, ...(Array.isArray(first?.items) ? first.items : [])],
          },
          ...rest,
        ],
      };
    }

    if (!Array.isArray(current.items)) {
      return current;
    }
    if (current.items.some((entry) => String(entry?.id) === String(item.id))) {
      return current;
    }
    return { ...current, items: [item, ...current.items] };
  };

  queryClient.setQueriesData({ queryKey: ['company-feed'] }, prepend);
  queryClient.setQueriesData({ queryKey: ['user-feed'] }, prepend);
}

/**
 * Remove a post by id (rollback optimistic create / delete).
 */
export function removeFeedItem(queryClient, postId) {
  if (postId == null) return;

  const strip = (current) => {
    if (!current) return current;

    if (isInfiniteFeedData(current)) {
      return {
        ...current,
        pages: current.pages.map((page) => {
          if (!page || !Array.isArray(page.items)) return page;
          return {
            ...page,
            items: page.items.filter((entry) => String(entry?.id) !== String(postId)),
          };
        }),
      };
    }

    if (!Array.isArray(current.items)) return current;
    return {
      ...current,
      items: current.items.filter((entry) => String(entry?.id) !== String(postId)),
    };
  };

  queryClient.setQueriesData({ queryKey: ['company-feed'] }, strip);
  queryClient.setQueriesData({ queryKey: ['user-feed'] }, strip);
  queryClient.setQueriesData({ queryKey: ['feed-active-discussions'] }, strip);
}

/**
 * Replace a temp optimistic post with the server item.
 */
export function replaceFeedItem(queryClient, tempId, nextItem) {
  if (tempId == null || !nextItem?.id) return;

  const replace = (current) => {
    if (!current) return current;

    if (isInfiniteFeedData(current)) {
      return {
        ...current,
        pages: current.pages.map((page) => {
          if (!page || !Array.isArray(page.items)) return page;
          return {
            ...page,
            items: page.items.map((entry) => (
              String(entry?.id) === String(tempId) ? { ...entry, ...nextItem } : entry
            )),
          };
        }),
      };
    }

    if (!Array.isArray(current.items)) return current;
    return {
      ...current,
      items: current.items.map((entry) => (
        String(entry?.id) === String(tempId) ? { ...entry, ...nextItem } : entry
      )),
    };
  };

  queryClient.setQueriesData({ queryKey: ['company-feed'] }, replace);
  queryClient.setQueriesData({ queryKey: ['user-feed'] }, replace);
  queryClient.setQueriesData({ queryKey: ['feed-active-discussions'] }, replace);
}

/**
 * Toggle / switch / clear a reaction on a post or comment-shaped object.
 * Passing the same emoji again clears it (matches API toggle behavior).
 */
export function applyPostReactionChange(item, nextReaction) {
  if (!item) return item;

  const previousReaction = item.my_reaction?.reaction ?? null;
  const counts = { ...(item.reaction_counts || {}) };

  if (previousReaction) {
    counts[previousReaction] = (counts[previousReaction] || 1) - 1;
    if (counts[previousReaction] <= 0) {
      delete counts[previousReaction];
    }
  }

  const clearing = previousReaction && previousReaction === nextReaction;
  const applied = clearing ? null : nextReaction;

  if (applied) {
    counts[applied] = (counts[applied] || 0) + 1;
  }

  const reactionsCount = Object.values(counts).reduce((total, count) => total + (Number(count) || 0), 0);

  return {
    ...item,
    reactions_count: reactionsCount,
    reaction_counts: counts,
    my_reaction: applied
      ? { id: item.my_reaction?.id ?? 'optimistic', reaction: applied }
      : null,
  };
}

function mapCommentTree(comments, commentId, updater) {
  if (!Array.isArray(comments)) return comments;

  return comments.map((comment) => {
    if (String(comment.id) === String(commentId)) {
      return updater(comment);
    }
    if (Array.isArray(comment.replies) && comment.replies.length > 0) {
      return {
        ...comment,
        replies: mapCommentTree(comment.replies, commentId, updater),
      };
    }
    return comment;
  });
}

/**
 * Update post-comments query cache for a post.
 */
export function patchPostComments(queryClient, postId, updater) {
  if (postId == null || typeof updater !== 'function') return;

  queryClient.setQueryData(['post-comments', postId], (current) => {
    if (!current) {
      const next = updater({ comments: [] });
      return next;
    }
    return updater(current);
  });
}

/**
 * Apply a reaction change to a comment (including nested replies) in post-comments.
 */
export function updateCommentReaction(queryClient, postId, commentId, nextReaction) {
  patchPostComments(queryClient, postId, (current) => {
    const comments = Array.isArray(current?.comments) ? current.comments : [];
    return {
      ...current,
      comments: mapCommentTree(comments, commentId, (comment) => (
        applyPostReactionChange(comment, nextReaction)
      )),
    };
  });
}

/**
 * Replace a comment (or nested reply) after server confirms, or merge fields.
 */
export function replaceCommentInTree(queryClient, postId, commentId, nextComment) {
  patchPostComments(queryClient, postId, (current) => {
    const comments = Array.isArray(current?.comments) ? current.comments : [];
    return {
      ...current,
      comments: mapCommentTree(comments, commentId, () => nextComment),
    };
  });
}

/**
 * Insert an optimistic comment or reply.
 */
export function insertOptimisticComment(queryClient, postId, comment, parentCommentId = null) {
  patchPostComments(queryClient, postId, (current) => {
    const comments = Array.isArray(current?.comments) ? [...current.comments] : [];

    if (!parentCommentId) {
      return { ...current, comments: [...comments, comment] };
    }

    return {
      ...current,
      comments: mapCommentTree(comments, parentCommentId, (parent) => ({
        ...parent,
        replies: [...(Array.isArray(parent.replies) ? parent.replies : []), comment],
      })),
    };
  });
}

/**
 * Remove a comment/reply from the tree (optimistic delete).
 */
export function removeCommentFromTree(queryClient, postId, commentId) {
  const strip = (list) => {
    if (!Array.isArray(list)) return [];
    return list
      .filter((comment) => String(comment.id) !== String(commentId))
      .map((comment) => ({
        ...comment,
        replies: strip(comment.replies),
      }));
  };

  patchPostComments(queryClient, postId, (current) => ({
    ...current,
    comments: strip(current?.comments),
  }));
}

/**
 * Bump comments_count on a feed post.
 */
export function bumpFeedCommentsCount(queryClient, postId, delta) {
  updateFeedItem(queryClient, postId, (item) => ({
    ...item,
    comments_count: Math.max(0, (Number(item.comments_count) || 0) + delta),
  }));
}

/**
 * Optimistically apply a poll vote to a post's poll (single or multi).
 */
export function applyPollVoteOptimistic(item, pollId, optionId) {
  if (!item || pollId == null || optionId == null) return item;

  const pollsSource = Array.isArray(item.polls) && item.polls.length > 0
    ? item.polls
    : (item.poll ? [item.poll] : []);

  const polls = pollsSource.map((poll) => {
    if (String(poll.id) !== String(pollId) || !Array.isArray(poll.options)) {
      return poll;
    }

    const allowMultiple = Boolean(poll.allow_multiple);
    const optionIdNum = Number(optionId);
    const myIds = new Set(
      (Array.isArray(poll.my_option_ids) ? poll.my_option_ids : [])
        .map(Number)
        .filter((id) => Number.isFinite(id))
    );
    if (poll.my_option_id != null && myIds.size === 0) {
      myIds.add(Number(poll.my_option_id));
    }

    const hadOption = myIds.has(optionIdNum);
    const previouslyVoted = myIds.size > 0;
    const previousSingle = !allowMultiple && previouslyVoted
      ? (myIds.values().next().value ?? null)
      : null;

    if (allowMultiple) {
      if (hadOption) myIds.delete(optionIdNum);
      else myIds.add(optionIdNum);
    } else if (hadOption) {
      myIds.clear();
    } else {
      myIds.clear();
      myIds.add(optionIdNum);
    }

    let voterDelta = 0;
    if (!previouslyVoted && myIds.size > 0) voterDelta = 1;
    if (previouslyVoted && myIds.size === 0) voterDelta = -1;

    const totalVotes = Math.max(0, (Number(poll.total_votes) || 0) + voterDelta);

    const options = poll.options.map((option) => {
      let votesCount = Number(option.votes_count) || 0;
      const id = Number(option.id);

      if (allowMultiple) {
        if (id === optionIdNum) {
          votesCount += hadOption ? -1 : 1;
        }
      } else if (hadOption && id === optionIdNum) {
        votesCount -= 1;
      } else if (!hadOption) {
        if (id === optionIdNum) votesCount += 1;
        if (previousSingle != null && id === previousSingle) votesCount -= 1;
      }

      votesCount = Math.max(0, votesCount);

      return {
        ...option,
        votes_count: votesCount,
        voted: myIds.has(id),
        percent: totalVotes > 0 ? Math.round((votesCount / totalVotes) * 100) : 0,
      };
    });

    const myOptionIds = [...myIds];

    return {
      ...poll,
      options,
      total_votes: totalVotes,
      has_voted: myOptionIds.length > 0,
      my_option_id: myOptionIds[0] ?? null,
      my_option_ids: myOptionIds,
    };
  });

  return {
    ...item,
    polls,
    poll: polls[0] ?? null,
  };
}

/**
 * Generic optimistic reaction patch for custom invalidateKeys caches
 * (profile media root objects, comment lists shaped like `{ comments: [] }`).
 */
export function applyReactionToQueryCaches(queryClient, queryKeys, { itemId, commentId, reaction }) {
  if (!Array.isArray(queryKeys) || queryKeys.length === 0) return;

  queryKeys.forEach((queryKey) => {
    queryClient.setQueryData(queryKey, (current) => {
      if (!current || typeof current !== 'object') return current;

      const targetCommentId = commentId ?? null;

      if (Array.isArray(current.comments) && (targetCommentId != null || itemId != null)) {
        const id = targetCommentId ?? itemId;
        return {
          ...current,
          comments: mapCommentTree(current.comments, id, (comment) => (
            applyPostReactionChange(comment, reaction)
          )),
        };
      }

      if (itemId != null && current.item && (
        current.item.id == null || String(current.item.id) === String(itemId)
      ) && current.item.reaction_counts != null) {
        return {
          ...current,
          item: applyPostReactionChange(current.item, reaction),
        };
      }

      // Profile media root payload without a stable id on the media object.
      if (itemId == null && current.item?.reaction_counts != null && !Array.isArray(current.comments)) {
        return {
          ...current,
          item: applyPostReactionChange(current.item, reaction),
        };
      }

      if (itemId != null && current.reaction_counts != null && String(current.id) === String(itemId)) {
        return applyPostReactionChange(current, reaction);
      }

      return current;
    });
  });
}

export function feedReactionQueryKeys({ isComment, postId, invalidateKeys }) {
  if (Array.isArray(invalidateKeys) && invalidateKeys.length > 0) {
    return invalidateKeys;
  }
  if (isComment) {
    return [['post-comments', postId]];
  }
  return [['company-feed'], ['user-feed'], ['feed-active-discussions']];
}

export function snapshotQueryMatches(queryClient, queryKeys) {
  const snapshots = [];
  (queryKeys || []).forEach((queryKey) => {
    queryClient.getQueriesData({ queryKey }).forEach(([key, data]) => {
      snapshots.push([key, data]);
    });
  });
  return snapshots;
}

export function restoreQueryMatches(queryClient, snapshots) {
  if (!Array.isArray(snapshots)) return;
  snapshots.forEach(([queryKey, data]) => {
    queryClient.setQueryData(queryKey, data);
  });
}

export async function cancelQueryMatches(queryClient, queryKeys) {
  await Promise.all(
    (queryKeys || []).map((queryKey) => queryClient.cancelQueries({ queryKey }))
  );
}

