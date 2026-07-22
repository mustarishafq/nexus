import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { Camera, Check, ImageIcon, Loader2, Megaphone, MessageCircle, Pencil, Send, SendHorizontal, Trash2, X } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import db from '@/api/apiClient';
import UserAvatar from '@/components/users/UserAvatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import FeedTextEditor from '@/components/feed/FeedTextEditor';
import MentionInput from '@/components/feed/MentionInput';
import MentionText from '@/components/feed/MentionText';
import PostEditHistory from '@/components/feed/PostEditHistory';
import PostReactions from '@/components/feed/PostReactions';
import PostImageGrid from '@/components/feed/PostImageGrid';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';
import { getDisplayName } from '@/lib/profile';
import { useAuth } from '@/lib/AuthContext';
import { isEmptyRichText } from '@/lib/richText';
import { cn } from '@/lib/utils';
import { feedPostElementId, feedPostPath } from '@/lib/feedLinks';

const MAX_POST_IMAGES = 10;

function BroadcastFeedItem({ item, compact = false }) {
  return (
    <article
      className={cn(
        'border-b border-border/50 bg-primary/[0.03] last:border-b-0',
        compact ? 'px-3 py-3 md:px-5 md:py-4' : 'px-3 py-4 md:px-5 md:py-4'
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <Megaphone className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold">{item.title}</p>
            <Badge variant="outline" className="h-5 text-[10px] capitalize">
              {item.priority || 'announcement'}
            </Badge>
          </div>
          {item.message ? (
            <div className="mt-2 text-sm leading-relaxed text-muted-foreground">
              <MentionText text={item.message} />
            </div>
          ) : null}
          <p className="mt-2.5 text-[11px] text-muted-foreground">
            {formatDistanceToNow(new Date(item.created_date), { addSuffix: true })}
          </p>
        </div>
      </div>
    </article>
  );
}

function PostComments({ postId, commentsCount, onCollapse, compact = false, className }) {
  const queryClient = useQueryClient();
  const [commentBody, setCommentBody] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['post-comments', postId],
    queryFn: () => db.feed.listComments(postId),
    staleTime: 15_000,
  });

  const createComment = useMutation({
    mutationFn: ({ body, parentCommentId }) => db.feed.createComment(postId, body, parentCommentId),
    onSuccess: (_data, variables) => {
      setCommentBody('');
      setReplyingTo(null);
      queryClient.invalidateQueries({ queryKey: ['post-comments', postId] });
      queryClient.invalidateQueries({ queryKey: ['company-feed'] });
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

  const startReply = (comment) => {
    setReplyingTo({
      id: comment.id,
      name: getDisplayName(comment.author),
    });
  };

  const renderComment = (comment, { depth = 0 } = {}) => (
    <div
      key={comment.id}
      className={cn('flex gap-2 md:gap-2.5', depth > 0 && 'ml-5 border-l border-border/40 pl-2.5 md:ml-7 md:pl-3')}
    >
      <Link to={`/people/${comment.author?.id}`} className="shrink-0">
        <UserAvatar
          user={comment.author}
          className={cn(depth > 0 ? 'h-6 w-6 md:h-7 md:w-7' : 'h-7 w-7 md:h-8 md:w-8')}
          fallbackClassName="text-[10px]"
        />
      </Link>
      <div className="min-w-0 flex-1">
        <div className="rounded-2xl bg-background px-2.5 py-2 shadow-sm ring-1 ring-border/50 md:px-3">
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
            onClick={() => startReply(comment)}
            className="text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Reply
          </button>
        </div>

        {Array.isArray(comment.replies) && comment.replies.length > 0 ? (
          <div className="mt-2.5 space-y-2.5 md:space-y-3">
            {comment.replies.map((reply) => renderComment(reply, { depth: depth + 1 }))}
          </div>
        ) : null}
      </div>
    </div>
  );

  return (
    <div
      className={cn(
        'rounded-xl border border-border/60',
        compact
          ? 'mt-2.5 bg-muted/20 p-2 md:mt-3 md:bg-muted/25 md:p-3'
          : 'mt-2.5 bg-muted/20 p-2 md:mt-3 md:bg-muted/25 md:p-3',
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
          <div className="mb-2 flex items-center justify-between gap-2 rounded-lg bg-background/80 px-2.5 py-1.5 text-[11px] text-muted-foreground ring-1 ring-border/50">
            <span>
              Replying to <span className="font-medium text-foreground">{replyingTo.name}</span>
            </span>
            <button
              type="button"
              onClick={() => setReplyingTo(null)}
              className="font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        ) : null}
        <div className="flex items-end gap-1.5 md:gap-2">
          <div className="min-w-0 flex-1">
            <MentionInput
              value={commentBody}
              onChange={setCommentBody}
              placeholder={replyingTo ? `Reply to ${replyingTo.name}...` : 'Write a comment...'}
              rows={1}
              maxLength={1000}
              className="min-h-9 text-sm md:min-h-10"
            />
          </div>
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
      </form>
    </div>
  );
}

function PostFeedItem({ item, compact = false, initialExpanded = false }) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(initialExpanded);
  const [editing, setEditing] = useState(false);
  const [draftBody, setDraftBody] = useState(item.body || '');
  const isPending = Boolean(item.is_pending || item.approval_status === 'pending');

  useEffect(() => {
    if (initialExpanded) {
      setExpanded(true);
    }
  }, [initialExpanded]);

  useEffect(() => {
    if (!editing) {
      setDraftBody(item.body || '');
    }
  }, [item.body, editing]);

  const deletePost = useMutation({
    mutationFn: () => db.feed.deletePost(item.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-feed'] });
      toast.success('Post deleted.');
    },
    onError: (error) => {
      toast.error(error?.message || 'Failed to delete post.');
    },
  });

  const updatePost = useMutation({
    mutationFn: (body) => db.feed.updatePost(item.id, { body }),
    onSuccess: () => {
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: ['company-feed'] });
      queryClient.invalidateQueries({ queryKey: ['post-edits', item.id] });
      toast.success('Post updated.');
    },
    onError: (error) => {
      toast.error(error?.message || 'Failed to update post.');
    },
  });

  const approvePost = useMutation({
    mutationFn: () => db.feed.approvePost(item.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-feed'] });
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
  const canSaveEdit =
    !isEmptyRichText(draftBody) || Boolean(item.image_url || item.image_urls?.length);
  const draftUnchanged = (draftBody || '') === (item.body || '');

  return (
    <article
      id={feedPostElementId(item.id)}
      className={cn(
        'group scroll-mt-24 border-b border-border/50 transition-shadow last:border-b-0',
        compact ? 'px-3 py-3 md:px-5 md:py-4' : 'px-3 py-4 md:px-5 md:py-5',
        isPending && 'bg-amber-500/5'
      )}
    >
      <div className="grid grid-cols-[auto_1fr] gap-x-2.5 md:gap-x-3">
        <Link to={`/people/${item.author?.id}`} className="col-start-1 row-start-1 shrink-0 self-start">
          <UserAvatar user={item.author} className="h-9 w-9 md:h-10 md:w-10" />
        </Link>

        <div className="col-start-2 row-start-1 min-w-0">
          <div className="flex items-start justify-between gap-2 md:gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  to={`/people/${item.author?.id}`}
                  className="text-sm font-semibold text-foreground transition-colors hover:text-primary hover:underline"
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
              {item.author?.department ? (
                <p className="mt-0.5 max-md:truncate text-xs text-muted-foreground">
                  {item.author.department}
                </p>
              ) : null}
            </div>

            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
              <div className="flex flex-col items-end gap-0.5">
                <span className="whitespace-nowrap text-[10px] text-muted-foreground md:text-[11px]">
                  {timeAgo}
                </span>
                {item.is_edited ? (
                  <PostEditHistory postId={item.id} editedAt={item.edited_at} />
                ) : null}
              </div>
              {item.can_edit && !compact && !editing ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground opacity-100 hover:text-foreground md:opacity-0 md:transition-opacity md:group-hover:opacity-100"
                  onClick={() => {
                    setDraftBody(item.body || '');
                    setEditing(true);
                  }}
                  disabled={updatePost.isPending}
                  title="Edit post"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              ) : null}
              {item.can_delete && !compact && !editing ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground opacity-100 hover:text-destructive md:opacity-0 md:transition-opacity md:group-hover:opacity-100"
                  onClick={() => deletePost.mutate()}
                  disabled={deletePost.isPending}
                  title="Delete post"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              ) : null}
            </div>
          </div>

          {editing ? (
            <div className="mt-2 space-y-2">
              <FeedTextEditor
                value={draftBody}
                onChange={setDraftBody}
                placeholder="Update your post..."
                minHeight="6.5rem"
                maxLength={2000}
                disabled={updatePost.isPending}
              />
              <div className="flex items-center justify-end gap-2">
                <p className="mr-auto text-xs tabular-nums text-muted-foreground">{draftBody.length}/2000</p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8"
                  disabled={updatePost.isPending}
                  onClick={() => {
                    setDraftBody(item.body || '');
                    setEditing(false);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="h-8"
                  disabled={updatePost.isPending || !canSaveEdit || draftUnchanged}
                  onClick={() => updatePost.mutate(draftBody)}
                >
                  {updatePost.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Save'}
                </Button>
              </div>
            </div>
          ) : item.body ? (
            <div className="mt-2 text-foreground/90">
              <MentionText text={item.body} />
            </div>
          ) : null}
        </div>

        {!editing && (item.image_url || (Array.isArray(item.image_urls) && item.image_urls.length > 0)) ? (
          <div className="col-span-2 mt-2.5 min-w-0">
            <PostImageGrid item={item} />
          </div>
        ) : null}

        {item.can_moderate ? (
          <div className="col-span-2 mt-2.5 flex items-center justify-end gap-1.5">
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
          <p className="col-span-2 mt-3 text-xs text-muted-foreground">
            This post is hidden from the company feed until an admin or HR approves it.
          </p>
        ) : null}

        {!isPending && !editing ? (
          <div
            className={cn(
              'col-start-2 mt-3 min-w-0 border-t border-border/40 pt-3',
              !item.body && !(item.image_url || item.image_urls?.length) && 'mt-2 border-t-0 pt-0'
            )}
          >
            <PostReactions item={item} />

            {!expanded ? (
              <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                <button
                  type="button"
                  onClick={() => setExpanded(true)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  <span className="md:hidden">
                    {(item.comments_count || 0) === 0
                      ? 'Comment'
                      : `${item.comments_count} ${item.comments_count === 1 ? 'comment' : 'comments'}`}
                  </span>
                  <span className="hidden md:inline">
                    {item.comments_count || 0}{' '}
                    {(item.comments_count || 0) === 1 ? 'comment' : 'comments'}
                  </span>
                </button>
                {compact ? (
                  <Link
                    to={feedPostPath(item.id, { expandComments: expanded })}
                    className="text-[11px] font-medium text-primary/80 hover:text-primary hover:underline"
                  >
                    Open in feed
                  </Link>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {!isPending && !editing && expanded ? (
          <PostComments
            postId={item.id}
            commentsCount={item.comments_count || 0}
            compact={compact}
            onCollapse={() => setExpanded(false)}
            className="col-span-2 mt-2 md:col-span-1 md:col-start-2"
          />
        ) : null}
      </div>
    </article>
  );
}

export function FeedItem({ item, compact = false, initialExpanded = false }) {
  if (item.type === 'broadcast') {
    return <BroadcastFeedItem item={item} compact={compact} />;
  }

  return <PostFeedItem item={item} compact={compact} initialExpanded={initialExpanded} />;
}

export function FeedComposer({ className }) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const [body, setBody] = useState('');
  const [imageItems, setImageItems] = useState([]);
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
    mutationFn: async ({ text, files }) => {
      const image_urls = [];

      for (const file of files) {
        const upload = await db.integrations.Core.UploadFile({ file, folder: 'post-images' });
        if (upload?.file_url) {
          image_urls.push(upload.file_url);
        }
      }

      return db.feed.createPost({ body: text, image_urls });
    },
    onSuccess: (payload) => {
      setBody('');
      clearImages();
      queryClient.invalidateQueries({ queryKey: ['company-feed'] });
      const pending = payload?.item?.is_pending || payload?.item?.approval_status === 'pending';
      toast.success(pending ? 'Post submitted for approval.' : 'Post shared.');
    },
    onError: (error) => {
      toast.error(error?.message || 'Failed to share post.');
    },
  });

  const handleImageSelect = (event) => {
    // FileList is live — copy before resetting the input value.
    const selected = Array.from(event.target.files || []);
    event.target.value = '';
    addImageFiles(selected);
  };

  const canPost = Boolean(!isEmptyRichText(body) || imageItems.length > 0);
  const isSubmitting = createPost.isPending;

  return (
    <div className={cn('rounded-2xl border border-border bg-card p-3 sm:p-4', className)}>
      <FeedTextEditor
        value={body}
        onChange={setBody}
        placeholder={
          isMobile
            ? 'Share an update...'
            : 'Share an update... Type @ to mention someone'
        }
        minHeight={isMobile ? '6.5rem' : '8rem'}
        maxLength={2000}
        disabled={isSubmitting}
      />

      {requiresApproval ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Your posts need admin or HR approval before they appear in the company feed.
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
                disabled={isSubmitting}
                title="Remove photo"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-3 flex items-center gap-2">
        <div className="flex shrink-0 items-center gap-0.5">
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
            className="h-10 touch-manipulation px-2.5 text-muted-foreground hover:text-foreground sm:h-8 sm:px-2"
            onClick={() => fileInputRef.current?.click()}
            disabled={isSubmitting || imageItems.length >= MAX_POST_IMAGES}
            title="Upload photos"
          >
            <ImageIcon className="h-4 w-4 sm:mr-1.5" />
            <span className="hidden sm:inline">Photo</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-10 touch-manipulation px-2.5 text-muted-foreground hover:text-foreground sm:h-8 sm:px-2"
            onClick={() => cameraInputRef.current?.click()}
            disabled={isSubmitting || imageItems.length >= MAX_POST_IMAGES}
            title="Take photo"
          >
            <Camera className="h-4 w-4 sm:mr-1.5" />
            <span className="hidden sm:inline">Camera</span>
          </Button>
          {imageItems.length > 0 ? (
            <span className="hidden text-[11px] text-muted-foreground sm:inline">
              {imageItems.length}/{MAX_POST_IMAGES}
            </span>
          ) : null}
        </div>
        <p className="ml-auto shrink-0 text-xs tabular-nums text-muted-foreground">{body.length}/2000</p>
        <Button
          type="button"
          size="icon"
          className="h-10 w-10 shrink-0 touch-manipulation rounded-full sm:h-9 sm:w-9"
          disabled={isSubmitting || !canPost}
          title="Post"
          onClick={() =>
            createPost.mutate({
              text: body,
              files: imageItems.map((item) => item.file),
            })
          }
        >
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <SendHorizontal className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}

export default FeedItem;
