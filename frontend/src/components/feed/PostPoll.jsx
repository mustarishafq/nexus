import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, Loader2, Plus, SquareStack, Vote } from 'lucide-react';
import { toast } from 'sonner';
import db from '@/api/apiClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

function patchFeedItem(queryClient, nextItem) {
  if (!nextItem?.id) return;

  queryClient.setQueriesData({ queryKey: ['company-feed'] }, (current) => {
    if (!current || !Array.isArray(current.items)) return current;
    return {
      ...current,
      items: current.items.map((entry) => (
        entry?.type === 'post' && String(entry.id) === String(nextItem.id)
          ? { ...entry, ...nextItem }
          : entry
      )),
    };
  });

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

export default function PostPoll({ postId, poll, disabled = false }) {
  const queryClient = useQueryClient();
  const [draftOption, setDraftOption] = useState('');

  const voteMutation = useMutation({
    mutationFn: (optionId) => db.feed.voteOnPoll(postId, poll.id, optionId),
    onSuccess: (payload) => {
      if (payload?.item) {
        patchFeedItem(queryClient, payload.item);
      }
    },
    onError: (error) => {
      toast.error(error?.message || 'Could not save your vote.');
    },
  });

  const addOptionMutation = useMutation({
    mutationFn: (label) => db.feed.addPollOption(postId, poll.id, label),
    onSuccess: (payload) => {
      setDraftOption('');
      if (payload?.item) {
        patchFeedItem(queryClient, payload.item);
      }
      toast.success('Option added.');
    },
    onError: (error) => {
      toast.error(error?.message || 'Could not add option.');
    },
  });

  if (!poll?.id || !Array.isArray(poll.options) || poll.options.length === 0) {
    return null;
  }

  const allowMultiple = Boolean(poll.allow_multiple);
  const showResults = Boolean(poll.has_voted);
  const totalVotes = Number(poll.total_votes) || 0;
  const busy = voteMutation.isPending || addOptionMutation.isPending || disabled;
  const canAddOptions = Boolean(poll.can_add_options) && !disabled;

  const handleAddOption = () => {
    const label = draftOption.trim();
    if (!label || addOptionMutation.isPending) return;
    addOptionMutation.mutate(label);
  };

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card/60">
      <div className="flex items-center gap-1.5 border-b border-border/60 bg-muted/15 px-2.5 py-1.5">
        {allowMultiple ? (
          <SquareStack className="h-3 w-3 text-primary" />
        ) : (
          <Vote className="h-3 w-3 text-primary" />
        )}
        <p className="text-[11px] font-medium text-foreground">
          {allowMultiple ? 'Multiple choice' : 'Single choice'}
        </p>
        <p className="ml-auto text-[10px] tabular-nums text-muted-foreground">
          {totalVotes === 0
            ? 'No votes yet'
            : `${totalVotes} voter${totalVotes === 1 ? '' : 's'}`}
        </p>
      </div>

      <div className="space-y-1.5 p-2 sm:p-2.5">
        <ul className="space-y-1.5">
          {poll.options.map((option) => {
            const percent = Number(option.percent) || 0;
            const isSelected = Boolean(option.voted);
            const votesCount = Number(option.votes_count) || 0;
            const isBusyOption = voteMutation.isPending && voteMutation.variables === option.id;

            return (
              <li key={option.id}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => voteMutation.mutate(option.id)}
                  aria-pressed={isSelected}
                  className={cn(
                    'group relative w-full overflow-hidden rounded-md border text-left transition-all',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    isSelected
                      ? 'border-primary/55 bg-primary/[0.07]'
                      : 'border-border/80 bg-background/40 hover:border-primary/35 hover:bg-muted/25',
                    busy && !isBusyOption && 'opacity-60'
                  )}
                >
                  {showResults ? (
                    <span
                      aria-hidden
                      className={cn(
                        'absolute inset-y-0 left-0 transition-[width] duration-300 ease-out',
                        isSelected ? 'bg-primary/20' : 'bg-muted/50'
                      )}
                      style={{ width: `${Math.min(percent, 100)}%` }}
                    />
                  ) : null}

                  <span className="relative flex items-center gap-2 px-2.5 py-1.5">
                    <span
                      className={cn(
                        'flex h-3.5 w-3.5 shrink-0 items-center justify-center border transition-colors',
                        allowMultiple ? 'rounded-[3px]' : 'rounded-full',
                        isSelected
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-muted-foreground/45 bg-background/80 group-hover:border-primary/50'
                      )}
                    >
                      {isSelected ? <Check className="h-2.5 w-2.5 stroke-[3]" /> : null}
                    </span>

                    <span className="min-w-0 flex-1 text-[13px] font-medium leading-snug text-foreground">
                      {option.label}
                    </span>

                    {isBusyOption ? (
                      <Loader2 className="h-3 w-3 shrink-0 animate-spin text-muted-foreground" />
                    ) : showResults ? (
                      <span className="flex shrink-0 items-baseline gap-1 tabular-nums">
                        <span className="text-xs font-semibold text-foreground">{percent}%</span>
                        <span className="text-[10px] text-muted-foreground">{votesCount}</span>
                      </span>
                    ) : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        {canAddOptions ? (
          <div className="flex items-center gap-0 overflow-hidden rounded-md border border-dashed border-border/80 bg-muted/10 focus-within:border-primary/35">
            <Input
              value={draftOption}
              onChange={(event) => setDraftOption(event.target.value)}
              placeholder="Suggest an option..."
              maxLength={120}
              disabled={busy}
              className="h-8 flex-1 border-0 bg-transparent px-2.5 text-xs shadow-none focus-visible:ring-0"
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  handleAddOption();
                }
              }}
            />
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 shrink-0 gap-1 rounded-none border-l border-border/80 px-2.5 text-[11px] font-medium text-primary hover:bg-primary/10 hover:text-primary"
              disabled={busy || !draftOption.trim()}
              onClick={handleAddOption}
            >
              {addOptionMutation.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Plus className="h-3 w-3" />
              )}
              Add
            </Button>
          </div>
        ) : null}

        <p className="text-[10px] leading-snug text-muted-foreground">
          {allowMultiple ? 'Select one or more.' : 'Choose one.'}
          {showResults ? ' Tap again to change.' : null}
        </p>
      </div>
    </div>
  );
}
