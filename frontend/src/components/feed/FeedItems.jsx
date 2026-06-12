import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { Camera, ImageIcon, Loader2, Megaphone, MessageCircle, Send, Trash2, X } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import db from '@/api/base44Client';
import UserAvatar from '@/components/users/UserAvatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import MentionInput from '@/components/feed/MentionInput';
import MentionText from '@/components/feed/MentionText';
import PostReactions from '@/components/feed/PostReactions';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { toAbsoluteUrl } from '@/lib/media';

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

  const { data, isLoading } = useQuery({
    queryKey: ['post-comments', postId],
    queryFn: () => db.feed.listComments(postId),
    staleTime: 15_000,
  });

  const createComment = useMutation({
    mutationFn: (body) => db.feed.createComment(postId, body),
    onSuccess: () => {
      setCommentBody('');
      queryClient.invalidateQueries({ queryKey: ['post-comments', postId] });
      queryClient.invalidateQueries({ queryKey: ['company-feed'] });
      toast.success('Comment added.');
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
          comments.map((comment) => (
            <div key={comment.id} className="flex gap-2 md:gap-2.5">
              <Link to={`/people/${comment.author?.id}`} className="shrink-0">
                <UserAvatar
                  user={comment.author}
                  className="h-7 w-7 md:h-8 md:w-8"
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
                          {comment.author?.full_name || 'User'}
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
                          {comment.author?.full_name || 'User'}
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
              </div>
            </div>
          ))
        )}
      </div>

      <form
        className="mt-2.5 flex items-end gap-1.5 border-t border-border/50 pt-2.5 md:mt-3 md:gap-2 md:pt-3"
        onSubmit={(event) => {
          event.preventDefault();
          const body = commentBody.trim();
          if (!body) return;
          createComment.mutate(body);
        }}
      >
        <div className="min-w-0 flex-1">
          <MentionInput
            value={commentBody}
            onChange={setCommentBody}
            placeholder="Write a comment..."
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
          title="Post comment"
        >
          {createComment.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>
    </div>
  );
}

