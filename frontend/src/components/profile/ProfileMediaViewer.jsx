// @ts-nocheck
import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { Loader2, MessageCircle, Send, Trash2 } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import db from '@/api/apiClient';
import MentionInput from '@/components/feed/MentionInput';
import MentionText from '@/components/feed/MentionText';
import PostReactions from '@/components/feed/PostReactions';
import MediaLightbox from '@/components/media/MediaLightbox';
import UserAvatar from '@/components/users/UserAvatar';
import { Button } from '@/components/ui/button';
import { flattenCommentReplies } from '@/lib/comments';
import { toAbsoluteUrl } from '@/lib/media';
import { buildMentionToken } from '@/lib/mentions';
import { getDisplayName } from '@/lib/profile';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const DEFAULT_COVER = '/icons/cover-photo-new.png';
const MEDIA_LABELS = {
  avatar: 'Profile picture',
  cover: 'Cover photo',
};

function ProfileMediaComments({ userId, mediaType, commentsCount, queryKey }) {
  const queryClient = useQueryClient();
  const [commentBody, setCommentBody] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);

  const commentsQueryKey = ['profile-media-comments', userId, mediaType];

  const { data, isLoading } = useQuery({
    queryKey: commentsQueryKey,
    queryFn: () => db.profileMedia.listComments(userId, mediaType),
    staleTime: 15_000,
  });

  const createComment = useMutation({
    mutationFn: ({ body, parentCommentId }) =>
      db.profileMedia.createComment(userId, mediaType, body, parentCommentId),
    onSuccess: (_data, variables) => {
      setCommentBody('');
      setReplyingTo(null);
      queryClient.invalidateQueries({ queryKey: commentsQueryKey });
      queryClient.invalidateQueries({ queryKey });
      toast.success(variables?.parentCommentId ? 'Reply added.' : 'Comment added.');
    },
    onError: (error) => {
      toast.error(error?.message || 'Failed to add comment.');
    },
  });

  const deleteComment = useMutation({
    mutationFn: (commentId) => db.profileMedia.deleteComment(commentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: commentsQueryKey });
      queryClient.invalidateQueries({ queryKey });
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
      <div key={comment.id} className="flex gap-2">
        <Link to={`/people/${comment.author?.id}`} className="shrink-0">
          <UserAvatar
            user={comment.author}
            className={cn(isReply ? 'h-6 w-6' : 'h-7 w-7')}
            fallbackClassName="text-[10px]"
          />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="rounded-2xl bg-background px-2.5 py-2 shadow-sm ring-1 ring-border/50">
            <div className="flex items-start justify-between gap-1.5">
              <div className="min-w-0">
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
                <div className="mt-1 text-sm leading-relaxed break-words">
                  <MentionText text={comment.body} />
                </div>
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
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-2 px-1">
            <PostReactions
              item={comment}
              compact
              reactFn={(reaction) => db.profileMedia.reactToComment(comment.id, reaction)}
              invalidateKeys={[commentsQueryKey]}
            />
            <button
              type="button"
              onClick={() => startReply(comment, { isReply })}
              className="text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Reply
            </button>
          </div>

          {nestedReplies.length > 0 ? (
            <div className="mt-2.5 ml-5 space-y-2.5 border-l border-border/40 pl-2.5">
              {nestedReplies.map((reply) => renderComment(reply, { isReply: true }))}
            </div>
          ) : null}
        </div>
      </div>
    );
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-2.5 shrink-0">
        <p className="text-xs font-semibold text-foreground">
          {commentsCount > 0
            ? `${commentsCount} comment${commentsCount === 1 ? '' : 's'}`
            : 'Comments'}
        </p>
      </div>

      <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto pr-1">
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
        className="mt-2.5 shrink-0 border-t border-border/50 pt-2.5"
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
        <div className="flex items-end gap-1.5">
          <div className="min-w-0 flex-1">
            <MentionInput
              value={commentBody}
              onChange={setCommentBody}
              placeholder={replyingTo ? `Reply to ${replyingTo.name}...` : 'Write a comment...'}
              rows={1}
              maxLength={1000}
              className="min-h-9 text-sm"
            />
          </div>
          <Button
            type="submit"
            size="icon"
            className="h-9 w-9 shrink-0"
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

