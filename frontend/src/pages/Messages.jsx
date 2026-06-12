import db from '@/api/base44Client';
import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { ArrowLeft, Loader2, Mail, Send } from 'lucide-react';
import { useMetaTags } from '@/hooks/useMetaTags';
import UserAvatar from '@/components/users/UserAvatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { displayMentionText } from '@/lib/mentions';

function ConversationListItem({ conversation, active, onClick }) {
  const other = conversation.other_user;
  const preview = conversation.last_message?.body || 'No messages yet';
  const unread = conversation.unread_count || 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-start gap-3 border-b border-border/50 px-4 py-3 text-left transition-colors hover:bg-muted/40',
        active && 'bg-primary/5'
      )}
    >
      <UserAvatar user={other} className="h-10 w-10" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-semibold">{other?.full_name || 'User'}</p>
          {conversation.last_message_at ? (
            <span className="shrink-0 text-[10px] text-muted-foreground">
              {formatDistanceToNow(new Date(conversation.last_message_at), { addSuffix: true })}
            </span>
          ) : null}
        </div>
        <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{preview}</p>
      </div>
      {unread > 0 ? (
        <span className="mt-1 min-w-[18px] rounded-full bg-primary px-1.5 text-center text-[10px] font-bold leading-[18px] text-primary-foreground">
          {unread > 99 ? '99+' : unread}
        </span>
      ) : null}
    </button>
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
          <p className="mb-1 text-[11px] font-semibold opacity-80">{message.sender?.full_name || 'User'}</p>
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
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState('');
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

  const { data: threadData, isLoading: threadLoading } = useQuery({
    queryKey: ['messages-thread', conversationId],
    queryFn: () => db.messages.getThread(conversationId),
    enabled: Boolean(conversationId),
    refetchInterval: 10_000,
  });

  const messages = Array.isArray(threadData?.messages) ? threadData.messages : [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, conversationId]);

  const sendMessage = useMutation({
    mutationFn: (body) => db.messages.sendMessage(conversationId, body),
    onSuccess: () => {
      setDraft('');
      queryClient.invalidateQueries({ queryKey: ['messages-thread', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['messages-inbox'] });
    },
    onError: (error) => {
      toast.error(error?.message || 'Failed to send message.');
    },
  });

  return (
    <div className="mx-auto flex h-[calc(100vh-10rem)] max-w-6xl flex-col gap-4">
      <div className="flex items-center gap-2">
        <Mail className="h-5 w-5 text-primary" />
        <h1 className="text-2xl font-bold tracking-tight">Messages</h1>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden rounded-2xl border border-border bg-card lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className={cn('border-b border-border lg:border-b-0 lg:border-r', conversationId && 'hidden lg:block')}>
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
              <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                No conversations yet. Message someone from their profile.
              </div>
            ) : (
              conversations.map((conversation) => (
                <ConversationListItem
                  key={conversation.id}
                  conversation={conversation}
                  active={String(conversation.id) === String(conversationId)}
                  onClick={() => navigate(`/messages/${conversation.id}`)}
                />
              ))
            )}
          </div>
        </div>

        <div className={cn('flex min-h-0 flex-col', !conversationId && 'hidden lg:flex')}>
          {!conversationId ? (
            <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-muted-foreground">
              Select a conversation to start chatting.
            </div>
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
                <UserAvatar user={activeConversation?.other_user || threadData?.conversation?.other_user} className="h-9 w-9" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {activeConversation?.other_user?.full_name ||
                      threadData?.conversation?.other_user?.full_name ||
                      'Conversation'}
                  </p>
                  {activeConversation?.other_user?.department ? (
                    <p className="truncate text-xs text-muted-foreground">
                      {activeConversation.other_user.department}
                    </p>
                  ) : null}
                </div>
                {activeConversation?.other_user?.id ? (
                  <Link to={`/people/${activeConversation.other_user.id}`} className="ml-auto text-xs text-primary hover:underline">
                    View profile
                  </Link>
                ) : null}
              </div>

              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
                {threadLoading ? (
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
    </div>
  );
}
