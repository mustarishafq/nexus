import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { SmilePlus } from 'lucide-react';
import db from '@/api/apiClient';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';

const DEFAULT_REACTIONS = ['👍', '❤️', '👏', '🎉', '😂', '🔥'];

export default function PostReactions({
  item,
  commentId = null,
  postId = null,
  compact = false,
  reactFn = null,
  invalidateKeys = null,
}) {
  const queryClient = useQueryClient();
  const [pickerOpen, setPickerOpen] = useState(false);
  const isComment = Boolean(commentId);
  const reactions = item.available_reactions || DEFAULT_REACTIONS;
  const reactionCounts = item.reaction_counts || {};
  const myReaction = item.my_reaction?.reaction || null;
  const activeEntries = Object.entries(reactionCounts).filter(([, count]) => count > 0);

  const reactMutation = useMutation({
    mutationFn: (reaction) => {
      if (reactFn) {
        return reactFn(reaction);
      }

      return isComment
        ? db.feed.reactToComment(commentId, reaction)
        : db.feed.reactToPost(item.id, reaction);
    },
    onSuccess: () => {
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
      }
    },
    onError: (error) => {
      toast.error(error?.message || 'Failed to update reaction.');
    },
  });

  const reactionButton = (reaction, { showCount = false, fromPicker = false } = {}) => {
    const count = reactionCounts[reaction] || 0;
    const isActive = myReaction === reaction;

    return (
      <button
        key={reaction}
        type="button"
        disabled={reactMutation.isPending}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (fromPicker) {
            setPickerOpen(false);
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
      </button>
    );
  };

  return (
    <div
      className={cn('flex flex-wrap items-center', compact ? 'gap-1' : 'gap-1 md:gap-1.5')}
      onClick={(event) => event.stopPropagation()}
    >
      {activeEntries.map(([reaction]) => reactionButton(reaction, { showCount: true }))}
      <Popover open={pickerOpen} onOpenChange={setPickerOpen} modal={false}>
        <PopoverTrigger asChild>
          <button
            type="button"
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
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="z-[200] w-auto p-2" onClick={(event) => event.stopPropagation()}>
          <div className="flex flex-wrap gap-1.5">
            {reactions.map((reaction) => reactionButton(reaction, { fromPicker: true }))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
