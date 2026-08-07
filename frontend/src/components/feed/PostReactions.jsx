import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { MessageCircle, Plus, Share2, SmilePlus, ThumbsUp } from 'lucide-react';
import db from '@/api/apiClient';
import { cn } from '@/lib/utils';
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';
import ExpActionHint from '@/components/gamification/ExpActionHint';
import { glassDockStyles } from '@/components/layout/glassStyles';
import { notifyGamificationOffers } from '@/lib/gamification';
import { reactionMotion, spawnReactionBurst } from '@/components/feed/ReactionBurst';
import { EmojiCollectionPanel } from '@/components/feed/EmojiCollectionPicker';
import { getReactionShortcuts, pinReactionShortcut } from '@/lib/reactionPreferences';
import {
  applyPostReactionChange,
  applyReactionToQueryCaches,
  cancelQueryMatches,
  feedReactionQueryKeys,
  patchFeedItem,
  replaceCommentInTree,
  restoreQueryMatches,
  snapshotQueryMatches,
  updateCommentReaction,
  updateFeedItem,
} from '@/lib/feedCache';

const DEFAULT_REACTIONS = ['👍', '❤️', '👏', '🎉', '😂', '🔥'];
const PRIMARY_REACTION = '👍';

function useReactMutation({
  item,
  commentId,
  postId,
  reactFn,
  invalidateKeys,
}) {
  const queryClient = useQueryClient();
  const isComment = Boolean(commentId);

  return useMutation({
    mutationFn: (reaction) => {
      if (reactFn) {
        return reactFn(reaction);
      }

      return isComment
        ? db.feed.reactToComment(commentId, reaction)
        : db.feed.reactToPost(item.id, reaction);
    },
    onMutate: async (reaction) => {
      const queryKeys = feedReactionQueryKeys({ isComment, postId, invalidateKeys });
      await cancelQueryMatches(queryClient, queryKeys);
      const snapshots = snapshotQueryMatches(queryClient, queryKeys);

      if (Array.isArray(invalidateKeys) && invalidateKeys.length > 0) {
        applyReactionToQueryCaches(queryClient, invalidateKeys, {
          itemId: item?.id,
          commentId: isComment ? commentId : null,
          reaction,
        });
      } else if (isComment) {
        updateCommentReaction(queryClient, postId, commentId, reaction);
      } else {
        updateFeedItem(queryClient, item.id, (entry) => applyPostReactionChange(entry, reaction));
      }

      return { snapshots };
    },
    onSuccess: (payload) => {
      notifyGamificationOffers(payload);

      if (payload?.item) {
        patchFeedItem(queryClient, payload.item);
      }
      if (payload?.comment && postId) {
        replaceCommentInTree(queryClient, postId, payload.comment.id, payload.comment);
      }
    },
    onError: (error, _reaction, context) => {
      if (context?.snapshots) {
        restoreQueryMatches(queryClient, context.snapshots);
      }
      toast.error(error?.message || 'Failed to update reaction.');
    },
    onSettled: () => {
      if (Array.isArray(invalidateKeys) && invalidateKeys.length > 0) {
        invalidateKeys.forEach((queryKey) => {
          queryClient.invalidateQueries({ queryKey });
        });
        return;
      }

      if (isComment) {
        queryClient.invalidateQueries({ queryKey: ['post-comments', postId] });
      } else {
        queryClient.invalidateQueries({ queryKey: ['company-feed'] });
        queryClient.invalidateQueries({ queryKey: ['user-feed'] });
        queryClient.invalidateQueries({ queryKey: ['feed-active-discussions'] });
      }
    },
  });
}

function useShortcutReactions(defaults) {
  const baseKey = (defaults || DEFAULT_REACTIONS).join('\0');
  const base = React.useMemo(
    () => (baseKey ? baseKey.split('\0') : DEFAULT_REACTIONS),
    [baseKey]
  );
  const [reactions, setReactions] = useState(() => getReactionShortcuts(base));

  React.useEffect(() => {
    setReactions(getReactionShortcuts(base));
  }, [base]);

  const pinAndRefresh = React.useCallback(
    (emoji) => {
      const next = pinReactionShortcut(emoji, base);
      setReactions(next);
      return next;
    },
    [base]
  );

  return { reactions, pinAndRefresh };
}

