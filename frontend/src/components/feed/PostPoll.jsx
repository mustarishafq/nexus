import React, { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import confetti from 'canvas-confetti';
import { Check, HelpCircle, Loader2, Plus, SquareStack, Vote, X } from 'lucide-react';
import { toast } from 'sonner';
import db from '@/api/apiClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { notifyGamificationOffers } from '@/lib/gamification';
import {
  applyPollVoteOptimistic,
  cancelQueryMatches,
  patchFeedItem,
  restoreQueryMatches,
  snapshotQueryMatches,
  updateFeedItem,
} from '@/lib/feedCache';
import { cn } from '@/lib/utils';

const FEED_KEYS = [['company-feed'], ['user-feed'], ['feed-active-discussions']];
const ButtonAny = /** @type {any} */ (Button);
const InputAny = /** @type {any} */ (Input);

/**
 * @param {{
 *  postId: number|string,
 *  poll: any,
 *  disabled?: boolean,
 *  isAuthor?: boolean
 * }} props
 */
export default function PostPoll({ postId, poll, disabled = false, isAuthor = false }) {
  const queryClient = useQueryClient();
  const [draftOption, setDraftOption] = useState('');
  const [previewGrading, setPreviewGrading] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const optionButtonRefs = useRef(new Map());
  const pendingClickEffectRef = useRef(false);

  const voteMutation = /** @type {any} */ (useMutation({
    mutationFn: (optionId) => db.feed.voteOnPoll(postId, poll.id, optionId),
    onMutate: async (optionId) => {
      await cancelQueryMatches(queryClient, FEED_KEYS);
      const snapshots = snapshotQueryMatches(queryClient, FEED_KEYS);
      updateFeedItem(queryClient, postId, (/** @type {any} */ item) => (
        applyPollVoteOptimistic(item, poll.id, optionId)
      ));
      return { snapshots };
    },
    onSuccess: (payload) => {
      notifyGamificationOffers(payload);
      if (payload?.item) {
        patchFeedItem(queryClient, payload.item);
      }
    },
    onError: (error, _optionId, context) => {
      pendingClickEffectRef.current = false;
      if (context?.snapshots) {
        restoreQueryMatches(queryClient, context.snapshots);
      }
      toast.error(error?.message || 'Could not save your vote.');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['company-feed'] });
      queryClient.invalidateQueries({ queryKey: ['user-feed'] });
      queryClient.invalidateQueries({ queryKey: ['feed-active-discussions'] });
    },
  }));

  const addOptionMutation = /** @type {any} */ (useMutation({
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
  }));

  const isQna = Boolean(poll?.is_qna);
  const allowMultiple = Boolean(poll?.allow_multiple);
  const hasVoted = Boolean(poll?.has_voted);
  const voteLocked = isQna && hasVoted;
  const showCorrect = poll?.correct_option_id != null;
  const myOptionId = poll?.my_option_id != null ? Number(poll.my_option_id) : null;
  const correctOptionId = poll?.correct_option_id != null ? Number(poll.correct_option_id) : null;
  // Authors can monitor results without voting; others must vote first.
  const showResults = hasVoted || Boolean(isAuthor);
  const canPreviewGrading = isQna && Boolean(isAuthor) && !hasVoted && showCorrect;
  const showGrading = isQna && showCorrect && (hasVoted || (Boolean(isAuthor) && previewGrading));
  const totalVotes = Number(poll?.total_votes) || 0;
  const busy = voteMutation.isPending || addOptionMutation.isPending || disabled;
  const canAddOptions = Boolean(poll?.can_add_options) && !disabled && !isQna;

  useEffect(() => {
    setPreviewGrading(false);
    pendingClickEffectRef.current = false;
  }, [poll?.id]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduceMotion(mediaQuery.matches);
    update();
    mediaQuery.addEventListener('change', update);
    return () => mediaQuery.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (!pendingClickEffectRef.current) return;
    if (!isQna || !hasVoted || !showGrading || reduceMotion) return;
    if (myOptionId == null || correctOptionId == null) return;

    pendingClickEffectRef.current = false;

    if (myOptionId === correctOptionId) {
      confetti({
        particleCount: 70,
        spread: 65,
        origin: { y: 0.65 },
        ticks: 60,
      });
      return;
    }

    const target = optionButtonRefs.current.get(myOptionId);
    if (target?.animate) {
      target.animate(
        [
          { transform: 'translateX(0)' },
          { transform: 'translateX(-6px)' },
          { transform: 'translateX(5px)' },
          { transform: 'translateX(-4px)' },
          { transform: 'translateX(0)' },
        ],
        { duration: 280, easing: 'ease-out' }
      );
    }
  }, [correctOptionId, hasVoted, isQna, myOptionId, reduceMotion, showGrading]);

  if (!poll?.id || !Array.isArray(poll.options) || poll.options.length === 0) {
    return null;
  }

  const handleAddOption = () => {
    const label = draftOption.trim();
    if (!label || addOptionMutation.isPending) return;
    addOptionMutation.mutate(label);
  };

  /** @param {number|string} optionId */
  const handleVote = (optionId) => {
    if (busy || voteLocked) return;
    if (isQna) pendingClickEffectRef.current = true;
    voteMutation.mutate(optionId);
  };

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card/60">
      <div className="flex items-center gap-1.5 border-b border-border/60 bg-muted/15 px-2.5 py-1.5">
        {isQna ? (
          <HelpCircle className="h-3 w-3 text-primary" />
        ) : allowMultiple ? (
          <SquareStack className="h-3 w-3 text-primary" />
        ) : (
          <Vote className="h-3 w-3 text-primary" />
        )}
        <p className="text-[11px] font-medium text-foreground">
          {isQna ? 'Question' : allowMultiple ? 'Multiple choice' : 'Single choice'}
        </p>
        {canPreviewGrading ? (
          <ButtonAny
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setPreviewGrading((current) => !current)}
            className="h-5 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
          >
            {previewGrading ? 'Hide grading' : 'Preview grading'}
          </ButtonAny>
        ) : null}
        <p className="ml-auto text-[10px] tabular-nums text-muted-foreground">
          {totalVotes === 0
            ? 'No votes yet'
            : `${totalVotes} voter${totalVotes === 1 ? '' : 's'}`}
        </p>
      </div>

      <div className="space-y-1.5 p-2 sm:p-2.5">
        <ul className="space-y-1.5">
          {poll.options.map((/** @type {any} */ option) => {
            const percent = Number(option.percent) || 0;
            const isSelected = Boolean(option.voted);
            const isCorrect = showCorrect && Number(option.id) === correctOptionId;
            const isCorrectOption = showGrading && isCorrect;
            const isWrongSelection = showGrading && isSelected && !isCorrect;
            const votesCount = Number(option.votes_count) || 0;
            const isBusyOption = voteMutation.isPending && voteMutation.variables === option.id;

            return (
              <li key={option.id}>
                <button
                  type="button"
                  disabled={busy || voteLocked}
                  ref={(element) => {
                    if (element) optionButtonRefs.current.set(Number(option.id), element);
                    else optionButtonRefs.current.delete(Number(option.id));
                  }}
                  onClick={() => handleVote(option.id)}
                  aria-pressed={isSelected}
                  className={cn(
                    'group relative w-full overflow-hidden rounded-md border text-left transition-all',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    showResults || showGrading
                      ? isCorrectOption
                        ? 'border-emerald-500/65 bg-transparent'
                        : isWrongSelection
                          ? 'border-rose-500/65 bg-transparent'
                          : isSelected
                            ? 'border-primary/55 bg-transparent'
                            : 'border-border/80 bg-transparent hover:border-primary/35'
                      : isSelected
                        ? 'border-primary/55 bg-primary/[0.07]'
                        : 'border-border/80 bg-background/40 hover:border-primary/35 hover:bg-muted/25',
                    (busy || voteLocked) && !isBusyOption && 'opacity-60'
                  )}
                >
                  {showResults || showGrading ? (
                    <>
                      <span
                        aria-hidden
                        className="absolute inset-0 bg-muted/20 dark:bg-muted/35"
                      />
                      <span
                        aria-hidden
                        className={cn(
                          'absolute inset-y-0 left-0 transition-[width] duration-300 ease-out',
                          isCorrectOption
                            ? 'bg-emerald-500/25 dark:bg-emerald-500/35'
                            : isWrongSelection
                              ? 'bg-rose-500/25 dark:bg-rose-500/35'
                              : isSelected
                              ? 'bg-primary/25 dark:bg-primary/35'
                              : 'bg-foreground/[0.06] dark:bg-foreground/12'
                        )}
                        style={{ width: `${Math.min(percent, 100)}%` }}
                      />
                    </>
                  ) : null}

                  <span className="relative flex items-center gap-2 px-2.5 py-1.5">
                    <span
                      className={cn(
                        'flex h-3.5 w-3.5 shrink-0 items-center justify-center border transition-colors',
                        allowMultiple ? 'rounded-[3px]' : 'rounded-full',
                        isCorrectOption
                          ? 'border-emerald-500 bg-emerald-500 text-white'
                          : isWrongSelection
                            ? 'border-rose-500 bg-rose-500 text-white'
                            : isSelected
                              ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-muted-foreground/45 bg-background/80 group-hover:border-primary/50'
                      )}
                    >
                      {isWrongSelection
                        ? <X className="h-2.5 w-2.5 stroke-[3]" />
                        : (isSelected || isCorrectOption)
                          ? <Check className="h-2.5 w-2.5 stroke-[3]" />
                          : null}
                    </span>

                    <span className="min-w-0 flex-1 text-[13px] font-medium leading-snug text-foreground">
                      {option.label}
                    </span>

                    {isBusyOption ? (
                      <Loader2 className="h-3 w-3 shrink-0 animate-spin text-muted-foreground" />
                    ) : (
                      <span className="flex shrink-0 items-baseline gap-1.5 tabular-nums">
                        {isCorrectOption ? (
                          <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">Correct</span>
                        ) : null}
                        {isWrongSelection ? (
                          <span className="text-[10px] font-medium text-rose-600 dark:text-rose-400">Your answer</span>
                        ) : null}
                        {showResults || showGrading ? (
                          <>
                            <span className="text-xs font-semibold text-foreground">{percent}%</span>
                            <span className="text-[10px] text-muted-foreground">{votesCount}</span>
                          </>
                        ) : null}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        {canAddOptions ? (
          <div className="flex items-center gap-0 overflow-hidden rounded-md border border-dashed border-border/80 bg-muted/10 focus-within:border-primary/35">
            <InputAny
              value={draftOption}
              onChange={(/** @type {any} */ event) => setDraftOption(event.target.value)}
              placeholder="Suggest an option..."
              maxLength={120}
              disabled={busy}
              className="h-8 flex-1 border-0 bg-transparent px-2.5 text-xs shadow-none focus-visible:ring-0"
              onKeyDown={(/** @type {any} */ event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  handleAddOption();
                }
              }}
            />
            <ButtonAny
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
            </ButtonAny>
          </div>
        ) : null}

        <p className="text-[10px] leading-snug text-muted-foreground">
          {isQna
            ? (hasVoted
              ? 'The correct answer is shown. Your vote cannot be changed.'
              : canPreviewGrading
                ? 'Choose one. Your vote cannot be changed. Use preview to see grading colors.'
              : 'Choose one. Your vote cannot be changed.')
            : allowMultiple
              ? 'Select one or more.'
              : 'Choose one.'}
          {!isQna && showResults ? ' Tap again to change.' : null}
        </p>
      </div>
    </div>
  );
}
