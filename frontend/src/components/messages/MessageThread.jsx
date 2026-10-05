import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import db from '@/api/apiClient';
import { groupMessagesWithDateSeparators } from '@/lib/messages';
import MessageBubble, { MessageReactionRow } from '@/components/messages/MessageBubble';
import { cn } from '@/lib/utils';

function DateSeparator({ label }) {
  return (
    <div className="flex items-center justify-center py-1">
      <span className="rounded-full bg-muted/70 px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground">
        {label}
      </span>
    </div>
  );
}

/**
 * Renders a full message thread — WhatsApp-style date separators, bubbles,
 * edit/delete actions, and reactions — shared by the Messages page and
 * MiniChatPanel so both surfaces behave identically wherever a conversation
 * is rendered.
 */
export default function MessageThread({
  messages,
  conversationId,
  onEdit,
  onDelete,
  onReply,
  compactReactions = false,
  bottomRef,
  className,
}) {
  const items = useMemo(() => groupMessagesWithDateSeparators(messages), [messages]);

  const containerRef = useRef(null);
  const highlightTimer = useRef(null);
  const [highlightedId, setHighlightedId] = useState(null);

  useEffect(() => () => window.clearTimeout(highlightTimer.current), []);

  const jumpToMessage = useCallback((messageId) => {
    const target = containerRef.current?.querySelector(`[data-message-id="${messageId}"]`);
    if (!target) {
      toast.info('The original message is too far back to show here.');
      return;
    }
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlightedId(messageId);
    window.clearTimeout(highlightTimer.current);
    highlightTimer.current = window.setTimeout(() => setHighlightedId(null), 1600);
  }, []);

  const invalidateKeys = useMemo(
    () => [['messages-thread', conversationId]],
    [conversationId]
  );

  return (
    <div ref={containerRef} className={cn('space-y-2', className)}>
      {items.map((item) => {
        if (item.type === 'separator') {
          return <DateSeparator key={item.key} label={item.label} />;
        }

        const { message } = item;

        return (
          <div
            key={item.key}
            data-message-id={message.id}
            className={cn(
              '-mx-2 space-y-0.5 rounded-xl px-2 transition-colors duration-500',
              highlightedId === message.id && 'bg-primary/10'
            )}
          >
            <MessageBubble
              message={message}
              onEdit={onEdit}
              onDelete={onDelete}
              onReply={onReply}
              onJumpToMessage={jumpToMessage}
            />
            <MessageReactionRow
              message={message}
              compact={compactReactions}
              invalidateKeys={invalidateKeys}
              reactFn={(reaction) => db.messages.reactToMessage(message.id, reaction)}
            />
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
