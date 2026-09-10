import React, { useMemo } from 'react';
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
  compactReactions = false,
  bottomRef,
  className,
}) {
  const items = useMemo(() => groupMessagesWithDateSeparators(messages), [messages]);

  const invalidateKeys = useMemo(
    () => [['messages-thread', conversationId]],
    [conversationId]
  );

  return (
    <div className={cn('space-y-2', className)}>
      {items.map((item) => {
        if (item.type === 'separator') {
          return <DateSeparator key={item.key} label={item.label} />;
        }

        const { message } = item;

        return (
          <div key={item.key} className="space-y-0.5">
            <MessageBubble message={message} onEdit={onEdit} onDelete={onDelete} />
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
