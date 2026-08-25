import React, { startTransition, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { Camera, Check, ChevronDown, Globe2, ImageIcon, ListChecks, Loader2, Megaphone, MoreHorizontal, Pencil, Plus, RotateCcw, Send, SendHorizontal, Trash2, X } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import db from '@/api/apiClient';
import UserAvatar from '@/components/users/UserAvatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import FeedTextEditor from '@/components/feed/FeedTextEditor';
import EmojiCollectionPicker from '@/components/feed/EmojiCollectionPicker';
import MentionInput from '@/components/feed/MentionInput';
import MentionText from '@/components/feed/MentionText';
import PostEditHistory from '@/components/feed/PostEditHistory';
import PostInsights, { useMarkPostSeen } from '@/components/feed/PostInsights';
import PostPoll from '@/components/feed/PostPoll';
import PostReactions, { FeedEngagementBar } from '@/components/feed/PostReactions';
import PostImageGrid from '@/components/feed/PostImageGrid';
import { Expandable } from '@/components/ui/expandable';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from '@/components/ui/drawer';
import { toast } from 'sonner';
import { notifyGamificationOffers } from '@/lib/gamification';
import ExpActionHint from '@/components/gamification/ExpActionHint';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  flattenCommentReplies,
  INITIAL_VISIBLE_COMMENTS,
  INITIAL_VISIBLE_COMMENTS_SHEET,
  INITIAL_VISIBLE_REPLIES,
  takeNewest,
} from '@/lib/comments';
import { buildMentionToken } from '@/lib/mentions';
import { getDisplayName } from '@/lib/profile';
import { useAuth } from '@/lib/AuthContext';
import { isEmptyRichText, stripHtml } from '@/lib/richText';
import { cn } from '@/lib/utils';
import { feedPostElementId, feedPostPath, feedPostShareUrl } from '@/lib/feedLinks';
import {
  compressImageFile,
  POST_IMAGE_MAX_BYTES,
  POST_IMAGE_SOURCE_MAX_BYTES,
} from '@/lib/media';
import {
  bumpFeedCommentsCount,
  cancelQueryMatches,
  insertOptimisticComment,
  patchFeedItem,
  prependFeedItem,
  removeCommentFromTree,
  removeFeedItem,
  replaceCommentInTree,
  replaceFeedItem,
  restoreQueryMatches,
  snapshotQueryMatches,
} from '@/lib/feedCache';

const MAX_POST_IMAGES = 10;
const MAX_POLL_OPTIONS = 6;
const MAX_POLL_OPTIONS_EDIT = 12;
const MIN_POLL_OPTIONS = 2;
const MAX_POLLS_PER_POST = 3;

function pollsFromItem(item) {
  if (Array.isArray(item?.polls) && item.polls.length > 0) return item.polls;
  if (item?.poll) return [item.poll];
  return [];
}

function emptyPollDraft(key = `poll-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`) {
  return {
    key,
    id: null,
    options: [
      { key: `${key}-0`, id: null, label: '' },
      { key: `${key}-1`, id: null, label: '' },
    ],
    allowMultiple: false,
    allowAddOptions: false,
    isQna: false,
    correctOptionKey: null,
  };
}

function pollDraftFromItem(poll, keyPrefix = 'poll') {
  if (!poll || !Array.isArray(poll.options)) {
    return emptyPollDraft(keyPrefix);
  }

  const options = poll.options.map((option, index) => ({
    key: `opt-${option.id ?? index}`,
    id: option.id ?? null,
    label: option.label || '',
  }));
  const correctId = poll.correct_option_id != null ? Number(poll.correct_option_id) : null;
  const correctOption = correctId != null
    ? options.find((option) => Number(option.id) === correctId)
    : null;

  return {
    key: `${keyPrefix}-${poll.id ?? 'new'}`,
    id: poll.id ?? null,
    options,
    allowMultiple: Boolean(poll.allow_multiple),
    allowAddOptions: Boolean(poll.allow_add_options),
    isQna: Boolean(poll.is_qna),
    correctOptionKey: correctOption?.key ?? null,
  };
}

function pollDraftsFromItem(item) {
  return pollsFromItem(item).map((poll, index) => pollDraftFromItem(poll, `poll-${index}`));
}

function serializePollDraft(draft) {
  const cleaned = [];
  const seen = new Set();

  (draft.options || []).forEach((option) => {
    const label = String(option.label || '').trim();
    if (!label || seen.has(label)) return;
    seen.add(label);
    cleaned.push({
      id: option.id || undefined,
      label,
      key: option.key,
    });
  });

  const isQna = Boolean(draft.isQna);
  const markedIndex = isQna
    ? cleaned.findIndex((option) => option.key === draft.correctOptionKey)
    : -1;

  return {
    options: cleaned.map(({ id, label }) => ({ id, label })),
    allow_multiple: isQna ? false : Boolean(draft.allowMultiple),
    allow_add_options: isQna ? false : Boolean(draft.allowAddOptions),
    is_qna: isQna,
    correct_option_index: markedIndex >= 0 ? markedIndex : null,
  };
}

function isPollDraftValid(draft) {
  const payload = serializePollDraft(draft);
  if (payload.options.length < MIN_POLL_OPTIONS) return false;
  if (payload.is_qna && payload.correct_option_index == null) return false;
  return true;
}

function pollDraftIssue(draft) {
  const payload = serializePollDraft(draft);
  if (payload.options.length < MIN_POLL_OPTIONS) {
    return `Each poll needs at least ${MIN_POLL_OPTIONS} options.`;
  }
  if (payload.is_qna && payload.correct_option_index == null) {
    return 'QnA polls need one correct option.';
  }
  return null;
}

function pollDraftUnchanged(poll, draft) {
  if (!poll && !draft) return true;
  if (!poll || !draft) return false;
  const current = serializePollDraft(draft);
  const originalLabels = (poll.options || []).map((option) => ({
    id: option.id,
    label: String(option.label || '').trim(),
  }));

  if (Boolean(poll.allow_multiple) !== current.allow_multiple) return false;
  if (Boolean(poll.allow_add_options) !== current.allow_add_options) return false;
  if (Boolean(poll.is_qna) !== current.is_qna) return false;
  if (originalLabels.length !== current.options.length) return false;

  return originalLabels.every((option, index) => (
    Number(option.id) === Number(current.options[index].id || 0)
    && option.label === current.options[index].label
  ));
}

