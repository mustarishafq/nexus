import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { Camera, Check, Globe2, ImageIcon, ListChecks, Loader2, Megaphone, MoreHorizontal, Pencil, Plus, Send, SendHorizontal, Trash2, X } from 'lucide-react';
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
import { toast } from 'sonner';
import { notifyGamificationOffers } from '@/lib/gamification';
import ExpActionHint from '@/components/gamification/ExpActionHint';
import { useIsMobile } from '@/hooks/use-mobile';
import { flattenCommentReplies } from '@/lib/comments';
import { buildMentionToken } from '@/lib/mentions';
import { getDisplayName } from '@/lib/profile';
import { useAuth } from '@/lib/AuthContext';
import { isEmptyRichText, stripHtml } from '@/lib/richText';
import { cn } from '@/lib/utils';
import { feedPostElementId, feedPostPath } from '@/lib/feedLinks';

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
  };
}

function pollDraftFromItem(poll, keyPrefix = 'poll') {
  if (!poll || !Array.isArray(poll.options)) {
    return emptyPollDraft(keyPrefix);
  }

  return {
    key: `${keyPrefix}-${poll.id ?? 'new'}`,
    id: poll.id ?? null,
    options: poll.options.map((option, index) => ({
      key: `opt-${option.id ?? index}`,
      id: option.id ?? null,
      label: option.label || '',
    })),
    allowMultiple: Boolean(poll.allow_multiple),
    allowAddOptions: Boolean(poll.allow_add_options),
  };
}

function pollDraftsFromItem(item) {
  return pollsFromItem(item).map((poll, index) => pollDraftFromItem(poll, `poll-${index}`));
}

function serializePollDraft(options, allowMultiple, allowAddOptions) {
  const cleaned = options
    .map((option) => ({
      id: option.id || undefined,
      label: String(option.label || '').trim(),
    }))
    .filter((option) => option.label);

  return {
    options: cleaned,
    allow_multiple: Boolean(allowMultiple),
    allow_add_options: Boolean(allowAddOptions),
  };
}

function isPollDraftValid(draft) {
  const cleaned = (draft.options || [])
    .map((option) => String(option.label || '').trim())
    .filter(Boolean);
  return cleaned.length >= MIN_POLL_OPTIONS;
}

