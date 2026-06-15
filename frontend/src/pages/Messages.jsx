import db from '@/api/base44Client';
import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { ArrowLeft, Loader2, Mail, MessageSquare, Send, Trash2, Users } from 'lucide-react';
import { useMetaTags } from '@/hooks/useMetaTags';
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
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { displayMentionText } from '@/lib/mentions';
import { getDisplayName } from '@/lib/profile';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { UnreadBadge } from '@/components/ui/unread-badge';

function ConversationListItem({ conversation, active, onClick, onDelete, deleting }) {
  const other = conversation.other_user;
  const preview = conversation.last_message?.body || 'No messages yet';
  const unread = conversation.unread_count || 0;

  return (
    <div
      className={cn(
        'group flex items-start gap-2 border-b border-border/50 px-4 py-3 transition-colors hover:bg-muted/40',
        active && 'bg-primary/5'
      )}
    >
      <button type="button" onClick={onClick} className="flex min-w-0 flex-1 items-start gap-3 text-left">
        <UserAvatar user={other} className="h-10 w-10" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-semibold">{getDisplayName(other)}</p>
            {conversation.last_message_at ? (
              <span className="shrink-0 text-[10px] text-muted-foreground">
                {formatDistanceToNow(new Date(conversation.last_message_at), { addSuffix: true })}
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{preview}</p>
        </div>
        <UnreadBadge count={unread} className="mt-1" />
      </button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="mt-0.5 h-8 w-8 shrink-0 text-muted-foreground opacity-100 transition-opacity hover:text-destructive sm:opacity-0 sm:group-hover:opacity-100"
        disabled={deleting}
        onClick={(event) => {
          event.stopPropagation();
          onDelete(conversation);
        }}
        aria-label={`Delete conversation with ${getDisplayName(other, 'user')}`}
      >
        {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
      </Button>
    </div>
  );
}

function MessageBubble({ message }) {
  return (
    <div className={cn('flex', message.is_mine ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
          message.is_mine ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'
        )}
      >
        {!message.is_mine ? (
          <p className="mb-1 text-[11px] font-semibold opacity-80">{getDisplayName(message.sender)}</p>
        ) : null}
        <p className="whitespace-pre-wrap break-words">{displayMentionText(message.body)}</p>
        <p className={cn('mt-1 text-[10px]', message.is_mine ? 'text-primary-foreground/70' : 'text-muted-foreground')}>
          {formatDistanceToNow(new Date(message.created_date), { addSuffix: true })}
        </p>
      </div>
    </div>
  );
}

export default function Messages() {
  const { conversationId, userId: composeUserId } = useParams();
  const isCompose = Boolean(composeUserId);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const bottomRef = useRef(null);

  useMetaTags({
    title: 'Messages - EMZI Nexus Brain',
    description: 'Direct messages with your colleagues',
  });

  const { data: inboxData, isLoading: inboxLoading } = useQuery({
    queryKey: ['messages-inbox'],
    queryFn: () => db.messages.listConversations(),
    refetchInterval: 15_000,
  });

  const conversations = Array.isArray(inboxData?.conversations) ? inboxData.conversations : [];
  const activeConversation = conversations.find((item) => String(item.id) === String(conversationId));

  const { data: composeUserData, isLoading: composeUserLoading } = useQuery({
    queryKey: ['user-profile', composeUserId],
    queryFn: () => db.getUserProfile(composeUserId),
    enabled: isCompose,
    retry: false,
  });

  const composeUser = composeUserData?.user;

  const { data: threadData, isLoading: threadLoading } = useQuery({
    queryKey: ['messages-thread', conversationId],
    queryFn: () => db.messages.getThread(conversationId),
    enabled: Boolean(conversationId) && !isCompose,
    refetchInterval: 10_000,
  });

  const messages = Array.isArray(threadData?.messages) ? threadData.messages : [];
  const threadUser = activeConversation?.other_user || threadData?.conversation?.other_user;
  const headerUser = isCompose ? composeUser : threadUser;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, conversationId]);

  const sendMessage = useMutation({
    mutationFn: (body) => {
      if (isCompose) {
        return db.messages.startConversation(composeUserId, body);
      }
      return db.messages.sendMessage(conversationId, body);
    },
    onSuccess: (payload) => {
      setDraft('');
      if (isCompose && payload?.conversation?.id) {
        queryClient.invalidateQueries({ queryKey: ['messages-inbox'] });
        navigate(`/messages/${payload.conversation.id}`);
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['messages-thread', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['messages-inbox'] });
    },
    onError: (error) => {
      toast.error(error?.message || 'Failed to send message.');
    },
  });

  const showThread = Boolean(conversationId) || isCompose;

  const deleteConversation = useMutation({
    mutationFn: (id) => db.messages.deleteConversation(id),
    onSuccess: (_payload, deletedId) => {
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ['messages-inbox'] });
      queryClient.removeQueries({ queryKey: ['messages-thread', deletedId] });
      if (String(conversationId) === String(deletedId)) {
        navigate('/messages');
      }
      toast.success('Conversation deleted.');
    },
    onError: (error) => {
      toast.error(error?.message || 'Failed to delete conversation.');
    },
  });

  const confirmDelete = () => {
    if (!deleteTarget?.id) return;
    deleteConversation.mutate(deleteTarget.id);
  };

  return (
    <div className="mx-auto flex h-[calc(100vh-10rem)] max-w-6xl flex-col gap-4">
      <PageHeader
        icon={Mail}
        title="Messages"
        description="Direct messages with your colleagues."
      />

      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden rounded-2xl border border-border bg-card lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className={cn('border-b border-border lg:border-b-0 lg:border-r', showThread && 'hidden lg:block')}>
          <div className="border-b border-border/60 px-4 py-3">
            <p className="text-sm font-semibold">Inbox</p>
            <p className="text-xs text-muted-foreground">
              {inboxData?.unread_total ? `${inboxData.unread_total} unread` : 'All caught up'}
            </p>
          </div>
          <div className="max-h-full overflow-y-auto">
            {inboxLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : conversations.length === 0 ? (
              <EmptyState
                variant="compact"
                icon={Users}
                title="No conversations yet"
                description="Find a colleague and start a conversation from their profile."
                action={(
                  <Button asChild variant="outline" size="sm">
                    <Link to="/people">Browse people</Link>
                  </Button>
                )}
              />
            ) : (
              conversations.map((conversation) => (
                <ConversationListItem
                  key={conversation.id}
                  conversation={conversation}
                  active={String(conversation.id) === String(conversationId)}
                  onClick={() => navigate(`/messages/${conversation.id}`)}
                  onDelete={setDeleteTarget}
                  deleting={deleteConversation.isPending && String(deleteTarget?.id) === String(conversation.id)}
                />
              ))
            )}
          </div>
        </div>

        <div className={cn('flex min-h-0 flex-col', !showThread && 'hidden lg:flex')}>
          {!showThread ? (
            <EmptyState
              variant="inline"
              icon={MessageSquare}
              title="Select a conversation"
              description="Choose someone from your inbox to view the thread."
              className="flex-1"
            />
          ) : (
            <>
              <div className="flex items-center gap-3 border-b border-border/60 px-4 py-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="lg:hidden"
                  onClick={() => navigate('/messages')}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <UserAvatar user={headerUser} className="h-9 w-9" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {getDisplayName(headerUser, 'Conversation')}
                  </p>
                  {headerUser?.department ? (
                    <p className="truncate text-xs text-muted-foreground">
                      {headerUser.department}
                    </p>
                  ) : null}
                </div>
                <div className="ml-auto flex items-center gap-1">
                  {headerUser?.id ? (
                    <Link to={`/people/${headerUser.id}`} className="px-2 text-xs text-primary hover:underline">
                      View profile
                    </Link>
                  ) : null}
                  {!isCompose && conversationId ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => setDeleteTarget(activeConversation || { id: conversationId, other_user: headerUser })}
                      aria-label="Delete conversation"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  ) : null}
                </div>
              </div>

              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
                {isCompose ? (
                  composeUserLoading ? (
                    <div className="flex justify-center py-10">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
                      Send a message to start the conversation.
                    </div>
                  )
                ) : threadLoading ? (
                  <div className="flex justify-center py-10">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  messages.map((message) => <MessageBubble key={message.id} message={message} />)
                )}
                <div ref={bottomRef} />
              </div>

              <form
                className="flex gap-2 border-t border-border/60 p-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  const body = draft.trim();
                  if (!body) return;
                  sendMessage.mutate(body);
                }}
              >
                <Input
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="Write a message..."
                  maxLength={2000}
                  className="h-10"
                />
                <Button type="submit" disabled={sendMessage.isPending || !draft.trim()}>
                  {sendMessage.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete your conversation with{' '}
              {getDisplayName(deleteTarget?.other_user, 'this colleague')} for both participants.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteConversation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleteConversation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteConversation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
