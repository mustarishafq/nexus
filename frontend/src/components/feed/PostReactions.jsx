import React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { SmilePlus } from 'lucide-react';
import db from '@/api/apiClient';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const DEFAULT_REACTIONS = ['👍', '❤️', '👏', '🎉', '😂', '🔥'];

export default function PostReactions({ item }) {
  const queryClient = useQueryClient();
  const reactions = item.available_reactions || DEFAULT_REACTIONS;
  const reactionCounts = item.reaction_counts || {};
  const myReaction = item.my_reaction?.reaction || null;
  const activeEntries = Object.entries(reactionCounts).filter(([, count]) => count > 0);

  const reactMutation = useMutation({
    mutationFn: (reaction) => db.feed.reactToPost(item.id, reaction),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-feed'] });
    },
  });

  const reactionButton = (reaction, { showCount = false } = {}) => {
    const count = reactionCounts[reaction] || 0;
    const isActive = myReaction === reaction;

    return (
      <button
        key={reaction}
        type="button"
        disabled={reactMutation.isPending}
        onClick={() => reactMutation.mutate(reaction)}
        className={cn(
          'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-sm transition-colors',
          isActive
            ? 'border-primary/40 bg-primary/10 text-primary'
            : 'border-border/70 bg-background hover:border-primary/30 hover:bg-muted/60'
        )}
        title={isActive ? 'Remove reaction' : 'React'}
      >
        <span>{reaction}</span>
        {showCount && count > 0 ? <span className="text-[11px] font-semibold tabular-nums">{count}</span> : null}
      </button>
    );
  };

  return (
    <div className="flex flex-wrap items-center gap-1 md:gap-1.5">
      {activeEntries.map(([reaction]) => reactionButton(reaction, { showCount: true }))}
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              'inline-flex h-8 min-w-8 items-center justify-center gap-1 rounded-full border border-border/70 bg-background px-2 text-muted-foreground transition-colors hover:border-primary/30 hover:bg-muted/60 hover:text-primary',
              myReaction && !activeEntries.some(([emoji]) => emoji === myReaction) && 'border-primary/30 bg-primary/5 text-primary'
            )}
            title={myReaction ? 'Change reaction' : 'Add reaction'}
          >
            {myReaction && !activeEntries.some(([emoji]) => emoji === myReaction) ? (
              myReaction
            ) : (
              <SmilePlus className="h-4 w-4" />
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-2">
          <div className="flex flex-wrap gap-1.5">{reactions.map((reaction) => reactionButton(reaction))}</div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