function pollDraftUnchanged(poll, draft) {
  if (!poll && !draft) return true;
  if (!poll || !draft) return false;
  const current = serializePollDraft(draft.options, draft.allowMultiple, draft.allowAddOptions);
  const originalLabels = (poll.options || []).map((option) => ({
    id: option.id,
    label: String(option.label || '').trim(),
  }));

  if (Boolean(poll.allow_multiple) !== current.allow_multiple) return false;
  if (Boolean(poll.allow_add_options) !== current.allow_add_options) return false;
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
  disabled = false,
  maxOptions = MAX_POLL_OPTIONS,
  onRemove = null,
}) {
  const updateOption = (index, value) => {
    onOptionsChange(options.map((option, i) => (
      i === index ? { ...option, label: value } : option
    )));
  };

  const addOption = () => {
    if (options.length >= maxOptions) return;
    onOptionsChange([
      ...options,
      { key: `new-${Date.now()}`, id: null, label: '' },
    ]);
  };

  const removeOption = (index) => {
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
          <Input
            value={option.label}
            onChange={(event) => updateOption(index, event.target.value)}
            placeholder={`Option ${index + 1}`}
            maxLength={120}
            disabled={disabled}
            className="h-9"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 text-muted-foreground"
            onClick={() => removeOption(index)}
            disabled={disabled || (options.length <= MIN_POLL_OPTIONS && !option.label.trim())}
            title="Remove option"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
      {options.length < maxOptions ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 px-2 text-xs text-muted-foreground"
          onClick={addOption}
          disabled={disabled}
        >
          <Plus className="h-3.5 w-3.5" />
          Add option
        </Button>
      ) : null}
      <div className="space-y-2 border-t border-border/50 pt-2.5">
        <label className="flex cursor-pointer items-start gap-2.5 text-xs text-muted-foreground">
          <Checkbox
            checked={allowMultiple}
            onCheckedChange={(checked) => onAllowMultipleChange(checked === true)}
            disabled={disabled}
            className="mt-0.5"
          />
          <span>
            <span className="font-medium text-foreground">Allow multiple choices</span>
            <span className="mt-0.5 block">People can select more than one option</span>
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-2.5 text-xs text-muted-foreground">
          <Checkbox
            checked={allowAddOptions}
            onCheckedChange={(checked) => onAllowAddOptionsChange(checked === true)}
            disabled={disabled}
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
      <div
        className={cn(
          'text-sm leading-relaxed text-foreground/90 break-words',
          needsClamp && !expanded && 'line-clamp-3'
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

function PostComments({ postId, commentsCount, onCollapse, compact = false, className }) {
  const queryClient = useQueryClient();
  const [commentBody, setCommentBody] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const commentInputRef = useRef(null);

  const { data, isLoading } = useQuery({
    queryKey: ['post-comments', postId],
    queryFn: () => db.feed.listComments(postId),
    staleTime: 15_000,
  });

  const createComment = useMutation({
    mutationFn: ({ body, parentCommentId }) => db.feed.createComment(postId, body, parentCommentId),
    onSuccess: (data, variables) => {
      setCommentBody('');
      setReplyingTo(null);
      queryClient.invalidateQueries({ queryKey: ['post-comments', postId] });
      queryClient.invalidateQueries({ queryKey: ['company-feed'] });
      notifyGamificationOffers(data);
      toast.success(variables?.parentCommentId ? 'Reply added.' : 'Comment added.');
    },
    onError: (error) => {
      toast.error(error?.message || 'Failed to add comment.');
    },
  });

  const deleteComment = useMutation({
    mutationFn: (commentId) => db.feed.deleteComment(commentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['post-comments', postId] });
      queryClient.invalidateQueries({ queryKey: ['company-feed'] });
    },
    onError: (error) => {
      toast.error(error?.message || 'Failed to delete comment.');
    },
  });

  const comments = Array.isArray(data?.comments) ? data.comments : [];

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

  const renderComment = (comment, { isReply = false } = {}) => {
    const nestedReplies = !isReply ? flattenCommentReplies(comment.replies) : [];

    return (
      <div key={comment.id} className="flex gap-2 md:gap-2.5">
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
                {comment.can_delete ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => deleteComment.mutate(comment.id)}
                    disabled={deleteComment.isPending}
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
              {comment.can_delete ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => deleteComment.mutate(comment.id)}
                  disabled={deleteComment.isPending}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              ) : null}
            </div>
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-2 px-1">
            <PostReactions item={comment} commentId={comment.id} postId={postId} compact />
            <button
              type="button"
              onClick={() => startReply(comment, { isReply })}
              className="text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Reply
            </button>
          </div>

          {nestedReplies.length > 0 ? (
            <div className="mt-2.5 ml-5 space-y-2.5 border-l border-border/40 pl-2.5 md:ml-7 md:space-y-3 md:pl-3">
              {nestedReplies.map((reply) => renderComment(reply, { isReply: true }))}
            </div>
          ) : null}
        </div>
      </div>
    );
  };

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

      <div className="space-y-2.5 md:space-y-3">
        {isLoading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Loading comments...
          </div>
        ) : comments.length === 0 ? (
          <p className="text-xs text-muted-foreground">No comments yet. Be the first to reply.</p>
        ) : (
          comments.map((comment) => renderComment(comment))
        )}
      </div>

      <form
        className="mt-2.5 border-t border-border/50 pt-2.5 md:mt-3 md:pt-3"
        onSubmit={(event) => {
          event.preventDefault();
          const body = commentBody.trim();
          if (!body) return;
          createComment.mutate({
            body,
            parentCommentId: replyingTo?.id || null,
          });
        }}
      >
        {replyingTo ? (
          <div className="mb-2 flex items-center gap-2 rounded-lg bg-background/80 px-2.5 py-1.5 text-[11px] text-muted-foreground ring-1 ring-border/50">
            <span className="min-w-0 flex-1 truncate">
              Replying to{' '}
              <span className="font-medium text-foreground" title={replyingTo.name}>
                {replyingTo.name}
              </span>
            </span>
            <button
              type="button"
              onClick={() => setReplyingTo(null)}
              className="shrink-0 font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        ) : null}
        <div className="flex items-end gap-1.5 md:gap-2">
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
    </div>
  );
}

