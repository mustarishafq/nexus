import React from 'react';
import { Reply, X } from 'lucide-react';
import { messageReplyExcerpt } from '@/components/messages/MessageBubble';
import { getDisplayName } from '@/lib/profile';
import { cn } from '@/lib/utils';

/** "Replying to …" strip shown above the composer while a reply is pending. */
export default function ReplyPreviewBar({ message, onCancel, className, mutedClassName = 'text-muted-foreground' }) {
  if (!message) return null;

  const name = message.is_mine ? 'yourself' : getDisplayName(message.sender);

  return (
    <div className={cn('flex shrink-0 items-center gap-2 border-t border-border/60 px-3 py-2', className)}>
      <Reply className="h-4 w-4 shrink-0 text-primary" />
      <div className="min-w-0 flex-1 border-l-[3px] border-primary pl-2">
        <p className="truncate text-[11px] font-semibold text-primary">Replying to {name}</p>
        <p className={cn('truncate text-xs', mutedClassName)}>{messageReplyExcerpt(message)}</p>
      </div>
      <button
        type="button"
        onClick={onCancel}
        className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full hover:bg-muted/60', mutedClassName)}
        aria-label="Cancel reply"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