function ReactionSummary({ reactionCounts, total }) {
  const activeEntries = Object.entries(reactionCounts || {}).filter(([, count]) => count > 0);
  if (total <= 0 || activeEntries.length === 0) {
    return null;
  }

  const top = activeEntries
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <div className="flex items-center pl-0.5">
        {top.map(([reaction], index) => (
          <span
            key={reaction}
            className={cn(
              'flex h-[18px] w-[18px] items-center justify-center rounded-full',
              'bg-muted/80 text-[11px] leading-none ring-2 ring-card',
              index > 0 && '-ml-1'
            )}
            style={{ zIndex: top.length - index }}
          >
            {reaction}
          </span>
        ))}
      </div>
      <span className="truncate text-xs tabular-nums text-muted-foreground">
        {total.toLocaleString()}
      </span>
    </div>
  );
}

function StatDot() {
  return <span className="text-[10px] leading-none text-muted-foreground/40" aria-hidden>·</span>;
}

export function FeedEngagementBar({
  item,
  commentsCount = 0,
  onComment,
  commentsExpanded = false,
  shareUrl = null,
  insights = null,
  className,
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerMode, setPickerMode] = useState('quick');
  const [popReaction, setPopReaction] = useState(null);
  const hoverCloseTimer = React.useRef(null);
  const hoverOpenTimer = React.useRef(null);
  const longPressTimer = React.useRef(null);
  const longPressTriggered = React.useRef(false);
  const pickerModeRef = React.useRef(pickerMode);
  pickerModeRef.current = pickerMode;
  const defaults = item.available_reactions || DEFAULT_REACTIONS;
  const { reactions, pinAndRefresh } = useShortcutReactions(defaults);
  const reactionCounts = item.reaction_counts || {};
  const myReaction = item.my_reaction?.reaction || null;
  const totalReactions = Object.values(reactionCounts).reduce((sum, n) => sum + (Number(n) || 0), 0);
  const reactMutation = useReactMutation({ item });
  const hasReactions = totalReactions > 0;
  const hasComments = commentsCount > 0;
  const hasInsights = Boolean(insights);
  const showSummary = hasReactions || hasComments || hasInsights;

  const clearHoverTimers = () => {
    if (hoverCloseTimer.current) {
      window.clearTimeout(hoverCloseTimer.current);
      hoverCloseTimer.current = null;
    }
    if (hoverOpenTimer.current) {
      window.clearTimeout(hoverOpenTimer.current);
      hoverOpenTimer.current = null;
    }
  };

  const clearLongPressTimer = () => {
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const closePicker = () => {
    clearHoverTimers();
    setPickerOpen(false);
    setPickerMode('quick');
  };

  const openPicker = () => {
    clearHoverTimers();
    clearLongPressTimer();
    setPickerMode('quick');
    setPickerOpen(true);
  };

  const handlePickerOpenChange = (open) => {
    setPickerOpen(open);
    if (!open) {
      setPickerMode('quick');
    }
  };

  const scheduleOpenPicker = () => {
    // Hover is desktop-only; touch devices use long-press instead.
    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      if (pickerModeRef.current === 'collection') return;
      clearHoverTimers();
      hoverOpenTimer.current = window.setTimeout(() => {
        setPickerMode('quick');
        setPickerOpen(true);
      }, 120);
    }
  };

  const scheduleClosePicker = () => {
    // Collection mode is click-to-dismiss — hover leave must not close it
    // (mode switch remount/resize fires a spurious mouseleave).
    if (pickerModeRef.current === 'collection') return;
    clearHoverTimers();
    hoverCloseTimer.current = window.setTimeout(() => {
      if (pickerModeRef.current === 'collection') return;
      setPickerOpen(false);
      setPickerMode('quick');
    }, 180);
  };

  const openCollection = (event) => {
    event.preventDefault();
    event.stopPropagation();
    clearHoverTimers();
    setPickerMode('collection');
    setPickerOpen(true);
  };

  const applyReaction = (reaction, event) => {
    if (myReaction !== reaction) {
      spawnReactionBurst(reaction, event.clientX, event.clientY, { compact: false });
      setPopReaction(reaction);
    }
    reactMutation.mutate(reaction);
  };

  const handleLikeClick = (event) => {
    event.preventDefault();
    event.stopPropagation();
    // Long-press already opened the picker — don't also toggle Like.
    if (longPressTriggered.current) {
      longPressTriggered.current = false;
      return;
    }
    closePicker();
    if (myReaction === PRIMARY_REACTION) {
      reactMutation.mutate(PRIMARY_REACTION);
      return;
    }
    applyReaction(PRIMARY_REACTION, event);
  };

  const handlePointerDown = (event) => {
    if (event.pointerType === 'mouse') return;
    longPressTriggered.current = false;
    clearLongPressTimer();
    longPressTimer.current = window.setTimeout(() => {
      longPressTriggered.current = true;
      openPicker();
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(12);
      }
    }, 420);
  };

  const handlePointerEnd = () => {
    clearLongPressTimer();
  };

  const handleShare = async () => {
    if (!shareUrl) return;
    try {
      const absolute = new URL(shareUrl, window.location.origin).toString();
      await navigator.clipboard.writeText(absolute);
      toast.success('Link copied.');
    } catch {
      toast.error('Could not copy link.');
    }
  };

  const likeActive = Boolean(myReaction);
  const actionClass = cn(
    'inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-md',
    'text-[13px] font-medium transition-colors hover:bg-muted/50'
  );

  return (
    <div className={cn('mt-1', className)}>
      {showSummary ? (
        <div className="flex items-center justify-between gap-3 px-3 pb-2 pt-1.5 sm:px-4">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <ReactionSummary reactionCounts={reactionCounts} total={totalReactions} />
            {hasReactions && hasInsights ? <StatDot /> : null}
            {insights}
          </div>
          {hasComments ? (
            <button
              type="button"
              onClick={onComment}
              className="shrink-0 text-xs tabular-nums text-muted-foreground transition-colors hover:text-foreground hover:underline"
            >
              {`${commentsCount.toLocaleString()} comment${commentsCount === 1 ? '' : 's'}`}
            </button>
          ) : null}
        </div>
      ) : null}

      <div
        className={cn(
          'mx-3 grid grid-cols-3 rounded-xl border border-border/40 bg-muted/25 pb-0.5 backdrop-blur-sm sm:mx-4',
          !showSummary && 'mt-1'
        )}
      >
        <Popover open={pickerOpen} onOpenChange={handlePickerOpenChange} modal={false}>
          <PopoverAnchor asChild>
            <div
              className="relative border-r border-border/20"
              onMouseEnter={scheduleOpenPicker}
              onMouseLeave={scheduleClosePicker}
            >
              <motion.button
                type="button"
                whileHover={reactionMotion.whileHover}
                whileTap={reactionMotion.whileTap}
                transition={popReaction ? reactionMotion.activePopTransition : reactionMotion.spring}
                animate={popReaction ? { scale: reactionMotion.activePopScale } : { scale: 1 }}
                onAnimationComplete={() => {
                  if (popReaction) setPopReaction(null);
                }}
                onClick={handleLikeClick}
                onPointerDown={handlePointerDown}
                onPointerUp={handlePointerEnd}
                onPointerCancel={handlePointerEnd}
                onPointerLeave={handlePointerEnd}
                onContextMenu={(event) => {
                  event.preventDefault();
                  openPicker();
                }}
                className={cn(
                  actionClass,
                  'touch-manipulation select-none',
                  likeActive ? 'text-primary' : 'text-muted-foreground'
                )}
                title="Tap to like · long-press for more reactions"
                aria-label="Like. Long-press for more reactions"
              >
                {myReaction && myReaction !== PRIMARY_REACTION ? (
                  <span className="text-[15px] leading-none">{myReaction}</span>
                ) : (
                  <ThumbsUp
                    className={cn('h-4 w-4', likeActive && 'fill-current')}
                  />
                )}
                <span>Like</span>
              </motion.button>
            </div>
          </PopoverAnchor>
          <PopoverContent
            align="center"
            side="top"
            sideOffset={8}
            onMouseEnter={() => {
              clearHoverTimers();
              setPickerOpen(true);
            }}
            onMouseLeave={scheduleClosePicker}
            className={cn(
              'z-[200] overflow-hidden p-0 shadow-lg',
              glassDockStyles,
              pickerMode === 'collection'
                ? 'w-auto rounded-2xl'
                : 'w-auto max-w-[calc(100vw-1.5rem)] rounded-full px-1 py-1'
            )}
            onClick={(event) => event.stopPropagation()}
            onOpenAutoFocus={(event) => event.preventDefault()}
            onPointerDownOutside={() => closePicker()}
          >
            {pickerMode === 'collection' ? (
              <EmojiCollectionPanel
                onSelect={(emoji, event) => {
                  pinAndRefresh(emoji);
                  closePicker();
                  applyReaction(emoji, event);
                }}
              />
            ) : (
              <div className="flex items-center gap-0 overflow-x-auto px-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {reactions.map((reaction) => {
                  const isActive = myReaction === reaction;
                  return (
                    <motion.button
                      key={reaction}
                      type="button"
                      whileHover={{ scale: 1.2, y: -3 }}
                      whileTap={reactionMotion.whileTap}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        closePicker();
                        applyReaction(reaction, event);
                      }}
                      className={cn(
                        'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-base leading-none transition-colors sm:h-9 sm:w-9 sm:text-lg',
                        isActive ? 'bg-primary/20' : 'hover:bg-muted/60'
                      )}
                      title={isActive ? 'Remove reaction' : 'React'}
                    >
                      {reaction}
                    </motion.button>
                  );
                })}
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={openCollection}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground sm:h-9 sm:w-9"
                  title="More reactions"
                  aria-label="Open emoji collection"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            )}
          </PopoverContent>
        </Popover>

        <button
          type="button"
          onClick={onComment}
          className={cn(
            actionClass,
            'border-r border-border/20',
            commentsExpanded ? 'text-primary' : 'text-muted-foreground'
          )}
        >
          <MessageCircle className="h-4 w-4" />
          Comment
        </button>

        <button
          type="button"
          onClick={handleShare}
          disabled={!shareUrl}
          className={cn(
            actionClass,
            'text-muted-foreground disabled:pointer-events-none disabled:opacity-40'
          )}
        >
          <Share2 className="h-4 w-4" />
          Share
        </button>
      </div>
    </div>
  );
}

