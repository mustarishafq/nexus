import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ExternalLink, Loader2, Send, X } from 'lucide-react';
import db from '@/api/apiClient';
import UserAvatar from '@/components/users/UserAvatar';
import { Button } from '@/components/ui/button';
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
  glassDialogIconButton,
  glassDialogInputStyles,
  glassDialogMutedText,
  glassDialogPanelStyles,
  glassDialogTitleText,
} from '@/components/layout/glassStyles';
import { useMessageActions } from '@/hooks/useMessageActions';
import MessageThread from '@/components/messages/MessageThread';
import { getDisplayName } from '@/lib/profile';
import { MESSAGES_INBOX_QUERY_KEY } from '@/lib/queryKeys';
import { BACKGROUND_POLL_INTERVAL_MS } from '@/lib/polling';
import { useVisibleRefetchInterval } from '@/hooks/useVisibleRefetchInterval';
import { useIsUserOnline } from '@/components/presence/UserPresenceGate';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

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
  const [editingMessage, setEditingMessage] = useState(null);
  const [deleteMessageTarget, setDeleteMessageTarget] = useState(null);
  const bottomRef = useRef(null);
  const queryClient = useQueryClient();
  const pollInterval = useVisibleRefetchInterval(BACKGROUND_POLL_INTERVAL_MS);

  useEffect(() => {
    setConversationId(initialConversationId);
    setEditingMessage(null);
    setDraft('');
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

  const { updateMessage, deleteMessage } = useMessageActions(conversationId);

  const beginEditMessage = (message) => {
    setEditingMessage(message);
    setDraft(message.body || '');
  };

  const cancelEditMessage = () => {
    setEditingMessage(null);
    setDraft('');
  };

  const confirmDeleteMessage = () => {
    if (!deleteMessageTarget?.id) return;
    deleteMessage.mutate(deleteMessageTarget.id, {
      onSuccess: () => setDeleteMessageTarget(null),
    });
  };

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

  const isSubmitting = editingMessage ? updateMessage.isPending : sendMessage.isPending;

  const handleSubmit = (event) => {
    event.preventDefault();
    const body = draft.trim();
    if (!body || isSubmitting) {
      return;
    }

    if (editingMessage) {
      updateMessage.mutate(
        { id: editingMessage.id, body },
        { onSuccess: () => { setEditingMessage(null); setDraft(''); } }
      );
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
          <MessageThread
            messages={messages}
            conversationId={conversationId}
            onEdit={beginEditMessage}
            onDelete={setDeleteMessageTarget}
            compactReactions
            bottomRef={bottomRef}
          />
        )}
      </div>

      {editingMessage ? (
        <p className="flex shrink-0 items-center justify-between gap-2 border-t border-border/60 px-3 py-1 text-[11px]">
          <span className={glassDialogMutedText}>Editing message</span>
          <button
            type="button"
            onClick={cancelEditMessage}
            className={cn('font-medium hover:underline', glassDialogTitleText)}
          >
            Cancel
          </button>
        </p>
      ) : null}
      <form
        onSubmit={handleSubmit}
        className="flex shrink-0 gap-2 border-t border-border/60 p-3"
      >
        <Input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={editingMessage ? 'Edit your message...' : 'Write a message...'}
          className={cn('h-9 text-sm', glassDialogInputStyles)}
          maxLength={2000}
          autoFocus={Boolean(editingMessage)}
        />
        {editingMessage ? (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={cancelEditMessage}
            disabled={updateMessage.isPending}
            aria-label="Cancel edit"
          >
            <X className="h-4 w-4" />
          </Button>
        ) : null}
        <Button
          type="submit"
          size="icon"
          className="h-9 w-9 shrink-0"
          disabled={!draft.trim() || isSubmitting}
          aria-label={editingMessage ? 'Save message' : 'Send message'}
        >
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </form>

      <AlertDialog open={Boolean(deleteMessageTarget)} onOpenChange={(open) => !open && setDeleteMessageTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this message?</AlertDialogTitle>
            <AlertDialogDescription>
              It will show as &quot;This message has been deleted&quot; for both participants. This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMessage.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteMessage}
              disabled={deleteMessage.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMessage.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}