function PostFeedItem({ item, compact = false, initialExpanded = false }) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const articleRef = useRef(null);
  const [expanded, setExpanded] = useState(initialExpanded);
  const [editing, setEditing] = useState(false);
  const [draftBody, setDraftBody] = useState(item.body || '');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const itemPolls = pollsFromItem(item);
  const [draftPolls, setDraftPolls] = useState(() => pollDraftsFromItem(item));
  const [removedPollIds, setRemovedPollIds] = useState([]);
  const isPending = Boolean(item.is_pending || item.approval_status === 'pending');
  const isAuthor = Number(user?.id) === Number(item.author?.id);
  const canMarkSeen = !isPending && !isAuthor && Boolean(item.id);

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
          });
        }
      }

      return result;
    },
    onSuccess: (payload) => {
      setEditing(false);
      if (payload?.item) {
        queryClient.setQueriesData({ queryKey: ['company-feed'] }, (current) => {
          if (!current || !Array.isArray(current.items)) return current;
          return {
            ...current,
            items: current.items.map((entry) => (
              entry?.type === 'post' && String(entry.id) === String(payload.item.id)
                ? { ...entry, ...payload.item }
                : entry
            )),
          };
        });
      }
      queryClient.invalidateQueries({ queryKey: ['company-feed'] });
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
      toast.success('Post rejected.');
    },
    onError: (error) => {
      toast.error(error?.message || 'Failed to reject post.');
    },
  });

  const timeAgo = formatDistanceToNow(new Date(item.created_date), { addSuffix: true });
  const moderationBusy = approvePost.isPending || rejectPost.isPending;
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
      toast.error(`Each poll needs at least ${MIN_POLL_OPTIONS} options.`);
      return;
    }

    const pollsToSave = draftPolls
      .map((draft, index) => {
        const payload = serializePollDraft(draft.options, draft.allowMultiple, draft.allowAddOptions);
        const original = itemPolls.find((poll) => Number(poll.id) === Number(draft.id)) || null;
        if (draft.id && pollDraftUnchanged(original, draft)) {
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
        'group scroll-mt-24 overflow-hidden bg-card',
        compact
          ? 'rounded-none border-0 border-b border-border/30 last:border-b-0'
          : 'rounded-lg border border-border/30',
        isPending && 'bg-amber-500/[0.03]'
      )}
    >
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
            {isPending ? (
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
                title={draftPolls.length > 1 ? `Poll ${index + 1}` : 'Poll'}
                options={draft.options}
                onOptionsChange={(options) => updateDraftPoll(index, { options })}
                allowMultiple={draft.allowMultiple}
                onAllowMultipleChange={(allowMultiple) => updateDraftPoll(index, { allowMultiple })}
                allowAddOptions={draft.allowAddOptions}
                onAllowAddOptionsChange={(allowAddOptions) => updateDraftPoll(index, { allowAddOptions })}
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
          className={cn('px-3 pt-1.5 sm:px-4', !(item.image_url || item.image_urls?.length) && 'pb-1')}
        />
      ) : null}

      {/* Full-bleed media — same framing on dashboard (compact) and /feed */}
      {(item.image_url || (Array.isArray(item.image_urls) && item.image_urls.length > 0)) ? (
        <div className="mt-2">
          <PostImageGrid item={item} flush />
        </div>
      ) : null}

      {!editing && itemPolls.length > 0 ? (
        <div className="space-y-2 px-3 pt-2.5 sm:px-4">
          {itemPolls.map((poll) => (
            <PostPoll
              key={poll.id}
              postId={item.id}
              poll={poll}
              disabled={isPending}
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
            shareUrl={feedPostPath(item.id)}
            onComment={() => setExpanded((current) => !current)}
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

      <Expandable open={!isPending && !editing && expanded}>
        <div className="border-t border-border/25 px-3 pb-3 pt-1 sm:px-4">
          <PostComments
            postId={item.id}
            commentsCount={item.comments_count || 0}
            compact={compact}
            onCollapse={() => setExpanded(false)}
            className="mt-2 border-0 bg-transparent p-0 md:mt-2 md:bg-transparent md:p-0"
          />
        </div>
      </Expandable>
    </article>

    <AlertDialog open={confirmDelete} onOpenChange={(open) => !open && !deletePost.isPending && setConfirmDelete(false)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this post?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently removes the post
            {itemPolls.length > 0 ? `, ${itemPolls.length === 1 ? 'poll' : 'polls'}` : ''}
            {(item.image_url || (Array.isArray(item.image_urls) && item.image_urls.length > 0)) ? ', photos' : ''}
            , and comments from the company feed.
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
  const requiresApproval = Boolean(user?.feed_post_requires_approval);

  const clearImages = () => {
    setImageItems((current) => {
      current.forEach((item) => {
        if (item.preview) URL.revokeObjectURL(item.preview);
      });
      return [];
    });
  };

  const addImageFiles = (files) => {
    const incoming = Array.isArray(files) ? files.filter(Boolean) : Array.from(files || []).filter(Boolean);
    if (incoming.length === 0) return;

    setImageItems((current) => {
      const remaining = MAX_POST_IMAGES - current.length;
      if (remaining <= 0) {
        toast.error(`You can attach up to ${MAX_POST_IMAGES} images.`);
        return current;
      }

      const accepted = [];
      for (const file of incoming.slice(0, remaining)) {
        const type = String(file.type || '').toLowerCase();
        const looksLikeImage = type.startsWith('image/') || /\.(jpe?g|png|gif|webp|heic|heif|bmp)$/i.test(file.name || '');
        if (!looksLikeImage) {
          toast.error('Please choose image files only.');
          continue;
        }
        if (file.size > 10 * 1024 * 1024) {
          toast.error('Each image must be 10 MB or smaller.');
          continue;
        }
        accepted.push({
          id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
          file,
          preview: URL.createObjectURL(file),
        });
      }

      if (accepted.length === 0) {
        return current;
      }

      if (incoming.length > remaining) {
        toast.error(`Only ${remaining} more image${remaining === 1 ? '' : 's'} can be added.`);
      }

      return [...current, ...accepted].slice(0, MAX_POST_IMAGES);
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
    onSuccess: (payload) => {
      setBody('');
      clearImages();
      setDraftPolls([]);
      queryClient.invalidateQueries({ queryKey: ['company-feed'] });
      queryClient.invalidateQueries({ queryKey: ['feed-active-discussions'] });
      notifyGamificationOffers(payload);
      const pending = payload?.item?.is_pending || payload?.item?.approval_status === 'pending';
      toast.success(pending ? 'Post submitted for approval.' : 'Post shared.');
    },
    onError: (error) => {
      toast.error(error?.message || 'Failed to share post.');
    },
    onSettled: () => {
      submitLockRef.current = false;
    },
  });

  const handleImageSelect = (event) => {
    // FileList is live — copy before resetting the input value.
    const selected = Array.from(event.target.files || []);
    event.target.value = '';
    addImageFiles(selected);
  };

  const validPolls = draftPolls
    .map((draft) => serializePollDraft(draft.options, draft.allowMultiple, draft.allowAddOptions))
    .filter((poll) => poll.options.length >= MIN_POLL_OPTIONS);
  const hasValidPolls = validPolls.length > 0 && validPolls.length === draftPolls.length;
  const canPost = Boolean(
    (!isEmptyRichText(body) || imageItems.length > 0 || hasValidPolls)
    && (draftPolls.length === 0 || hasValidPolls)
  );
  const isSubmitting = createPost.isPending;
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
    if (submitLockRef.current || createPost.isPending || !canPost) return;

    if (draftPolls.length > 0 && !hasValidPolls) {
      toast.error(`Each poll needs at least ${MIN_POLL_OPTIONS} options.`);
      return;
    }

    submitLockRef.current = true;
    createPost.mutate({
      text: body,
      files: imageItems.map((item) => item.file),
      polls: hasValidPolls ? validPolls : null,
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
            disabled={isSubmitting}
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
                  title={draftPolls.length > 1 ? `Poll ${index + 1}` : 'Poll'}
                  options={draft.options}
                  onOptionsChange={(options) => updateComposerPoll(index, { options })}
                  allowMultiple={draft.allowMultiple}
                  onAllowMultipleChange={(allowMultiple) => updateComposerPoll(index, { allowMultiple })}
                  allowAddOptions={draft.allowAddOptions}
                  onAllowAddOptionsChange={(allowAddOptions) => updateComposerPoll(index, { allowAddOptions })}
                  disabled={isSubmitting}
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
                  disabled={isSubmitting}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add another poll
                </Button>
              ) : null}
            </div>
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
                    disabled={isSubmitting}
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
          disabled={isSubmitting || imageItems.length >= MAX_POST_IMAGES}
          title="Upload photos"
        >
          <ImageIcon className="h-4 w-4" />
          <span className="hidden text-xs sm:inline">Photo</span>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-9 gap-1.5 rounded-full px-2.5 text-muted-foreground hover:bg-muted/60 hover:text-foreground sm:h-8"
          onClick={() => cameraInputRef.current?.click()}
          disabled={isSubmitting || imageItems.length >= MAX_POST_IMAGES}
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
          disabled={isSubmitting || draftPolls.length >= MAX_POLLS_PER_POST}
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
            disabled={isSubmitting || !canPost}
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