function PostFeedItem({ item, compact = false }) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);

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

  const timeAgo = formatDistanceToNow(new Date(item.created_date), { addSuffix: true });

  return (
    <article
      className={cn(
        'group border-b border-border/50 last:border-b-0',
        compact ? 'px-3 py-3 md:px-5 md:py-4' : 'px-3 py-4 md:px-5 md:py-5'
      )}
    >
      <div className="grid grid-cols-[auto_1fr] gap-x-2.5 md:gap-x-3">
        <Link to={`/people/${item.author?.id}`} className="col-start-1 row-start-1 shrink-0 self-start">
          <UserAvatar user={item.author} className="h-9 w-9 md:h-10 md:w-10" />
        </Link>

        <div className="col-start-2 row-start-1 min-w-0">
          <div className="flex items-start justify-between gap-2 md:gap-3">
            <div className="min-w-0">
              <Link
                to={`/people/${item.author?.id}`}
                className="text-sm font-semibold text-foreground transition-colors hover:text-primary hover:underline"
              >
                {item.author?.full_name || 'User'}
              </Link>
              {item.author?.department ? (
                <p className="mt-0.5 max-md:truncate text-xs text-muted-foreground">
                  {item.author.department}
                </p>
              ) : null}
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <span className="whitespace-nowrap text-[10px] text-muted-foreground md:text-[11px]">
                {timeAgo}
              </span>
              {item.can_delete && !compact ? (
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

          {item.body ? (
            <div className="mt-2 text-sm leading-relaxed text-foreground/90 break-words md:break-normal">
              <MentionText text={item.body} />
            </div>
          ) : null}

          {item.image_url ? (
            <div className="mt-2 overflow-hidden rounded-xl border border-border/50 bg-muted/20">
              <img
                src={toAbsoluteUrl(item.image_url)}
                alt="Post attachment"
                className="max-h-72 w-full object-cover sm:max-h-80 md:max-h-96"
                loading="lazy"
              />
            </div>
          ) : null}

          <div
            className={cn(
              'mt-3 border-t border-border/40 pt-3',
              !item.body && !item.image_url && 'mt-2 border-t-0 pt-0'
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
                    to="/feed"
                    className="text-[11px] font-medium text-primary/80 hover:text-primary hover:underline"
                  >
                    Open in feed
                  </Link>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        {expanded ? (
          <PostComments
            postId={item.id}
            commentsCount={item.comments_count || 0}
            compact={compact}
            onCollapse={() => setExpanded(false)}
            className="col-span-2 row-start-2 md:col-span-1 md:col-start-2"
          />
        ) : null}
      </div>
    </article>
  );
}

export function FeedItem({ item, compact = false }) {
  if (item.type === 'broadcast') {
    return <BroadcastFeedItem item={item} compact={compact} />;
  }

  return <PostFeedItem item={item} compact={compact} />;
}

export function FeedComposer({ className }) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const [body, setBody] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);

  const clearImage = () => {
    setImageFile(null);
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }
    setImagePreview(null);
  };

  const applySelectedImage = (file) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image must be 10 MB or smaller.');
      return;
    }

    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }

    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const createPost = useMutation({
    mutationFn: async ({ text, file }) => {
      let image_url = null;

      if (file) {
        const upload = await db.integrations.Core.UploadFile({ file, folder: 'post-images' });
        image_url = upload?.file_url || null;
      }

      return db.feed.createPost({ body: text, image_url });
    },
    onSuccess: () => {
      setBody('');
      clearImage();
      queryClient.invalidateQueries({ queryKey: ['company-feed'] });
      toast.success('Post shared.');
    },
    onError: (error) => {
      toast.error(error?.message || 'Failed to share post.');
    },
  });

  const handleImageSelect = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) applySelectedImage(file);
  };

  const canPost = Boolean(body.trim() || imageFile);
  const isSubmitting = createPost.isPending;

  return (
    <div className={cn('rounded-2xl border border-border bg-card p-3 sm:p-4', className)}>
      <MentionInput
        value={body}
        onChange={setBody}
        placeholder="Share an update... Type @ to mention someone"
        rows={3}
        maxLength={2000}
        className="text-sm"
      />

      {imagePreview ? (
        <div className="relative mt-3 overflow-hidden rounded-xl border border-border/60 bg-muted/20">
          <img
            src={imagePreview}
            alt="Selected photo preview"
            className="max-h-56 w-full object-cover sm:max-h-64"
          />
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="absolute right-2 top-2 h-8 w-8 rounded-full bg-background/90 shadow-sm"
            onClick={clearImage}
            disabled={isSubmitting}
            title="Remove photo"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : null}

      <div className="mt-3 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <div className="flex min-w-0 items-center justify-between gap-2 sm:justify-start">
          <div className="flex shrink-0 items-center gap-0.5">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
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
              className="h-8 px-2 text-muted-foreground hover:text-foreground"
              onClick={() => fileInputRef.current?.click()}
              disabled={isSubmitting}
              title="Upload photo"
            >
              <ImageIcon className="mr-1.5 h-4 w-4" />
              Photo
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-muted-foreground hover:text-foreground"
              onClick={() => cameraInputRef.current?.click()}
              disabled={isSubmitting}
              title="Take photo"
            >
              <Camera className="mr-1.5 h-4 w-4" />
              Camera
            </Button>
          </div>
          <p className="shrink-0 text-xs text-muted-foreground">{body.length}/2000</p>
        </div>
        <Button
          type="button"
          size="sm"
          className="w-full shrink-0 sm:w-auto"
          disabled={isSubmitting || !canPost}
          onClick={() =>
            createPost.mutate({
              text: body.trim(),
              file: imageFile,
            })
          }
        >
          {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Post
        </Button>
      </div>
    </div>
  );
}

export default FeedItem;