export default function PostReactions({
  item,
  commentId = null,
  postId = null,
  compact = false,
  reactFn = null,
  invalidateKeys = null,
  expHintActionKey = null,
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerMode, setPickerMode] = useState('quick');
  const [popReaction, setPopReaction] = useState(null);
  const isComment = Boolean(commentId);
  const defaults = item.available_reactions || DEFAULT_REACTIONS;
  const { reactions, pinAndRefresh } = useShortcutReactions(defaults);
  const reactionCounts = item.reaction_counts || {};
  const myReaction = item.my_reaction?.reaction || null;
  const activeEntries = Object.entries(reactionCounts).filter(([, count]) => count > 0);
  const reactMutation = useReactMutation({
    item,
    commentId,
    postId,
    reactFn,
    invalidateKeys,
  });

  const closePicker = () => {
    setPickerOpen(false);
    setPickerMode('quick');
  };

  const handlePickerOpenChange = (open) => {
    setPickerOpen(open);
    if (!open) {
      setPickerMode('quick');
    }
  };

  const reactionButton = (reaction, { showCount = false, fromPicker = false } = {}) => {
    const count = reactionCounts[reaction] || 0;
    const isActive = myReaction === reaction;
    const shouldPop = popReaction === reaction;

    return (
      <motion.button
        key={reaction}
        type="button"
        layout
        whileHover={reactionMotion.whileHover}
        whileTap={reactionMotion.whileTap}
        transition={shouldPop ? reactionMotion.activePopTransition : reactionMotion.spring}
        animate={shouldPop ? { scale: reactionMotion.activePopScale } : { scale: 1 }}
        onAnimationComplete={() => {
          if (popReaction === reaction) {
            setPopReaction(null);
          }
        }}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (fromPicker) {
            closePicker();
          }
          if (myReaction !== reaction) {
            spawnReactionBurst(reaction, event.clientX, event.clientY, { compact });
            setPopReaction(reaction);
          }
          reactMutation.mutate(reaction);
        }}
        className={cn(
          'inline-flex items-center gap-1 rounded-full border transition-colors',
          compact ? 'px-1.5 py-0.5 text-xs' : 'px-2.5 py-1 text-sm',
          isActive
            ? 'border-primary/40 bg-primary/10 text-primary'
            : 'border-border/70 bg-background hover:border-primary/30 hover:bg-muted/60'
        )}
        title={isActive ? 'Remove reaction' : 'React'}
      >
        <span>{reaction}</span>
        {showCount && count > 0 ? (
          <span className={cn('font-semibold tabular-nums', compact ? 'text-[10px]' : 'text-[11px]')}>
            {count}
          </span>
        ) : null}
      </motion.button>
    );
  };

  const hintKey = expHintActionKey || (!isComment && !reactFn ? 'feed_react' : null);

  return (
    <div
      className={cn('flex flex-wrap items-center', compact ? 'gap-1' : 'gap-1 md:gap-1.5')}
      onClick={(event) => event.stopPropagation()}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        {activeEntries.map(([reaction]) => (
          <motion.div
            key={reaction}
            initial={reactionMotion.chipEnter.initial}
            animate={reactionMotion.chipEnter.animate}
            exit={reactionMotion.chipEnter.exit}
            transition={reactionMotion.chipEnter.transition}
            className="inline-flex"
          >
            {reactionButton(reaction, { showCount: true })}
          </motion.div>
        ))}
      </AnimatePresence>
      <Popover open={pickerOpen} onOpenChange={handlePickerOpenChange} modal={false}>
        <PopoverTrigger asChild>
          <motion.button
            type="button"
            whileHover={reactionMotion.whileHover}
            whileTap={reactionMotion.whileTap}
            transition={reactionMotion.spring}
            className={cn(
              'inline-flex items-center justify-center gap-1 rounded-full border border-border/70 bg-background text-muted-foreground transition-colors hover:border-primary/30 hover:bg-muted/60 hover:text-primary',
              compact ? 'h-6 min-w-6 px-1.5' : 'h-8 min-w-8 px-2',
              myReaction && !activeEntries.some(([emoji]) => emoji === myReaction) && 'border-primary/30 bg-primary/5 text-primary'
            )}
            title={myReaction ? 'Change reaction' : 'Add reaction'}
            onClick={(event) => event.stopPropagation()}
          >
            {myReaction && !activeEntries.some(([emoji]) => emoji === myReaction) ? (
              myReaction
            ) : (
              <SmilePlus className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
            )}
          </motion.button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          side="top"
          sideOffset={8}
          className={cn(
            'z-[200] overflow-hidden p-0 shadow-lg',
            glassDockStyles,
            pickerMode === 'collection'
              ? 'w-auto rounded-2xl'
              : 'w-auto max-w-[calc(100vw-1.5rem)] rounded-full px-1.5 py-1.5'
          )}
          onClick={(event) => event.stopPropagation()}
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          {pickerMode === 'collection' ? (
            <EmojiCollectionPanel
              onSelect={(emoji, event) => {
                pinAndRefresh(emoji);
                closePicker();
                if (myReaction !== emoji) {
                  spawnReactionBurst(emoji, event?.clientX, event?.clientY, { compact });
                  setPopReaction(emoji);
                }
                reactMutation.mutate(emoji);
              }}
            />
          ) : (
            <div className="flex flex-wrap items-center gap-1.5">
              {reactions.map((reaction) => reactionButton(reaction, { fromPicker: true }))}
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setPickerMode('collection');
                }}
                className={cn(
                  'inline-flex items-center justify-center rounded-full border border-dashed border-border/70 bg-background text-muted-foreground transition-colors hover:border-primary/30 hover:bg-muted/60 hover:text-primary',
                  compact ? 'h-6 min-w-6 px-1.5' : 'h-8 min-w-8 px-2'
                )}
                title="More reactions"
                aria-label="Open emoji collection"
              >
                <Plus className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
              </button>
            </div>
          )}
        </PopoverContent>
      </Popover>
      {hintKey ? <ExpActionHint actionKey={hintKey} compact /> : null}
    </div>
  );
}