export default function ProfileMediaViewer({
  open,
  onOpenChange,
  user,
  mediaType,
  fallbackImageUrl = null,
}) {
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState('');
  const userId = user?.id;
  const queryKey = ['profile-media', userId, mediaType];

  const close = useCallback(() => {
    onOpenChange?.(false);
  }, [onOpenChange]);

  useEffect(() => {
    if (!open) {
      return;
    }
    setImageLoading(true);
    setImageError('');
  }, [open, mediaType, userId]);

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => db.profileMedia.get(userId, mediaType),
    enabled: Boolean(open && userId && mediaType),
    staleTime: 15_000,
  });

  const item = data?.item;
  const remoteUrl = toAbsoluteUrl(item?.image_url);
  const localFallback = toAbsoluteUrl(fallbackImageUrl);
  const imageUrl =
    remoteUrl ||
    localFallback ||
    (mediaType === 'cover' ? DEFAULT_COVER : null);
  const label = MEDIA_LABELS[mediaType] || 'Photo';
  const ownerName = getDisplayName(item?.owner || user, 'Profile');

  if (!userId) {
    return null;
  }

  return (
    <MediaLightbox
      open={open}
      onClose={close}
      ariaLabel={`${label} for ${ownerName}`}
      closeLabel="Close photo viewer"
      className="p-3 sm:p-6"
      contentClassName={cn(
        'h-full max-h-[min(92vh,900px)] w-full max-w-5xl items-stretch overflow-hidden rounded-2xl bg-card shadow-2xl',
        'flex-col lg:flex-row'
      )}
    >
      <div
        className={cn(
          'relative flex min-h-0 items-center justify-center bg-black/95',
          'h-[42vh] shrink-0 lg:h-auto lg:flex-1'
        )}
      >
        {imageLoading && !imageError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/80">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="text-sm">Loading photo…</span>
          </div>
        ) : null}

        {imageError ? (
          <div className="px-6 py-16 text-center text-sm text-white/80">{imageError}</div>
        ) : null}

        {imageUrl ? (
          <img
            src={imageUrl}
            alt={`${label} for ${ownerName}`}
            className={cn(
              'max-h-full max-w-full object-contain',
              (imageLoading || imageError) && 'hidden'
            )}
            onLoad={() => setImageLoading(false)}
            onError={() => {
              setImageLoading(false);
              setImageError('Unable to load photo.');
            }}
          />
        ) : (
          <div className="px-6 py-16 text-center text-sm text-white/80">No photo uploaded yet.</div>
        )}
      </div>

      <aside className="flex min-h-0 w-full flex-1 flex-col border-t border-border bg-card p-3 sm:p-4 lg:w-[360px] lg:flex-none lg:border-l lg:border-t-0">
        <div className="mb-3 flex items-center gap-2.5 border-b border-border/60 pb-3">
          <UserAvatar user={item?.owner || user} className="h-9 w-9" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{ownerName}</p>
            <p className="text-[11px] text-muted-foreground">{label}</p>
          </div>
        </div>

        {isLoading || !item ? (
          <div className="flex items-center gap-2 py-6 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Loading interactions...
          </div>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <PostReactions
                item={item}
                reactFn={(reaction) => db.profileMedia.react(userId, mediaType, reaction)}
                invalidateKeys={[queryKey]}
              />
              <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                <MessageCircle className="h-3.5 w-3.5" />
                {item.comments_count || 0}
              </span>
            </div>

            <ProfileMediaComments
              userId={userId}
              mediaType={mediaType}
              commentsCount={item.comments_count || 0}
              queryKey={queryKey}
            />
          </>
        )}
      </aside>
    </MediaLightbox>
  );
}
