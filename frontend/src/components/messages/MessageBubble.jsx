import React from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { motion, useDragControls, useMotionValue, useTransform } from 'framer-motion';
import { MoreHorizontal, Pencil, Reply, Trash2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import PostReactions from '@/components/feed/PostReactions';
import SharedPostCard from '@/components/messages/SharedPostCard';
import { feedPostPath, stripSharedPostLinks } from '@/lib/feedLinks';
import { displayMentionText } from '@/lib/mentions';
import { getDisplayName } from '@/lib/profile';
import { cn } from '@/lib/utils';

const URL_REGEX = /(https?:\/\/[^\s<>]+[^\s<>.,;:!?'")\]])/g;
const SHARED_POST_PATH_REGEX = /^\/share\/posts\/([^/?#]+)\/?$/;

/** Same-origin /share/posts/{id} links open the post in-app instead of a new tab. */
function sharedPostPath(href) {
  try {
    const url = new URL(href);
    if (url.origin !== window.location.origin) return null;
    const match = url.pathname.match(SHARED_POST_PATH_REGEX);
    return match ? feedPostPath(decodeURIComponent(match[1])) : null;
  } catch {
    return null;
  }
}

function LinkifiedText({ text, linkClassName }) {
  const parts = String(text).split(URL_REGEX);

  return parts.map((part, index) => {
    if (index % 2 === 0) {
      return part ? <React.Fragment key={index}>{part}</React.Fragment> : null;
    }

    const internalPath = sharedPostPath(part);
    if (internalPath) {
      return (
        <Link key={index} to={internalPath} className={linkClassName}>
          {part}
        </Link>
      );
    }

    return (
      <a key={index} href={part} target="_blank" rel="noopener noreferrer" className={linkClassName}>
        {part}
      </a>
    );
  });
}

const SWIPE_REPLY_THRESHOLD = 56;

/** Plain-text summary of a message for reply quotes / the composer reply bar. */
export function messageReplyExcerpt(message) {
  if (!message) return '';
  const text = stripSharedPostLinks(displayMentionText(message.body || '')).replace(/\s+/g, ' ').trim();
  if (text) return text;
  return message.shared_post ? 'Shared a post' : '';
}

function replyLabel(message, reply) {
  const replier = message.is_mine ? 'You' : getDisplayName(message.sender);
  if (reply.is_mine) {
    return message.is_mine ? 'You replied to yourself' : `${replier} replied to you`;
  }
  const target = reply.sender?.name || 'User';
  if (!message.is_mine && String(reply.sender?.id) === String(message.sender?.id)) {
    return `${replier} replied to themselves`;
  }
  return `${replier} replied to ${target}`;
}

/** Messenger-style quote: a label plus a faded preview sitting behind the bubble. */
function ReplyQuote({ message, onJump }) {
  const reply = message.reply_to;

  return (
    <div className={cn('flex min-w-0 max-w-full flex-col', message.is_mine ? 'items-end' : 'items-start')}>
      <p className="mb-1 flex items-center gap-1 px-1 text-[11px] text-muted-foreground">
        <Reply className="h-3 w-3" />
        {replyLabel(message, reply)}
      </p>
      <button
        type="button"
        onClick={() => onJump?.(reply.id)}
        className="-mb-3 max-w-full rounded-2xl bg-muted/70 px-3.5 pb-4 pt-2 text-left text-xs text-muted-foreground transition-colors hover:bg-muted"
      >
        <span className="line-clamp-2 break-words">
          {reply.is_deleted ? <span className="italic">This message has been deleted</span> : reply.excerpt}
        </span>
      </button>
    </div>
  );
}

function MessageMeta({ message, className }) {
  return (
    <p className={cn('mt-1 flex items-center gap-1 text-[10px]', className)}>
      <span>{formatDistanceToNow(new Date(message.created_date), { addSuffix: true })}</span>
      {message.is_edited ? <span className="opacity-80">· Edited</span> : null}
    </p>
  );
}

/**
 * One message bubble, shared by the full Messages page and MiniChatPanel so
 * edit/delete/react/date-separator behavior stays identical everywhere the
 * thread is rendered.
 */
export default function MessageBubble({
  message,
  onEdit,
  onDelete,
  onReply,
  onJumpToMessage,
}) {
  const dragControls = useDragControls();
  const swipeX = useMotionValue(0);
  const replyIconOpacity = useTransform(swipeX, [0, SWIPE_REPLY_THRESHOLD], [0, 1]);
  const replyIconScale = useTransform(swipeX, [0, SWIPE_REPLY_THRESHOLD], [0.6, 1]);

  if (message.is_deleted) {
    return (
      <div className={cn('flex', message.is_mine ? 'justify-end' : 'justify-start')}>
        <div
          className={cn(
            'max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm italic text-muted-foreground',
            'border border-dashed border-border/60 bg-muted/30'
          )}
        >
          This message has been deleted
        </div>
      </div>
    );
  }

  const canReply = Boolean(onReply);
  // Reply has its own hover button (desktop) and swipe (touch); the menu is
  // only needed for edit/delete on your own messages.
  const showMenu = Boolean(message.can_edit || message.can_delete);
  const bodyText = message.shared_post
    ? stripSharedPostLinks(displayMentionText(message.body))
    : displayMentionText(message.body);
  const hasBubble = Boolean(bodyText);

  return (
    <div className={cn('relative flex', message.is_mine ? 'justify-end' : 'justify-start')}>
      {canReply ? (
        <motion.span
          aria-hidden
          style={{ opacity: replyIconOpacity, scale: replyIconScale }}
          className="pointer-events-none absolute left-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-muted text-muted-foreground"
        >
          <Reply className="h-3.5 w-3.5" />
        </motion.span>
      ) : null}
      {/* Swipe right to reply — touch only, so desktop text selection is untouched. */}
      <motion.div
        drag={canReply ? 'x' : false}
        dragControls={dragControls}
        dragListener={false}
        dragDirectionLock
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={{ left: 0, right: 0.5 }}
        dragSnapToOrigin
        style={{ x: swipeX, touchAction: 'pan-y' }}
        onPointerDown={(event) => {
          if (canReply && event.pointerType === 'touch') dragControls.start(event);
        }}
        onDragEnd={(_event, info) => {
          if (info.offset.x >= SWIPE_REPLY_THRESHOLD) {
            if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
              navigator.vibrate(10);
            }
            onReply?.(message);
          }
        }}
        className={cn('group flex max-w-[85%] items-start gap-1', message.is_mine ? 'flex-row-reverse' : 'flex-row')}
      >
        <div className={cn('flex min-w-0 flex-col gap-1', message.is_mine ? 'items-end' : 'items-start')}>
          {message.reply_to ? <ReplyQuote message={message} onJump={onJumpToMessage} /> : null}
          {hasBubble ? (
            <div
              className={cn(
                'relative min-w-0 max-w-full rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
                message.is_mine ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground',
                // Received bubbles share the quote's grey; a ring keeps the overlap readable.
                message.reply_to && !message.is_mine && 'ring-2 ring-background'
              )}
            >
              {bodyText ? (
                <p className="whitespace-pre-wrap break-words">
                  <LinkifiedText
                    text={bodyText}
                    linkClassName="break-all underline underline-offset-2 hover:opacity-80"
                  />
                </p>
              ) : null}
              {!message.shared_post ? (
                <MessageMeta message={message} className={message.is_mine ? 'text-primary-foreground/70' : 'text-muted-foreground'} />
              ) : null}
            </div>
          ) : null}

          {/* Shared posts stand on their own, like a link preview, rather than nesting a card inside the bubble. */}
          {message.shared_post ? (
            <>
              <SharedPostCard post={message.shared_post} className="w-64 shadow-sm sm:w-72" />
              <MessageMeta message={message} className="px-1 text-muted-foreground" />
            </>
          ) : null}
        </div>

        {canReply ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onReply(message)}
            className="hidden h-7 w-7 shrink-0 self-center rounded-full text-muted-foreground opacity-0 transition-opacity hover:bg-muted/60 hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100 sm:inline-flex"
            aria-label="Reply"
            title="Reply"
          >
            <Reply className="h-3.5 w-3.5" />
          </Button>
        ) : null}

        {showMenu ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 self-center rounded-full text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                aria-label="Message options"
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align={message.is_mine ? 'end' : 'start'} className="w-36">
              {canReply ? (
                <DropdownMenuItem onClick={() => onReply(message)} className="gap-2">
                  <Reply className="h-3.5 w-3.5" />
                  Reply
                </DropdownMenuItem>
              ) : null}
              {message.can_edit ? (
                <DropdownMenuItem onClick={() => onEdit?.(message)} className="gap-2">
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </DropdownMenuItem>
              ) : null}
              {message.can_delete ? (
                <DropdownMenuItem
                  onClick={() => onDelete?.(message)}
                  className="gap-2 text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </motion.div>
    </div>
  );
}

/**
 * Reaction row rendered just under a bubble. Kept as a separate small
 * component (rather than inline in MessageBubble) so it's easy to align it
 * under either side of the bubble without complicating the bubble markup.
 */
export function MessageReactionRow({ message, reactFn, invalidateKeys, compact = false }) {
  if (message.is_deleted) return null;

  return (
    <div className={cn('-mt-1.5 flex px-1', message.is_mine ? 'justify-end' : 'justify-start')}>
      <PostReactions
        item={message}
        reactFn={reactFn}
        invalidateKeys={invalidateKeys}
        compact={compact}
        showCounts={false}
      />
    </div>
  );
}
