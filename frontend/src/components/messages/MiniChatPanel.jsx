import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { ChevronLeft, ExternalLink, Loader2, Send, X } from 'lucide-react';
import db from '@/api/apiClient';
import UserAvatar from '@/components/users/UserAvatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  glassDialogFaintText,
  glassDialogIconButton,
  glassDialogInputStyles,
  glassDialogMutedText,
  glassDialogPanelStyles,
  glassDialogTitleText,
} from '@/components/layout/glassStyles';
import { displayMentionText } from '@/lib/mentions';
import { getDisplayName } from '@/lib/profile';
import { MESSAGES_INBOX_QUERY_KEY } from '@/lib/queryKeys';
import { BACKGROUND_POLL_INTERVAL_MS } from '@/lib/polling';
import { useVisibleRefetchInterval } from '@/hooks/useVisibleRefetchInterval';
import { useIsUserOnline } from '@/components/presence/UserPresenceGate';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

function MessageBubble({ message }) {
  return (
    <div className={cn('flex', message.is_mine ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed',
          message.is_mine ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'
        )}
      >
        <p className="whitespace-pre-wrap break-words">{displayMentionText(message.body)}</p>
        <p className={cn('mt-1 text-[10px]', message.is_mine ? 'text-primary-foreground/70' : glassDialogFaintText)}>
          {formatDistanceToNow(new Date(message.created_date), { addSuffix: true })}
        </p>
      </div>
    </div>
  );
}

export default function MiniChatPanel({
  user,
  conversationId: initialConversationId,
  onClose,
  onBack,
  onConversationStarted,
  onMessaged,
}) {
  const [draft, setDraft] = useState('');
  const [conversationId, setConversationId] = useState(initialConversationId);
  const bottomRef = useRef(null);
  const queryClient = useQueryClient();
  const pollInterval = useVisibleRefetchInterval(BACKGROUND_POLL_INTERVAL_MS);

  useEffect(() => {
    setConversationId(initialConversationId);
  }, [initialConversationId, user?.id]);

  const { data: threadData, isLoading: threadLoading } = useQuery({
    queryKey: ['messages-thread', conversationId],
    queryFn: () => db.messages.getThread(conversationId),
    enabled: Boolean(conversationId),
    refetchInterval: pollInterval,
    refetchOnWindowFocus: true,
  });

  const messages = Array.isArray(threadData?.messages) ? threadData.messages : [];
  const headerUser = threadData?.conversation?.other_user || user;
  const isCompose = !conversationId;
  const profilePath = headerUser?.id ? `/people/${headerUser.id}` : null;
  const headerPresenceOnline = useIsUserOnline(headerUser?.id);
  const headerIsOnline = headerUser?.is_online ?? headerPresenceOnline;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, conversationId]);

  const sendMessage = useMutation({
    mutationFn: (body) => {
      if (conversationId) {
        return db.messages.sendMessage(conversationId, body);
      }
      return db.messages.startConversation(user.id, body);
    },
    onSuccess: (payload) => {
      setDraft('');

      if (!conversationId && payload?.conversation?.id) {
        setConversationId(payload.conversation.id);
        onConversationStarted?.(payload.conversation.id, payload.conversation.other_user || user);
      }

      onMessaged?.(user.id);

      queryClient.invalidateQueries({ queryKey: ['messages-thread', conversationId || payload?.conversation?.id] });
      queryClient.invalidateQueries({ queryKey: MESSAGES_INBOX_QUERY_KEY });
    },
    onError: (error) => {
      toast.error(error?.message || 'Failed to send message.');
    },
  });

  const handleSubmit = (event) => {
    event.preventDefault();
    const body = draft.trim();
    if (!body || sendMessage.isPending) {
      return;
    }
    sendMessage.mutate(body);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 16, scale: 0.98 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'pointer-events-auto flex w-[min(100vw-1.5rem,320px)] flex-col overflow-hidden rounded-2xl border shadow-xl',
        'h-[min(320px,calc(100dvh-12rem))] lg:h-[min(400px,calc(100dvh-10rem))]',
        glassDialogPanelStyles
      )}
      data-mini-chat
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-border/60 px-3 py-2.5">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className={cn('inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', glassDialogIconButton)}
            aria-label="Back to team list"
            title="Back to team list"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        ) : null}
        {profilePath ? (
          <Link
            to={profilePath}
            className="flex min-w-0 flex-1 items-center gap-2 rounded-lg transition-colors hover:bg-muted/50"
          >
            <UserAvatar user={headerUser} className="h-9 w-9" showOnlineStatus={false} />
            <div className="min-w-0 flex-1">
              <p className={cn('truncate text-sm font-semibold hover:text-primary', glassDialogTitleText)}>
                {getDisplayName(headerUser)}
              </p>
              <p className={cn('text-[11px]', headerIsOnline ? 'font-medium text-success' : glassDialogMutedText)}>
                {headerIsOnline ? 'Online' : 'Away'}
              </p>
            </div>
          </Link>
        ) : (
          <>
            <UserAvatar user={headerUser} className="h-9 w-9" />
            <div className="min-w-0 flex-1">
              <p className={cn('truncate text-sm font-semibold', glassDialogTitleText)}>{getDisplayName(headerUser)}</p>
              <p className={cn('text-[11px]', headerIsOnline ? 'font-medium text-success' : glassDialogMutedText)}>
                {headerIsOnline ? 'Online' : 'Away'}
              </p>
            </div>
          </>
        )}
        {conversationId ? (
          <Link
            to={`/messages/${conversationId}`}
            className={cn('inline-flex h-8 w-8 items-center justify-center rounded-lg', glassDialogIconButton)}
            aria-label="Open in Messages"
            title="Open in Messages"
          >
            <ExternalLink className="h-4 w-4" />
          </Link>
        ) : null}
        {!onBack ? (
          <button
            type="button"
            onClick={onClose}
            className={cn('inline-flex h-8 w-8 items-center justify-center rounded-lg', glassDialogIconButton)}
            aria-label="Close chat"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-3 [scrollbar-width:thin]">
        {isCompose ? (
          <div className={cn('flex h-full items-center justify-center px-4 text-center text-sm', glassDialogMutedText)}>
            Send a message to start the conversation.
          </div>
        ) : threadLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className={cn('h-5 w-5 animate-spin', glassDialogMutedText)} />
          </div>
        ) : messages.length === 0 ? (
          <div className={cn('flex h-full items-center justify-center px-4 text-center text-sm', glassDialogMutedText)}>
            No messages yet. Say hello!
          </div>
        ) : (
          messages.map((message) => <MessageBubble key={message.id} message={message} />)
        )}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex shrink-0 gap-2 border-t border-border/60 p-3"
      >
        <Input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Write a message..."
          className={cn('h-9 text-sm', glassDialogInputStyles)}
          maxLength={2000}
        />
        <Button
          type="submit"
          size="icon"
          className="h-9 w-9 shrink-0"
          disabled={!draft.trim() || sendMessage.isPending}
          aria-label="Send message"
        >
          {sendMessage.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </form>
    </motion.div>
  );
}
