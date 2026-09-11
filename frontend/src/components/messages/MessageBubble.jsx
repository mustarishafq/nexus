import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import PostReactions from '@/components/feed/PostReactions';
import { displayMentionText } from '@/lib/mentions';
import { getDisplayName } from '@/lib/profile';
import { cn } from '@/lib/utils';

/**
 * One message bubble, shared by the full Messages page and MiniChatPanel so
 * edit/delete/react/date-separator behavior stays identical everywhere the
 * thread is rendered.
 */
export default function MessageBubble({
  message,
  onEdit,
  onDelete,
}) {
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

  const showMenu = Boolean(message.can_edit || message.can_delete);

  return (
    <div className={cn('flex', message.is_mine ? 'justify-end' : 'justify-start')}>
      <div className={cn('group flex max-w-[85%] items-start gap-1', message.is_mine ? 'flex-row-reverse' : 'flex-row')}>
        <div
          className={cn(
            'rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
            message.is_mine ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'
          )}
        >
          {!message.is_mine ? (
            <p className="mb-1 text-[11px] font-semibold opacity-80">{getDisplayName(message.sender)}</p>
          ) : null}
          <p className="whitespace-pre-wrap break-words">{displayMentionText(message.body)}</p>
          <p className={cn('mt-1 flex items-center gap-1 text-[10px]', message.is_mine ? 'text-primary-foreground/70' : 'text-muted-foreground')}>
            <span>{formatDistanceToNow(new Date(message.created_date), { addSuffix: true })}</span>
            {message.is_edited ? <span className="opacity-80">· Edited</span> : null}
          </p>
        </div>

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
      </div>
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
