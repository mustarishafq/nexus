import db from '@/api/apiClient';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { ArrowLeft, Loader2, Mail, MessageSquare, Search, Send, Trash2, Users } from 'lucide-react';
import { useGoBack } from '@/hooks/useGoBack';
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
import { useAuth } from '@/lib/AuthContext';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { displayMentionText } from '@/lib/mentions';
import { getDisplayName } from '@/lib/profile';
import { MESSAGES_INBOX_QUERY_KEY } from '@/lib/queryKeys';
import { BACKGROUND_POLL_INTERVAL_MS } from '@/lib/polling';
import { useVisibleRefetchInterval } from '@/hooks/useVisibleRefetchInterval';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { UnreadBadge } from '@/components/ui/unread-badge';

function useDebouncedValue(value, delay = 250) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

function conversationMatchesQuery(conversation, query) {
  const needle = query.toLowerCase();
  const other = conversation?.other_user;
  const name = getDisplayName(other, '').toLowerCase();
  const fullName = String(other?.full_name || '').toLowerCase();
  const email = String(other?.email || '').toLowerCase();
  const preview = String(conversation?.last_message?.body || '').toLowerCase();
  return name.includes(needle) || fullName.includes(needle) || email.includes(needle) || preview.includes(needle);
}

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

function PeopleSearchResultItem({ user, onSelect, disabled, loading }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onSelect(user)}
      className="flex w-full items-start gap-3 border-b border-border/50 px-4 py-3 text-left transition-colors hover:bg-muted/40 disabled:opacity-60"
    >
      <UserAvatar user={user} className="h-10 w-10" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{getDisplayName(user)}</p>
        {user.department ? (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{user.department}</p>
        ) : user.email ? (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{user.email}</p>
        ) : null}
      </div>
      {loading ? <Loader2 className="mt-1 h-4 w-4 shrink-0 animate-spin text-muted-foreground" /> : null}
    </button>
  );
}