function PollEditorPanel({
  title = 'Poll',
  options,
  onOptionsChange,
  allowMultiple,
  onAllowMultipleChange,
  allowAddOptions,
  onAllowAddOptionsChange,
  isQna = false,
  onIsQnaChange,
  correctOptionKey = null,
  onCorrectOptionKeyChange,
  locked = false,
  disabled = false,
  maxOptions = MAX_POLL_OPTIONS,
  onRemove = null,
}) {
  const fieldsDisabled = disabled || locked;

  const updateOption = (index, value) => {
    if (fieldsDisabled) return;
    onOptionsChange(options.map((option, i) => (
      i === index ? { ...option, label: value } : option
    )));
  };

  const addOption = () => {
    if (fieldsDisabled || options.length >= maxOptions) return;
    onOptionsChange([
      ...options,
      { key: `new-${Date.now()}`, id: null, label: '' },
    ]);
  };

  const removeOption = (index) => {
    if (fieldsDisabled) return;
    const removed = options[index];
    if (removed?.key && removed.key === correctOptionKey) {
      onCorrectOptionKeyChange?.(null);
    }
    if (options.length <= MIN_POLL_OPTIONS) {
      onOptionsChange(options.map((option, i) => (
        i === index ? { ...option, label: '' } : option
      )));
      return;
    }
    onOptionsChange(options.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2 rounded-xl border border-border/70 bg-muted/15 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-sm font-medium">
          <ListChecks className="h-4 w-4 text-primary" />
          {title}
        </div>
        {onRemove ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-muted-foreground"
            onClick={onRemove}
            disabled={disabled}
          >
            Remove
          </Button>
        ) : null}
      </div>
      {options.map((option, index) => (
        <div key={option.key || `poll-option-${index}`} className="flex items-center gap-2">
          {isQna ? (
            <button
              type="button"
              title="Mark as correct"
              aria-pressed={option.key === correctOptionKey}
              disabled={fieldsDisabled || !option.label.trim()}
              onClick={() => onCorrectOptionKeyChange?.(
                option.key === correctOptionKey ? null : option.key
              )}
              className={cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-md border transition-colors',
                option.key === correctOptionKey
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border text-muted-foreground hover:border-primary/50'
              )}
            >
              <Check className="h-3.5 w-3.5" />
            </button>
          ) : null}
          <Input
            value={option.label}
            onChange={(event) => updateOption(index, event.target.value)}
            placeholder={`Option ${index + 1}`}
            maxLength={120}
            disabled={fieldsDisabled}
            className="h-9"
          />
          {!locked ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 text-muted-foreground"
              onClick={() => removeOption(index)}
              disabled={fieldsDisabled || (options.length <= MIN_POLL_OPTIONS && !option.label.trim())}
              title="Remove option"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          ) : null}
        </div>
      ))}
      {!locked && options.length < maxOptions ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 px-2 text-xs text-muted-foreground"
          onClick={addOption}
          disabled={fieldsDisabled}
        >
          <Plus className="h-3.5 w-3.5" />
          Add option
        </Button>
      ) : null}
      {locked ? (
        <p className="text-[11px] leading-snug text-muted-foreground">
          QnA polls cannot be edited after posting. You can still remove this poll.
        </p>
      ) : null}
      <div className="space-y-2 border-t border-border/50 pt-2.5">
        <label className={cn('flex items-start gap-2.5 text-xs text-muted-foreground', fieldsDisabled ? 'cursor-default' : 'cursor-pointer')}>
          <Checkbox
            checked={isQna}
            onCheckedChange={(checked) => onIsQnaChange?.(checked === true)}
            disabled={fieldsDisabled}
            className="mt-0.5"
          />
          <span>
            <span className="font-medium text-foreground">QnA poll</span>
            <span className="mt-0.5 block">Mark one option as correct. After posting, the answer is locked and votes cannot be changed.</span>
          </span>
        </label>
        <label className={cn('flex items-start gap-2.5 text-xs text-muted-foreground', (fieldsDisabled || isQna) ? 'cursor-default' : 'cursor-pointer')}>
          <Checkbox
            checked={allowMultiple}
            onCheckedChange={(checked) => onAllowMultipleChange(checked === true)}
            disabled={fieldsDisabled || isQna}
            className="mt-0.5"
          />
          <span>
            <span className="font-medium text-foreground">Allow multiple choices</span>
            <span className="mt-0.5 block">People can select more than one option</span>
          </span>
        </label>
        <label className={cn('flex items-start gap-2.5 text-xs text-muted-foreground', (fieldsDisabled || isQna) ? 'cursor-default' : 'cursor-pointer')}>
          <Checkbox
            checked={allowAddOptions}
            onCheckedChange={(checked) => onAllowAddOptionsChange(checked === true)}
            disabled={fieldsDisabled || isQna}
            className="mt-0.5"
          />
          <span>
            <span className="font-medium text-foreground">Anyone can add options</span>
            <span className="mt-0.5 block">Colleagues can suggest more answers</span>
          </span>
        </label>
      </div>
    </div>
  );
}

function ExpandablePostBody({ text, className }) {
  const [expanded, setExpanded] = useState(false);
  const plain = stripHtml(text || '');
  const needsClamp = plain.length > 220;

  if (!text) return null;

  return (
    <div className={cn('relative', className)}>
      {/*
        Avoid line-clamp (-webkit-box): it collapses empty TipTap <p>/<br>
        blank lines so editor spacing disappears in the feed. max-height keeps
        block layout (and blank lines) intact while truncated.
      */}
      <div
        className={cn(
          'text-sm leading-relaxed text-foreground/90 break-words',
          needsClamp && !expanded && 'max-h-[4.5rem] overflow-hidden'
        )}
      >
        <MentionText text={text} />
      </div>
      {needsClamp && !expanded ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-0.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover:underline"
        >
          See more
        </button>
      ) : null}
    </div>
  );
}

function BroadcastFeedItem({ item, compact = false }) {
  return (
    <article
      className={cn(
        'overflow-hidden bg-card',
        compact
          ? 'rounded-none border-0 border-b border-border/30 last:border-b-0'
          : 'rounded-lg border border-border/30'
      )}
    >
      <div className={cn('flex items-start gap-2.5', compact ? 'px-3 py-2.5 md:px-4' : 'px-3 py-2.5 sm:px-4')}>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <Megaphone className="h-3.5 w-3.5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold leading-snug">{item.title}</p>
            <Badge variant="outline" className="h-5 text-[10px] capitalize">
              {item.priority || 'announcement'}
            </Badge>
          </div>
          <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
            <span>{formatDistanceToNow(new Date(item.created_date), { addSuffix: true })}</span>
            <span aria-hidden>·</span>
            <Globe2 className="h-3 w-3" />
          </p>
        </div>
      </div>
      {item.message ? (
        <div className="px-3 pb-3 text-sm leading-relaxed text-foreground/90 sm:px-4">
          <MentionText text={item.message} />
        </div>
      ) : null}
    </article>
  );
}