export default function Messages() {
  const { conversationId, userId: composeUserId } = useParams();
  const isCompose = Boolean(composeUserId);
  const navigate = useNavigate();
  const goBack = useGoBack('/messages');
  const queryClient = useQueryClient();
  const { user: authUser } = useAuth();
  const [draft, setDraft] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [peopleResults, setPeopleResults] = useState([]);
  const [peopleSearching, setPeopleSearching] = useState(false);
  const [openingUserId, setOpeningUserId] = useState(null);
  const bottomRef = useRef(null);
  const trimmedSearchQuery = searchQuery.trim();
  const debouncedSearchQuery = useDebouncedValue(trimmedSearchQuery);
  const isSearchActive = trimmedSearchQuery.length > 0;

  useMetaTags({
    title: 'Messages - EMZI Nexus Brain',
    description: 'Direct messages with your colleagues',
  });

  const pollInterval = useVisibleRefetchInterval(BACKGROUND_POLL_INTERVAL_MS);

  const { data: inboxData, isLoading: inboxLoading } = useQuery({
    queryKey: MESSAGES_INBOX_QUERY_KEY,
    queryFn: () => db.messages.listConversations(),
    refetchInterval: pollInterval,
    refetchOnWindowFocus: true,
  });

  const conversations = Array.isArray(inboxData?.conversations) ? inboxData.conversations : [];
  const activeConversation = conversations.find((item) => String(item.id) === String(conversationId));
  const matchedConversations = useMemo(() => {
    if (!trimmedSearchQuery) return [];
    return conversations.filter((conversation) => conversationMatchesQuery(conversation, trimmedSearchQuery));
  }, [conversations, trimmedSearchQuery]);
  const hasMatchedConversations = matchedConversations.length > 0;
  const shouldSearchPeople = isSearchActive && !hasMatchedConversations;
  const isPeopleSearchPending = shouldSearchPeople && (
    peopleSearching || trimmedSearchQuery !== debouncedSearchQuery
  );

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
    refetchInterval: pollInterval,
    refetchOnWindowFocus: true,
  });

  const messages = Array.isArray(threadData?.messages) ? threadData.messages : [];
  const threadUser = activeConversation?.other_user || threadData?.conversation?.other_user;
  const headerUser = isCompose ? composeUser : threadUser;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, conversationId]);

  useEffect(() => {
    if (!shouldSearchPeople || debouncedSearchQuery.length < 1) {
      setPeopleResults([]);
      setPeopleSearching(false);
      return;
    }

    // Wait until debounce matches the live query so we don't search a stale term.
    if (trimmedSearchQuery !== debouncedSearchQuery) {
      return;
    }

    let cancelled = false;
    setPeopleSearching(true);

    db.searchUsers(debouncedSearchQuery, 8)
      .then((users) => {
        if (cancelled) return;
        const list = Array.isArray(users) ? users : [];
        const selfId = authUser?.id != null ? String(authUser.id) : null;
        const inboxUserIds = new Set(
          conversations
            .map((conversation) => conversation?.other_user?.id)
            .filter((id) => id != null)
            .map((id) => String(id))
        );
        setPeopleResults(
          list.filter((user) => {
            const id = String(user.id);
            if (selfId && id === selfId) return false;
            if (inboxUserIds.has(id)) return false;
            return true;
          })
        );
      })
      .catch(() => {
        if (!cancelled) setPeopleResults([]);
      })
      .finally(() => {
        if (!cancelled) setPeopleSearching(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    shouldSearchPeople,
    debouncedSearchQuery,
    trimmedSearchQuery,
    authUser?.id,
    conversations,
  ]);

  const clearSearch = () => {
    setSearchQuery('');
    setPeopleResults([]);
  };

  const openConversationWithUser = async (user) => {
    if (!user?.id || openingUserId) return;
    setOpeningUserId(user.id);
    try {
      const payload = await db.messages.startConversation(user.id);
      clearSearch();
      if (payload?.conversation?.id) {
        navigate(`/messages/${payload.conversation.id}`);
        return;
      }
      navigate(`/messages/new/${user.id}`);
    } catch (error) {
      toast.error(error?.message || 'Could not open conversation.');
    } finally {
      setOpeningUserId(null);
    }
  };

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
        queryClient.invalidateQueries({ queryKey: MESSAGES_INBOX_QUERY_KEY });
        navigate(`/messages/${payload.conversation.id}`);
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['messages-thread', conversationId] });
      queryClient.invalidateQueries({ queryKey: MESSAGES_INBOX_QUERY_KEY });
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
      queryClient.invalidateQueries({ queryKey: MESSAGES_INBOX_QUERY_KEY });
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
    <div className="mx-auto flex h-full min-h-0 w-full max-w-6xl flex-col gap-3 sm:gap-4">
      <PageHeader
        icon={Mail}
        title="Messages"
        description="Direct messages with your colleagues."
        className="shrink-0"
      />

      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden rounded-2xl border border-border bg-card lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className={cn('flex min-h-0 flex-col border-b border-border lg:border-b-0 lg:border-r', showThread && 'hidden lg:flex')}>
          <div className="shrink-0 space-y-3 border-b border-border/60 px-4 py-3">
            <div>
              <p className="text-sm font-semibold">Inbox</p>
              <p className="text-xs text-muted-foreground">
                {inboxData?.unread_total ? `${inboxData.unread_total} unread` : 'All caught up'}
              </p>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search conversations..."
                autoComplete="off"
                className="h-9 pl-9"
                aria-label="Search conversations"
              />
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto pb-4">
            {isSearchActive ? (
              hasMatchedConversations ? (
                matchedConversations.map((conversation) => (
                  <ConversationListItem
                    key={conversation.id}
                    conversation={conversation}
                    active={String(conversation.id) === String(conversationId)}
                    onClick={() => {
                      clearSearch();
                      navigate(`/messages/${conversation.id}`);
                    }}
                    onDelete={setDeleteTarget}
                    deleting={deleteConversation.isPending && String(deleteTarget?.id) === String(conversation.id)}
                  />
                ))
              ) : (
                <div className="flex flex-col">
                  <div className="border-b border-border/50 px-4 py-4">
                    <p className="text-sm font-semibold">No conversation exists</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Start a new conversation with someone below.
                    </p>
                  </div>
                  {isPeopleSearchPending ? (
                    <div className="flex justify-center py-10">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : peopleResults.length === 0 ? (
                    <EmptyState
                      variant="compact"
                      icon={Users}
                      title="No people found"
                      description="Try a different name or email."
                    />
                  ) : (
                    <>
                      <p className="px-4 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Start new conversation
                      </p>
                      {peopleResults.map((user) => (
                        <PeopleSearchResultItem
                          key={user.id}
                          user={user}
                          onSelect={openConversationWithUser}
                          disabled={Boolean(openingUserId)}
                          loading={String(openingUserId) === String(user.id)}
                        />
                      ))}
                    </>
                  )}
                </div>
              )
            ) : inboxLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : conversations.length === 0 ? (
              <EmptyState
                variant="compact"
                icon={Users}
                title="No conversations yet"
                description="Search above to message a colleague."
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

        <div className={cn('flex min-h-0 flex-col overflow-hidden', !showThread && 'hidden lg:flex')}>
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
              <div className="flex shrink-0 items-center gap-3 border-b border-border/60 px-4 py-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="lg:hidden"
                  onClick={goBack}
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
                className="flex shrink-0 gap-2 border-t border-border/60 p-4"
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