function PostComments({
  postId,
  commentsCount,
  onCollapse,
  compact = false,
  className,
  readOnly = false,
  variant = 'inline',
}) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [commentBody, setCommentBody] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [showAllComments, setShowAllComments] = useState(false);
  const [expandedReplyIds, setExpandedReplyIds] = useState(() => new Set());
  const commentInputRef = useRef(null);
  const replyComposerRef = useRef(null);
  const commentsListRef = useRef(null);
  const isSheet = variant === 'sheet';
  const [sheetListEnter, setSheetListEnter] = useState(true);

  const { data, isLoading } = useQuery({
    queryKey: ['post-comments', postId],
    queryFn: () => db.feed.listComments(postId),
    staleTime: 15_000,
  });

  const createComment = useMutation({
    mutationFn: ({ body, parentCommentId }) => db.feed.createComment(postId, body, parentCommentId),
    onMutate: async ({ body, parentCommentId }) => {
      const queryKeys = [['post-comments', postId], ['company-feed'], ['user-feed'], ['feed-active-discussions']];
      await cancelQueryMatches(queryClient, queryKeys);
      const snapshots = snapshotQueryMatches(queryClient, queryKeys);

      const tempId = `temp-comment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const optimisticComment = {
        id: tempId,
        post_id: postId,
        parent_comment_id: parentCommentId || null,
        body,
        author: {
          id: user?.id,
          name: getDisplayName(user),
          profile_picture: user?.profile_picture,
          profile_picture_crop: user?.profile_picture_crop,
          department: user?.department?.name || user?.department || null,
        },
        created_date: new Date().toISOString(),
        can_delete: true,
        reaction_counts: {},
        my_reaction: null,
        available_reactions: ['👍', '❤️', '👏', '🎉', '😂', '🔥'],
        replies: [],
      };

      const draftBody = commentBody;
      const draftReply = replyingTo;
      setCommentBody('');
      setReplyingTo(null);

      insertOptimisticComment(queryClient, postId, optimisticComment, parentCommentId || null);
      bumpFeedCommentsCount(queryClient, postId, 1);

      if (!parentCommentId && variant === 'sheet') {
        window.requestAnimationFrame(() => {
          const list = commentsListRef.current;
          list?.scrollTo?.({ top: list.scrollHeight, behavior: 'smooth' });
        });
      }

      return { snapshots, tempId, draftBody, draftReply, parentCommentId };
    },
    onSuccess: (payload, variables, context) => {
      if (payload?.comment && context?.tempId) {
        if (variables?.parentCommentId) {
          // Replace temp reply under parent
          replaceCommentInTree(queryClient, postId, context.tempId, payload.comment);
        } else {
          replaceCommentInTree(queryClient, postId, context.tempId, {
            ...payload.comment,
            replies: [],
          });
        }
      }
      notifyGamificationOffers(payload);
      toast.success(variables?.parentCommentId ? 'Reply added.' : 'Comment added.');
    },
    onError: (error, _variables, context) => {
      if (context?.snapshots) {
        restoreQueryMatches(queryClient, context.snapshots);
      }
      if (context?.draftBody != null) {
        setCommentBody(context.draftBody);
      }
      if (context?.draftReply !== undefined) {
        setReplyingTo(context.draftReply);
      }
      toast.error(error?.message || 'Failed to add comment.');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['post-comments', postId] });
      queryClient.invalidateQueries({ queryKey: ['company-feed'] });
      queryClient.invalidateQueries({ queryKey: ['user-feed'] });
    },
  });

  const deleteComment = useMutation({
    mutationFn: (commentId) => db.feed.deleteComment(commentId),
    onMutate: async (commentId) => {
      const queryKeys = [['post-comments', postId], ['company-feed'], ['user-feed'], ['feed-active-discussions']];
      await cancelQueryMatches(queryClient, queryKeys);
      const snapshots = snapshotQueryMatches(queryClient, queryKeys);
      removeCommentFromTree(queryClient, postId, commentId);
      bumpFeedCommentsCount(queryClient, postId, -1);
      return { snapshots };
    },
    onError: (error, _commentId, context) => {
      if (context?.snapshots) {
        restoreQueryMatches(queryClient, context.snapshots);
      }
      toast.error(error?.message || 'Failed to delete comment.');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['post-comments', postId] });
      queryClient.invalidateQueries({ queryKey: ['company-feed'] });
      queryClient.invalidateQueries({ queryKey: ['user-feed'] });
    },
  });

  const comments = Array.isArray(data?.comments) ? data.comments : [];
  const visibleComments = showAllComments
    ? comments
    : takeNewest(comments, isSheet ? INITIAL_VISIBLE_COMMENTS_SHEET : INITIAL_VISIBLE_COMMENTS);
  const hiddenCommentCount = Math.max(0, comments.length - visibleComments.length);

  useEffect(() => {
    if (!isSheet) return undefined;
    if (isLoading) {
      setSheetListEnter(true);
      return undefined;
    }

    setSheetListEnter(true);
    const timer = window.setTimeout(() => setSheetListEnter(false), 560);
    return () => window.clearTimeout(timer);
  }, [isLoading, isSheet]);

  useEffect(() => {
    if (!replyingTo) return undefined;

    const frame = window.requestAnimationFrame(() => {
      const target = isSheet
        ? document.getElementById(`feed-comment-${postId}-${replyingTo.id}`)
        : replyComposerRef.current;
      target?.scrollIntoView?.({
        behavior: 'smooth',
        block: 'nearest',
      });
      commentInputRef.current?.focus?.();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [isSheet, postId, replyingTo]);

  const cancelReply = () => {
    setReplyingTo(null);
  };

  const startReply = (comment, { isReply = false } = {}) => {
    setReplyingTo({
      id: comment.id,
      name: getDisplayName(comment.author),
    });

    // Facebook-style: mention the person when replying to a reply (flat thread).
    if (isReply && comment.author?.id) {
      const token = `${buildMentionToken(comment.author)} `;
      setCommentBody((prev) => {
        const mention = buildMentionToken(comment.author);
        if (prev.includes(mention)) return prev;
        return `${token}${prev}`;
      });
    }
  };

  const submitComment = (event) => {
    event.preventDefault();
    const body = commentBody.trim();
    if (!body) return;
    createComment.mutate({
      body,
      parentCommentId: replyingTo?.id || null,
    });
  };

  const renderComposer = ({ inline = false, sticky = false } = {}) => (
    <form
      ref={inline ? replyComposerRef : undefined}
      className={cn(
        inline
          ? 'mt-2 rounded-xl bg-background/70 p-2 ring-1 ring-border/50'
          : sticky
            ? cn(
                'shrink-0 border-t border-border/50 bg-background px-3 pt-2 pb-[max(0.5rem,var(--nexus-safe-bottom))]',
                sheetListEnter && 'comments-sheet-composer-enter'
              )
            : 'mb-2.5 border-b border-border/50 pb-2.5 md:mb-3 md:pb-3'
      )}
      onSubmit={submitComment}
    >
      {replyingTo ? (
        <div className="mb-2 flex items-center gap-2 px-0.5 text-[11px] text-muted-foreground">
          <span className="min-w-0 flex-1 truncate">
            Replying to{' '}
            <span className="font-medium text-foreground" title={replyingTo.name}>
              {replyingTo.name}
            </span>
          </span>
          <button
            type="button"
            onClick={cancelReply}
            className="shrink-0 font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Cancel
          </button>
        </div>
      ) : null}
      <div className="flex items-end gap-1.5 md:gap-2">
        {sticky ? (
          <UserAvatar user={user} className="mb-0.5 h-8 w-8 shrink-0" fallbackClassName="text-[10px]" />
        ) : null}
        <div className="relative min-w-0 flex-1">
          <MentionInput
            ref={commentInputRef}
            value={commentBody}
            onChange={setCommentBody}
            placeholder={replyingTo ? 'Write a reply...' : 'Write a comment...'}
            rows={1}
            maxLength={1000}
            className="min-h-9 overflow-x-hidden pr-10 text-sm shadow-none md:min-h-10 md:pr-11"
            placeholderClassName="!right-10 md:!right-11"
          />
          <div className="absolute inset-y-0 right-0.5 flex items-center">
            <EmojiCollectionPicker
              disabled={createComment.isPending}
              triggerClassName="h-8 w-8 md:h-9 md:w-9"
              onSelect={(emoji) => {
                commentInputRef.current?.insertText(emoji);
              }}
            />
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {!replyingTo ? <ExpActionHint actionKey="feed_comment" compact /> : null}
          <Button
            type="submit"
            size="icon"
            className="h-9 w-9 shrink-0 md:h-10 md:w-10"
            disabled={createComment.isPending || !commentBody.trim()}
            title={replyingTo ? 'Post reply' : 'Post comment'}
          >
            {createComment.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </form>
  );

  const expandReplies = (commentId) => {
    setExpandedReplyIds((current) => {
      const next = new Set(current);
      next.add(commentId);
      return next;
    });
  };

  const renderComment = (comment, { isReply = false } = {}) => {
    const nestedReplies = !isReply ? flattenCommentReplies(comment.replies) : [];
    const repliesExpanded = expandedReplyIds.has(comment.id);
    const visibleReplies = repliesExpanded
      ? nestedReplies
      : takeNewest(nestedReplies, INITIAL_VISIBLE_REPLIES);
    const hiddenReplyCount = Math.max(0, nestedReplies.length - visibleReplies.length);
    const isActiveReply = replyingTo?.id === comment.id;

    return (
      <div key={comment.id} id={`feed-comment-${postId}-${comment.id}`} className="flex gap-2 md:gap-2.5">
        <Link to={`/people/${comment.author?.id}`} className="shrink-0">
          <UserAvatar
            user={comment.author}
            className={cn(isReply ? 'h-6 w-6 md:h-7 md:w-7' : 'h-7 w-7 md:h-8 md:w-8')}
            fallbackClassName="text-[10px]"
          />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="rounded-2xl bg-muted/60 px-2.5 py-2 md:px-3">
            {/* Mobile: header row + body below for more horizontal room */}
            <div className="md:hidden">
              <div className="flex items-start justify-between gap-1.5">
                <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">
                  <Link
                    to={`/people/${comment.author?.id}`}
                    className="truncate text-xs font-semibold hover:text-primary hover:underline"
                  >
                    {getDisplayName(comment.author)}
                  </Link>
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    {formatDistanceToNow(new Date(comment.created_date), { addSuffix: true })}
                  </span>
                </div>
                {comment.can_delete && !readOnly ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => deleteComment.mutate(comment.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                ) : null}
              </div>
              <div className="mt-1 text-sm leading-relaxed break-words">
                <MentionText text={comment.body} />
              </div>
            </div>

            {/* Tablet/desktop: original side-by-side layout */}
            <div className="hidden md:flex md:items-start md:justify-between md:gap-2">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <Link
                    to={`/people/${comment.author?.id}`}
                    className="text-xs font-semibold hover:text-primary hover:underline"
                  >
                    {getDisplayName(comment.author)}
                  </Link>
                  <span className="text-[10px] text-muted-foreground">
                    {formatDistanceToNow(new Date(comment.created_date), { addSuffix: true })}
                  </span>
                </div>
                <div className="mt-1 text-sm leading-relaxed">
                  <MentionText text={comment.body} />
                </div>
              </div>
              {comment.can_delete && !readOnly ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => deleteComment.mutate(comment.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              ) : null}
            </div>
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-2 px-1">
            <PostReactions item={comment} commentId={comment.id} postId={postId} compact disabled={readOnly} />
            {readOnly ? null : (
            <button
              type="button"
              onClick={() => startReply(comment, { isReply })}
              className={cn(
                'text-[11px] font-medium transition-colors',
                isActiveReply
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Reply
            </button>
            )}
          </div>

          {!readOnly && isActiveReply && !isSheet ? renderComposer({ inline: true }) : null}

          {nestedReplies.length > 0 ? (
            <div className="mt-2.5 ml-5 space-y-2.5 border-l border-border/40 pl-2.5 md:ml-7 md:space-y-3 md:pl-3">
              {hiddenReplyCount > 0 ? (
                <button
                  type="button"
                  onClick={() => expandReplies(comment.id)}
                  className="flex items-center gap-1 text-[11px] font-medium text-primary transition-colors hover:underline"
                >
                  <ChevronDown className="h-3 w-3" />
                  View {hiddenReplyCount} more {hiddenReplyCount === 1 ? 'reply' : 'replies'}
                </button>
              ) : null}
              {visibleReplies.map((reply) => renderComment(reply, { isReply: true }))}
            </div>
          ) : null}
        </div>
      </div>
    );
  };

  const commentsList = (
    <div
      ref={isSheet ? commentsListRef : undefined}
      className={cn(
        isSheet
          ? 'min-h-0 flex-1 space-y-2.5 overflow-y-auto overscroll-contain px-3 py-2'
          : 'space-y-2.5 md:space-y-3',
        isSheet && !isLoading && sheetListEnter && 'comments-sheet-list-enter'
      )}
    >
      {isLoading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Loading comments...
        </div>
      ) : comments.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {readOnly ? 'No comments.' : 'No comments yet. Be the first to reply.'}
        </p>
      ) : (
        <>
          {hiddenCommentCount > 0 ? (
            <button
              type="button"
              onClick={() => setShowAllComments(true)}
              className="flex items-center gap-1 text-[11px] font-medium text-primary transition-colors hover:underline"
            >
              <ChevronDown className="h-3 w-3" />
              View {hiddenCommentCount} more comment{hiddenCommentCount === 1 ? '' : 's'}
            </button>
          ) : null}
          {visibleComments.map((comment) => renderComment(comment))}
        </>
      )}
    </div>
  );

  if (isSheet) {
    return (
      <div className={cn('flex min-h-0 flex-1 flex-col', className)}>
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border/50 px-4 py-2.5">
          <p className="text-sm font-semibold text-foreground">
            {commentsCount > 0
              ? `${commentsCount} comment${commentsCount === 1 ? '' : 's'}`
              : 'Comments'}
          </p>
          <DrawerClose asChild>
            <button
              type="button"
              onClick={onCollapse}
              className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Close comments"
            >
              <X className="h-4 w-4" />
            </button>
          </DrawerClose>
        </div>
        {commentsList}
        {!readOnly ? renderComposer({ sticky: true }) : null}
      </div>
    );
  }

  return (
    <div
      className={cn(
        compact
          ? 'mt-2.5'
          : 'mt-2.5',
        className
      )}
    >
      <div className="mb-2.5 flex items-center justify-between gap-2 md:mb-3">
        <p className="text-xs font-semibold text-foreground">
          {commentsCount > 0
            ? `${commentsCount} comment${commentsCount === 1 ? '' : 's'}`
            : 'Comments'}
        </p>
        <button
          type="button"
          onClick={onCollapse}
          className="text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Hide
        </button>
      </div>

      {!readOnly && !replyingTo ? renderComposer() : null}
      {commentsList}
    </div>
  );
}

function CommentsSheetPlaceholder({ commentsCount = 0, readOnly = false }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border/50 px-4 py-2.5">
        <p className="text-sm font-semibold text-foreground">
          {commentsCount > 0
            ? `${commentsCount} comment${commentsCount === 1 ? '' : 's'}`
            : 'Comments'}
        </p>
      </div>
      <div className="min-h-0 flex-1" />
      {readOnly ? null : (
        <div className="shrink-0 border-t border-border/50 px-3 pt-2 pb-[max(0.5rem,var(--nexus-safe-bottom))]">
          <div className="h-9 rounded-md bg-muted/50" />
        </div>
      )}
    </div>
  );
}

function PostFeedItem({ item, compact = false, initialExpanded = false }) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const articleRef = useRef(null);
  const [expanded, setExpanded] = useState(initialExpanded);
  const [sheetReady, setSheetReady] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draftBody, setDraftBody] = useState(item.body || '');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const itemPolls = pollsFromItem(item);
  const [draftPolls, setDraftPolls] = useState(() => pollDraftsFromItem(item));
  const [removedPollIds, setRemovedPollIds] = useState([]);
  const isPending = Boolean(item.is_pending || item.approval_status === 'pending');
  const isDeleted = Boolean(item.is_deleted);
  const isAuthor = Number(user?.id) === Number(item.author?.id);
  const canMarkSeen = !isPending && !isDeleted && !isAuthor && Boolean(item.id);

  useMarkPostSeen({
    postId: item.id,
    enabled: canMarkSeen,
    articleRef,
  });

  useEffect(() => {
    if (initialExpanded) {
      setExpanded(true);
    }
  }, [initialExpanded]);

  useEffect(() => {
    if (!isMobile || !expanded || !item.id) return undefined;
    queryClient.prefetchQuery({
      queryKey: ['post-comments', item.id],
      queryFn: () => db.feed.listComments(item.id),
      staleTime: 15_000,
    });
    const timer = window.setTimeout(() => {
      startTransition(() => setSheetReady(true));
    }, 280);
    return () => window.clearTimeout(timer);
  }, [expanded, isMobile, item.id, queryClient]);

  const prefetchPostComments = () => {
    if (!item.id) return;
    queryClient.prefetchQuery({
      queryKey: ['post-comments', item.id],
      queryFn: () => db.feed.listComments(item.id),
      staleTime: 15_000,
    });
  };

  const handleComment = () => {
    if (isMobile) {
      prefetchPostComments();
      setExpanded(true);
      return;
    }

    setExpanded((current) => {
      if (!current) prefetchPostComments();
      return !current;
    });
  };

  useEffect(() => {
    if (!editing) {
      setDraftBody(item.body || '');
      setDraftPolls(pollDraftsFromItem(item));
      setRemovedPollIds([]);
    }
  }, [item.body, item.polls, item.poll, editing]);

  const beginEditing = () => {
    setDraftBody(item.body || '');
    setDraftPolls(pollDraftsFromItem(item));
    setRemovedPollIds([]);
    setEditing(true);
  };

  const cancelEditing = () => {
    setDraftBody(item.body || '');
    setDraftPolls(pollDraftsFromItem(item));
    setRemovedPollIds([]);
    setEditing(false);
  };

  const deletePost = useMutation({
    mutationFn: () => db.feed.deletePost(item.id),
    onSuccess: () => {
      setConfirmDelete(false);
      queryClient.invalidateQueries({ queryKey: ['company-feed'] });
      queryClient.invalidateQueries({ queryKey: ['user-feed'] });
      queryClient.invalidateQueries({ queryKey: ['feed-active-discussions'] });
      toast.success('Post deleted.');
    },
    onError: (error) => {
      toast.error(error?.message || 'Failed to delete post.');
    },
  });

  const updatePost = useMutation({
    mutationFn: async ({ body, pollsToSave, pollsToDelete }) => {
      let result = await db.feed.updatePost(item.id, { body });

      for (const pollId of pollsToDelete || []) {
        result = await db.feed.deletePoll(item.id, pollId);
      }

      for (const poll of pollsToSave || []) {
        if (poll.id) {
          result = await db.feed.updatePoll(item.id, poll.id, poll.payload);
        } else {
          result = await db.feed.createPoll(item.id, {
            options: poll.payload.options.map((option) => option.label),
            allow_multiple: poll.payload.allow_multiple,
            allow_add_options: poll.payload.allow_add_options,
            is_qna: poll.payload.is_qna,
            correct_option_index: poll.payload.correct_option_index,
          });
        }
      }

      return result;
    },
    onSuccess: (payload) => {
      setEditing(false);
      if (payload?.item) {
        patchFeedItem(queryClient, payload.item);
      }
      queryClient.invalidateQueries({ queryKey: ['company-feed'] });
      queryClient.invalidateQueries({ queryKey: ['user-feed'] });
      queryClient.invalidateQueries({ queryKey: ['feed-active-discussions'] });
      queryClient.invalidateQueries({ queryKey: ['post-edits', item.id] });
      toast.success('Post updated.');
    },
    onError: (error) => {
      toast.error(error?.message || 'Failed to update post.');
    },
  });

  const approvePost = useMutation({
    mutationFn: () => db.feed.approvePost(item.id),
    onSuccess: (payload) => {
      queryClient.invalidateQueries({ queryKey: ['company-feed'] });
      queryClient.invalidateQueries({ queryKey: ['user-feed'] });
      notifyGamificationOffers(payload);
      toast.success('Post approved.');
    },
    onError: (error) => {
      toast.error(error?.message || 'Failed to approve post.');
    },
  });

  const rejectPost = useMutation({
    mutationFn: () => db.feed.rejectPost(item.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-feed'] });
      queryClient.invalidateQueries({ queryKey: ['user-feed'] });
      toast.success('Post rejected.');
    },
    onError: (error) => {
      toast.error(error?.message || 'Failed to reject post.');
    },
  });

  const restorePost = useMutation({
    mutationFn: () => db.feed.restorePost(item.id),
    onSuccess: (payload) => {
      setConfirmRestore(false);
      if (payload?.item) {
        patchFeedItem(queryClient, payload.item);
      }
      queryClient.invalidateQueries({ queryKey: ['company-feed'] });
      queryClient.invalidateQueries({ queryKey: ['user-feed'] });
      queryClient.invalidateQueries({ queryKey: ['feed-active-discussions'] });
      toast.success('Post restored.');
    },
    onError: (error) => {
      toast.error(error?.message || 'Failed to restore post.');
    },
  });

  const timeAgo = formatDistanceToNow(new Date(item.created_date), { addSuffix: true });
  const deletedAt = item.deleted_at ? new Date(item.deleted_at) : null;
  const deletedAgo = deletedAt && !Number.isNaN(deletedAt.getTime())
    ? formatDistanceToNow(deletedAt, { addSuffix: true })
    : null;
  const moderationBusy = approvePost.isPending || rejectPost.isPending || restorePost.isPending;
  const pollsValid = draftPolls.every(isPollDraftValid);
  const canSaveEdit =
    (
      !isEmptyRichText(draftBody)
      || Boolean(item.image_url || item.image_urls?.length)
      || draftPolls.length > 0
      || itemPolls.length > 0
    ) && pollsValid;
  const bodyUnchanged = (draftBody || '') === (item.body || '');
  const pollsUnchanged = removedPollIds.length === 0
    && draftPolls.length === itemPolls.length
    && draftPolls.every((draft, index) => pollDraftUnchanged(itemPolls[index], draft));
  const draftUnchanged = bodyUnchanged && pollsUnchanged;

  const updateDraftPoll = (index, patch) => {
    setDraftPolls((current) => current.map((poll, i) => (
      i === index ? { ...poll, ...patch } : poll
    )));
  };

  const handleSaveEdit = () => {
    if (updatePost.isPending || !canSaveEdit || draftUnchanged) return;
    if (!pollsValid) {
      toast.error(draftPolls.map(pollDraftIssue).find(Boolean) || `Each poll needs at least ${MIN_POLL_OPTIONS} options.`);
      return;
    }

    const pollsToSave = draftPolls
      .map((draft, index) => {
        const payload = serializePollDraft(draft);
        const original = itemPolls.find((poll) => Number(poll.id) === Number(draft.id)) || null;
        if (draft.id && (draft.isQna || pollDraftUnchanged(original, draft))) {
          return null;
        }
        return { id: draft.id, payload, index };
      })
      .filter(Boolean);

    updatePost.mutate({
      body: draftBody,
      pollsToSave,
      pollsToDelete: removedPollIds,
    });
  };

  return (
    <>
    <article
      ref={articleRef}
      id={feedPostElementId(item.id)}
      className={cn(
        'group relative scroll-mt-24 overflow-hidden bg-card',
        compact
          ? 'rounded-none border-0 border-b last:border-b-0'
          : 'rounded-lg border',
        isDeleted
          ? cn(
              'border-red-200/80 bg-red-500/[0.04] dark:border-red-400/20 dark:bg-red-500/[0.07]',
              compact && 'border-b-red-200/80 dark:border-b-red-400/20'
            )
          : 'border-solid border-border/30',
        isPending && !isDeleted && 'bg-amber-500/[0.03]'
      )}
    >
      {isDeleted ? (
        <div
          className={cn(
            'flex items-center gap-2 border-b border-red-200/70 bg-red-500/[0.08] dark:border-red-400/15 dark:bg-red-500/[0.10]',
            compact ? 'px-3 py-2 md:px-4' : 'px-3 py-2 sm:px-4'
          )}
        >
            <Trash2 className="h-3.5 w-3.5 shrink-0 text-red-500 dark:text-red-400" />
            <p className="min-w-0 flex-1 text-xs font-medium leading-snug text-red-700 dark:text-red-300">
              This post was deleted
              {deletedAgo ? (
                <span className="font-normal text-red-600/80 dark:text-red-300/70"> · {deletedAgo}</span>
              ) : null}
            </p>
            {item.can_restore ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 shrink-0 gap-1.5 border-border/80 bg-card px-2.5 text-xs text-foreground hover:bg-muted/60 dark:border-border"
                onClick={() => setConfirmRestore(true)}
                disabled={moderationBusy}
                aria-label="Restore post"
              >
                {restorePost.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                Restore
              </Button>
            ) : null}
          </div>
      ) : null}

      {/* Header */}
      <div className={cn('flex items-start gap-2.5', compact ? 'px-3 pt-2.5 md:px-4' : 'px-3 pt-2.5 sm:px-4')}>
        <Link to={`/people/${item.author?.id}`} className="shrink-0 self-start">
          <UserAvatar user={item.author} className="h-9 w-9" />
        </Link>

        <div className="min-w-0 flex-1 pt-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to={`/people/${item.author?.id}`}
              className="text-sm font-semibold leading-snug text-foreground transition-colors hover:underline"
            >
              {getDisplayName(item.author)}
            </Link>
            {isDeleted ? (
              <Badge className="border-transparent bg-red-600 px-1.5 py-0 text-[10px] font-semibold text-white shadow-none hover:bg-red-600 dark:bg-red-500">
                Deleted
              </Badge>
            ) : isPending ? (
              <Badge
                variant="outline"
                className="border-amber-500/40 bg-amber-500/15 text-[10px] font-medium text-amber-700 dark:text-amber-300"
              >
                Pending approval
              </Badge>
            ) : null}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-1 gap-y-0.5 text-[11px] text-muted-foreground">
            {item.author?.department ? (
              <>
                <span className="max-w-[14rem] truncate">{item.author.department}</span>
                <span aria-hidden>·</span>
              </>
            ) : null}
            <span className="whitespace-nowrap">{timeAgo}</span>
            <span aria-hidden>·</span>
            <Globe2 className="h-3 w-3 shrink-0 opacity-70" aria-label="Visible to company" />
            {item.is_edited ? (
              <>
                <span aria-hidden>·</span>
                <PostEditHistory postId={item.id} editedAt={item.edited_at} />
              </>
            ) : null}
          </div>
        </div>

        {(item.can_edit || item.can_delete) && !editing ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 rounded-full text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                title="Post options"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              {item.can_edit ? (
                <DropdownMenuItem
                  onClick={beginEditing}
                  disabled={updatePost.isPending}
                  className="gap-2"
                >
                  <Pencil className="h-4 w-4" />
                  Edit post
                </DropdownMenuItem>
              ) : null}
              {item.can_edit && item.can_delete ? <DropdownMenuSeparator /> : null}
              {item.can_delete ? (
                <DropdownMenuItem
                  onClick={() => setConfirmDelete(true)}
                  disabled={deletePost.isPending}
                  className="gap-2 text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete post
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>

      {/* Body / edit */}
      {editing ? (
        <div className="space-y-2 px-3 pt-2.5 sm:px-4">
          <FeedTextEditor
            value={draftBody}
            onChange={setDraftBody}
            placeholder="Update your post..."
            minHeight="6.5rem"
            maxLength={2000}
            disabled={updatePost.isPending}
          />
          <div className="space-y-2">
            {draftPolls.map((draft, index) => (
              <PollEditorPanel
                key={draft.key}
                title={draft.isQna ? (draftPolls.length > 1 ? `Question ${index + 1}` : 'Question') : (draftPolls.length > 1 ? `Poll ${index + 1}` : 'Poll')}
                options={draft.options}
                onOptionsChange={(options) => updateDraftPoll(index, { options })}
                allowMultiple={draft.allowMultiple}
                onAllowMultipleChange={(allowMultiple) => updateDraftPoll(index, {
                  allowMultiple,
                  ...(allowMultiple ? { isQna: false, correctOptionKey: null } : {}),
                })}
                allowAddOptions={draft.allowAddOptions}
                onAllowAddOptionsChange={(allowAddOptions) => updateDraftPoll(index, {
                  allowAddOptions,
                  ...(allowAddOptions ? { isQna: false, correctOptionKey: null } : {}),
                })}
                isQna={draft.isQna}
                onIsQnaChange={(isQna) => updateDraftPoll(index, {
                  isQna,
                  ...(isQna
                    ? { allowMultiple: false, allowAddOptions: false }
                    : { correctOptionKey: null }),
                })}
                correctOptionKey={draft.correctOptionKey}
                onCorrectOptionKeyChange={(correctOptionKey) => updateDraftPoll(index, { correctOptionKey })}
                locked={Boolean(draft.id && draft.isQna)}
                disabled={updatePost.isPending}
                maxOptions={MAX_POLL_OPTIONS_EDIT}
                onRemove={() => {
                  setDraftPolls((current) => current.filter((_, i) => i !== index));
                  if (draft.id) {
                    setRemovedPollIds((current) => (
                      current.includes(draft.id) ? current : [...current, draft.id]
                    ));
                  }
                }}
              />
            ))}
            {draftPolls.length < MAX_POLLS_PER_POST ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs"
                disabled={updatePost.isPending}
                onClick={() => setDraftPolls((current) => [...current, emptyPollDraft()])}
              >
                <Plus className="h-3.5 w-3.5" />
                {draftPolls.length === 0 ? 'Add poll' : 'Add another poll'}
              </Button>
            ) : null}
          </div>
          <div className="flex items-center justify-end gap-2 pb-3">
            <p className="mr-auto text-xs tabular-nums text-muted-foreground">
              {stripHtml(draftBody).length}/2000
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8"
              disabled={updatePost.isPending}
              onClick={cancelEditing}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-8"
              disabled={updatePost.isPending || !canSaveEdit || draftUnchanged}
              onClick={handleSaveEdit}
            >
              {updatePost.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Save'}
            </Button>
          </div>
        </div>
      ) : item.body ? (
        <ExpandablePostBody
          text={item.body}
          className={cn(
            'px-3 pt-1.5 sm:px-4',
            isDeleted && 'opacity-75',
            !(item.image_url || item.image_urls?.length) && 'pb-1'
          )}
        />
      ) : null}

      {/* Full-bleed media — same framing on dashboard (compact) and /feed */}
      {(item.image_url || (Array.isArray(item.image_urls) && item.image_urls.length > 0)) ? (
        <div className={cn('mt-2', isDeleted && 'opacity-75')}>
          <PostImageGrid item={item} flush />
        </div>
      ) : null}

      {!editing && itemPolls.length > 0 ? (
        <div className={cn('space-y-2 px-3 pt-2.5 sm:px-4', isDeleted && 'opacity-75')}>
          {itemPolls.map((poll) => (
            <PostPoll
              key={poll.id}
              postId={item.id}
              poll={poll}
              disabled={isPending || isDeleted}
              isAuthor={isAuthor}
            />
          ))}
        </div>
      ) : null}

      {item.can_moderate ? (
        <div className="flex items-center justify-end gap-1.5 px-3 pt-2.5 sm:px-4">
          <Button
            type="button"
            size="sm"
            className="h-7 gap-1 px-2.5 text-xs bg-emerald-600 text-white hover:bg-emerald-600/90"
            onClick={() => approvePost.mutate()}
            disabled={moderationBusy}
          >
            {approvePost.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
            Approve
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 gap-1 px-2.5 text-xs border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/15 hover:text-destructive"
            onClick={() => rejectPost.mutate()}
            disabled={moderationBusy}
          >
            {rejectPost.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
            Reject
          </Button>
        </div>
      ) : isPending ? (
        <p className="px-3 pt-2.5 text-xs text-muted-foreground sm:px-4">
          This post is hidden from the company feed until an admin or HR approves it.
        </p>
      ) : null}

      {!isPending && !editing ? (
        <>
          <FeedEngagementBar
            item={item}
            commentsCount={item.comments_count || 0}
            commentsExpanded={expanded}
            shareUrl={isDeleted ? null : feedPostShareUrl(item.id)}
            readOnly={isDeleted}
            onComment={handleComment}
            insights={
              item.can_view_insights || compact ? (
                <>
                  {item.can_view_insights ? <PostInsights item={item} /> : null}
                  {item.can_view_insights && compact ? (
                    <span className="text-[10px] leading-none text-muted-foreground/40" aria-hidden>·</span>
                  ) : null}
                  {compact ? (
                    <Link
                      to={feedPostPath(item.id, { expandComments: expanded })}
                      className="text-xs font-medium text-primary/80 hover:text-primary hover:underline"
                    >
                      Open in feed
                    </Link>
                  ) : null}
                </>
              ) : null
            }
          />
        </>
      ) : (
        <div className="h-2" />
      )}

      {isMobile ? (
        <Drawer
          open={!isPending && !editing && expanded}
          onOpenChange={(open) => {
            setExpanded(open);
            if (open) prefetchPostComments();
          }}
          onAnimationEnd={(open) => {
            if (open) {
              startTransition(() => setSheetReady(true));
              return;
            }
            setSheetReady(false);
          }}
          shouldScaleBackground={false}
          setBackgroundColorOnScale={false}
          handleOnly
          fixed
          autoFocus={false}
          repositionInputs={false}
        >
          <DrawerContent
            className={cn(
              'mt-0 h-[92dvh] max-h-[92dvh] overflow-hidden rounded-t-2xl p-0',
              !sheetReady && 'will-change-transform'
            )}
            overlayClassName="bg-black/30"
            onOpenAutoFocus={(event) => event.preventDefault()}
          >
            <DrawerTitle className="sr-only">Comments</DrawerTitle>
            <DrawerDescription className="sr-only">
              {item.comments_count
                ? `${item.comments_count} comment${item.comments_count === 1 ? '' : 's'}`
                : 'Post comments'}
            </DrawerDescription>
            {sheetReady ? (
              <PostComments
                postId={item.id}
                commentsCount={item.comments_count || 0}
                compact={compact}
                readOnly={isDeleted}
                variant="sheet"
                onCollapse={() => setExpanded(false)}
              />
            ) : (
              <CommentsSheetPlaceholder
                commentsCount={item.comments_count || 0}
                readOnly={isDeleted}
              />
            )}
          </DrawerContent>
        </Drawer>
      ) : (
        <Expandable open={!isPending && !editing && expanded}>
          <div className="border-t border-border/25 px-3 pb-3 pt-1 sm:px-4">
            <PostComments
              postId={item.id}
              commentsCount={item.comments_count || 0}
              compact={compact}
              readOnly={isDeleted}
              onCollapse={() => setExpanded(false)}
              className="mt-2 border-0 bg-transparent p-0 md:mt-2 md:bg-transparent md:p-0"
            />
          </div>
        </Expandable>
      )}
    </article>

    <AlertDialog open={confirmDelete} onOpenChange={(open) => !open && !deletePost.isPending && setConfirmDelete(false)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this post?</AlertDialogTitle>
          <AlertDialogDescription>
            This hides the post
            {itemPolls.length > 0 ? `, ${itemPolls.length === 1 ? 'poll' : 'polls'}` : ''}
            {(item.image_url || (Array.isArray(item.image_urls) && item.image_urls.length > 0)) ? ', photos' : ''}
            , and comments from the company feed. The author, admin, or HR can restore it.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deletePost.isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={deletePost.isPending}
            onClick={(event) => {
              event.preventDefault();
              deletePost.mutate();
            }}
          >
            {deletePost.isPending ? 'Deleting...' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <AlertDialog open={confirmRestore} onOpenChange={(open) => !open && !restorePost.isPending && setConfirmRestore(false)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Restore this post?</AlertDialogTitle>
          <AlertDialogDescription>
            This post will be visible on the company feed again, including its comments
            {itemPolls.length > 0 ? ` and ${itemPolls.length === 1 ? 'poll' : 'polls'}` : ''}
            {(item.image_url || (Array.isArray(item.image_urls) && item.image_urls.length > 0)) ? ' and photos' : ''}
            .
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={restorePost.isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={restorePost.isPending}
            onClick={(event) => {
              event.preventDefault();
              restorePost.mutate();
            }}
          >
            {restorePost.isPending ? 'Restoring...' : 'Restore'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}

export function FeedItem({ item, compact = false, initialExpanded = false }) {
  if (item.type === 'broadcast') {
    return <BroadcastFeedItem item={item} compact={compact} />;
  }

  return <PostFeedItem item={item} compact={compact} initialExpanded={initialExpanded} />;
}

export const FeedComposer = React.memo(function FeedComposer({ className }) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const fileInputRef = useRef(null);
  const submitLockRef = useRef(false);
  const cameraInputRef = useRef(null);
  const [body, setBody] = useState('');
  const [imageItems, setImageItems] = useState([]);
  const [draftPolls, setDraftPolls] = useState([]);
  const [compressingImages, setCompressingImages] = useState(false);
  const requiresApproval = Boolean(user?.feed_post_requires_approval);

  const addImageFiles = async (files) => {
    const incoming = Array.isArray(files) ? files.filter(Boolean) : Array.from(files || []).filter(Boolean);
    if (incoming.length === 0) return;

    const remaining = MAX_POST_IMAGES - imageItems.length;
    if (remaining <= 0) {
      toast.error(`You can attach up to ${MAX_POST_IMAGES} images.`);
      return;
    }

    if (incoming.length > remaining) {
      toast.error(`Only ${remaining} more image${remaining === 1 ? '' : 's'} can be added.`);
    }

    setCompressingImages(true);
    const prepared = [];
    try {
      for (const file of incoming.slice(0, remaining)) {
        const type = String(file.type || '').toLowerCase();
        const looksLikeImage = type.startsWith('image/') || /\.(jpe?g|png|gif|webp|heic|heif|bmp)$/i.test(file.name || '');
        if (!looksLikeImage) {
          toast.error('Please choose image files only.');
          continue;
        }
        if (file.size > POST_IMAGE_SOURCE_MAX_BYTES) {
          toast.error('Each image must be 40 MB or smaller.');
          continue;
        }

        const compressed = await compressImageFile(file);
        if (compressed.size > POST_IMAGE_MAX_BYTES) {
          toast.error('Each image must be 10 MB or smaller.');
          continue;
        }

        prepared.push({
          id: `${compressed.name}-${compressed.size}-${compressed.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
          file: compressed,
          preview: URL.createObjectURL(compressed),
        });
      }
    } finally {
      setCompressingImages(false);
    }

    if (prepared.length === 0) {
      return;
    }

    setImageItems((current) => {
      const slots = MAX_POST_IMAGES - current.length;
      if (slots <= 0) {
        prepared.forEach((item) => URL.revokeObjectURL(item.preview));
        toast.error(`You can attach up to ${MAX_POST_IMAGES} images.`);
        return current;
      }

      if (prepared.length > slots) {
        prepared.slice(slots).forEach((item) => URL.revokeObjectURL(item.preview));
      }

      return [...current, ...prepared.slice(0, slots)];
    });
  };

  const removeImage = (id) => {
    setImageItems((current) => {
      const target = current.find((item) => item.id === id);
      if (target?.preview) URL.revokeObjectURL(target.preview);
      return current.filter((item) => item.id !== id);
    });
  };

  const createPost = useMutation({
    mutationFn: async ({ text, files, polls }) => {
      const image_urls = [];

      for (const file of files) {
        const upload = await db.integrations.Core.UploadFile({ file, folder: 'post-images' });
        if (upload?.file_url) {
          image_urls.push(upload.file_url);
        }
      }

      return db.feed.createPost({ body: text, image_urls, polls });
    },
    onMutate: async ({ text, files, polls, imagePreviews, tempId }) => {
      const queryKeys = [['company-feed'], ['user-feed'], ['feed-active-discussions']];
      await cancelQueryMatches(queryClient, queryKeys);
      const snapshots = snapshotQueryMatches(queryClient, queryKeys);

      const optimisticItem = {
        type: 'post',
        id: tempId,
        body: text,
        image_url: imagePreviews?.[0] || null,
        image_urls: imagePreviews || [],
        polls: Array.isArray(polls)
          ? polls.map((poll, index) => ({
              id: `temp-poll-${index}`,
              allow_multiple: Boolean(poll.allow_multiple),
              allow_add_options: Boolean(poll.allow_add_options),
              is_qna: Boolean(poll.is_qna),
              can_add_options: false,
              total_votes: 0,
              has_voted: false,
              my_option_id: null,
              my_option_ids: [],
              correct_option_id: Boolean(poll.is_qna) && poll.correct_option_index != null
                ? `temp-opt-${index}-${poll.correct_option_index}`
                : null,
              options: (poll.options || []).map((option, optionIndex) => ({
                id: `temp-opt-${index}-${optionIndex}`,
                label: option.label || option,
                votes_count: 0,
                percent: 0,
                voted: false,
              })),
            }))
          : [],
        poll: null,
        approval_status: requiresApproval ? 'pending' : 'approved',
        author: {
          id: user?.id,
          name: getDisplayName(user),
          profile_picture: user?.profile_picture,
          profile_picture_crop: user?.profile_picture_crop,
          department: user?.department?.name || user?.department || null,
        },
        comments_count: 0,
        reactions_count: 0,
        reaction_counts: {},
        my_reaction: null,
        available_reactions: ['👍', '❤️', '👏', '🎉', '😂', '🔥'],
        created_date: new Date().toISOString(),
        can_edit: true,
        can_delete: true,
        can_moderate: false,
        is_pending: requiresApproval,
        is_optimistic: true,
      };
      if (optimisticItem.polls.length > 0) {
        optimisticItem.poll = optimisticItem.polls[0];
      }

      const draft = {
        body: text,
        imageItems: files.map((file, index) => ({
          file,
          preview: imagePreviews?.[index] || null,
        })),
        draftPollsSnapshot: draftPolls,
        imagePreviews: imagePreviews || [],
      };

      // Clear composer without revoking blob URLs — optimistic card still uses them.
      setBody('');
      setImageItems([]);
      setDraftPolls([]);
      prependFeedItem(queryClient, optimisticItem);

      return { snapshots, tempId, draft };
    },
    onSuccess: (payload, _variables, context) => {
      if (payload?.item && context?.tempId) {
        replaceFeedItem(queryClient, context.tempId, payload.item);
      }
      (context?.draft?.imagePreviews || []).forEach((url) => {
        if (url) URL.revokeObjectURL(url);
      });
      notifyGamificationOffers(payload);
      const pending = payload?.item?.is_pending || payload?.item?.approval_status === 'pending';
      toast.success(pending ? 'Post submitted for approval.' : 'Post shared.');
    },
    onError: (error, _variables, context) => {
      if (context?.snapshots) {
        restoreQueryMatches(queryClient, context.snapshots);
      } else if (context?.tempId) {
        removeFeedItem(queryClient, context.tempId);
      }
      if (context?.draft) {
        setBody(context.draft.body || '');
        if (Array.isArray(context.draft.draftPollsSnapshot)) {
          setDraftPolls(context.draft.draftPollsSnapshot);
        }
        if (Array.isArray(context.draft.imageItems) && context.draft.imageItems.length > 0) {
          setImageItems(
            context.draft.imageItems.map((entry, index) => ({
              id: `restore-${Date.now()}-${index}`,
              file: entry.file,
              preview: entry.preview || (entry.file ? URL.createObjectURL(entry.file) : null),
            }))
          );
        }
      }
      toast.error(error?.message || 'Failed to share post.');
    },
    onSettled: () => {
      submitLockRef.current = false;
      queryClient.invalidateQueries({ queryKey: ['company-feed'] });
      queryClient.invalidateQueries({ queryKey: ['user-feed'] });
      queryClient.invalidateQueries({ queryKey: ['feed-active-discussions'] });
    },
  });

  const handleImageSelect = (event) => {
    // FileList is live — copy before resetting the input value.
    const selected = Array.from(event.target.files || []);
    event.target.value = '';
    addImageFiles(selected);
  };

  const validPolls = draftPolls
    .map((draft) => serializePollDraft(draft))
    .filter((poll) => poll.options.length >= MIN_POLL_OPTIONS && (!poll.is_qna || poll.correct_option_index != null));
  const hasValidPolls = validPolls.length > 0 && validPolls.length === draftPolls.length;
  const canPost = Boolean(
    (!isEmptyRichText(body) || imageItems.length > 0 || hasValidPolls)
    && (draftPolls.length === 0 || hasValidPolls)
  );
  const isSubmitting = createPost.isPending;
  const isBusy = isSubmitting || compressingImages;
  const plainLength = stripHtml(body).length;
  const nearLimit = plainLength >= 1800;

  const updateComposerPoll = (index, patch) => {
    setDraftPolls((current) => current.map((poll, i) => (
      i === index ? { ...poll, ...patch } : poll
    )));
  };

  const addComposerPoll = () => {
    setDraftPolls((current) => (
      current.length >= MAX_POLLS_PER_POST ? current : [...current, emptyPollDraft()]
    ));
  };

  const handleSubmit = () => {
    if (submitLockRef.current || createPost.isPending || compressingImages || !canPost) return;

    if (draftPolls.length > 0 && !hasValidPolls) {
      toast.error(draftPolls.map(pollDraftIssue).find(Boolean) || `Each poll needs at least ${MIN_POLL_OPTIONS} options.`);
      return;
    }

    submitLockRef.current = true;
    const imagePreviews = imageItems.map((item) => item.preview).filter(Boolean);
    createPost.mutate({
      text: body,
      files: imageItems.map((item) => item.file),
      imagePreviews,
      polls: hasValidPolls ? validPolls : null,
      tempId: `temp-post-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    });
  };

  return (
    <div className={cn('overflow-hidden rounded-lg border border-border/30 bg-card', className)}>
      <div className="flex items-start gap-2.5 p-3 sm:p-3.5">
        <UserAvatar
          user={user}
          className="h-9 w-9 shrink-0"
          showOnlineStatus={false}
        />
        <div className="min-w-0 flex-1">
          <FeedTextEditor
            value={body}
            onChange={setBody}
            placeholder={
              isMobile
                ? 'Share an update...'
                : 'Share an update… Type @ to mention someone'
            }
            minHeight={isMobile ? '3.5rem' : '4rem'}
            maxLength={2000}
            disabled={isBusy}
            editorClassName="border-0 shadow-none rounded-lg bg-muted/20"
          />

          {requiresApproval ? (
            <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
              Your posts need admin or HR approval before they appear in the company feed.
            </p>
          ) : null}

          {draftPolls.length > 0 ? (
            <div className="mt-3 space-y-2">
              {draftPolls.map((draft, index) => (
                <PollEditorPanel
                  key={draft.key}
                  title={draft.isQna ? (draftPolls.length > 1 ? `Question ${index + 1}` : 'Question') : (draftPolls.length > 1 ? `Poll ${index + 1}` : 'Poll')}
                  options={draft.options}
                  onOptionsChange={(options) => updateComposerPoll(index, { options })}
                  allowMultiple={draft.allowMultiple}
                  onAllowMultipleChange={(allowMultiple) => updateComposerPoll(index, {
                    allowMultiple,
                    ...(allowMultiple ? { isQna: false, correctOptionKey: null } : {}),
                  })}
                  allowAddOptions={draft.allowAddOptions}
                  onAllowAddOptionsChange={(allowAddOptions) => updateComposerPoll(index, {
                    allowAddOptions,
                    ...(allowAddOptions ? { isQna: false, correctOptionKey: null } : {}),
                  })}
                  isQna={draft.isQna}
                  onIsQnaChange={(isQna) => updateComposerPoll(index, {
                    isQna,
                    ...(isQna
                      ? { allowMultiple: false, allowAddOptions: false }
                      : { correctOptionKey: null }),
                  })}
                  correctOptionKey={draft.correctOptionKey}
                  onCorrectOptionKeyChange={(correctOptionKey) => updateComposerPoll(index, { correctOptionKey })}
                  disabled={isBusy}
                  maxOptions={MAX_POLL_OPTIONS}
                  onRemove={() => setDraftPolls((current) => current.filter((_, i) => i !== index))}
                />
              ))}
              {draftPolls.length < MAX_POLLS_PER_POST ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                  onClick={addComposerPoll}
                  disabled={isBusy}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add another poll
                </Button>
              ) : null}
            </div>
          ) : null}

          {compressingImages ? (
            <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Optimizing photos…
            </p>
          ) : null}

          {imageItems.length > 0 ? (
            <div
              className={cn(
                'mt-3 grid gap-2',
                imageItems.length === 1 ? 'grid-cols-1' : 'grid-cols-2 sm:grid-cols-3'
              )}
            >
              {imageItems.map((item) => (
                <div
                  key={item.id}
                  className="relative overflow-hidden rounded-xl border border-border/60 bg-muted/20"
                >
                  <img
                    src={item.preview}
                    alt="Selected photo preview"
                    className={cn(
                      'w-full object-cover',
                      imageItems.length === 1 ? 'max-h-56 sm:max-h-64' : 'h-28 sm:h-32'
                    )}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="absolute right-1.5 top-1.5 h-7 w-7 rounded-full bg-background/90 shadow-sm"
                    onClick={() => removeImage(item.id)}
                    disabled={isBusy}
                    title="Remove photo"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-1.5 border-t border-border/25 px-2.5 py-1.5 sm:gap-2 sm:px-3">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,image/jpeg,image/jpg,image/png,image/webp,image/gif,.heic,.heif"
          multiple
          className="hidden"
          onChange={handleImageSelect}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleImageSelect}
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-9 gap-1.5 rounded-full px-2.5 text-muted-foreground hover:bg-muted/60 hover:text-foreground sm:h-8"
          onClick={() => fileInputRef.current?.click()}
          disabled={isBusy || imageItems.length >= MAX_POST_IMAGES}
          title="Upload photos"
        >
          {compressingImages ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
          <span className="hidden text-xs sm:inline">Photo</span>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-9 gap-1.5 rounded-full px-2.5 text-muted-foreground hover:bg-muted/60 hover:text-foreground sm:h-8"
          onClick={() => cameraInputRef.current?.click()}
          disabled={isBusy || imageItems.length >= MAX_POST_IMAGES}
          title="Take photo"
        >
          <Camera className="h-4 w-4" />
          <span className="hidden text-xs sm:inline">Camera</span>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(
            'h-9 gap-1.5 rounded-full px-2.5 sm:h-8',
            draftPolls.length > 0
              ? 'bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary'
              : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
          )}
          onClick={addComposerPoll}
          disabled={isBusy || draftPolls.length >= MAX_POLLS_PER_POST}
          title={draftPolls.length >= MAX_POLLS_PER_POST ? `Up to ${MAX_POLLS_PER_POST} polls per post` : 'Add poll'}
        >
          <ListChecks className="h-4 w-4" />
          <span className="hidden text-xs sm:inline">
            {draftPolls.length > 0 ? `Poll (${draftPolls.length})` : 'Poll'}
          </span>
        </Button>
        {imageItems.length > 0 ? (
          <span className="hidden text-[11px] tabular-nums text-muted-foreground sm:inline">
            {imageItems.length}/{MAX_POST_IMAGES}
          </span>
        ) : null}

        <div className="ml-auto flex items-center gap-2 sm:gap-2.5">
          <ExpActionHint actionKey="feed_post" compact />
          <p
            className={cn(
              'text-[11px] tabular-nums sm:text-xs',
              nearLimit ? 'text-amber-500' : 'text-muted-foreground'
            )}
          >
            {plainLength}/2000
          </p>
          <Button
            type="button"
            size="sm"
            className={cn(
              'h-9 gap-1.5 rounded-full px-3.5 touch-manipulation sm:h-8',
              !canPost && 'opacity-50'
            )}
            disabled={isBusy || !canPost}
            title="Post"
            onClick={handleSubmit}
          >
            {isSubmitting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <SendHorizontal className="h-3.5 w-3.5" />
            )}
            <span className="text-xs font-medium">Post</span>
          </Button>
        </div>
      </div>
    </div>
  );
});

export default FeedItem;
