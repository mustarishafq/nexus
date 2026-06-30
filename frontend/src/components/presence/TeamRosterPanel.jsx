import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, Loader2, MessageCircle, Search, Users, X } from 'lucide-react';
import db from '@/api/apiClient';
import UserAvatar from '@/components/users/UserAvatar';
import MiniChatPanel from '@/components/messages/MiniChatPanel';
import { Input } from '@/components/ui/input';
import { useUserPresence } from '@/components/presence/UserPresenceGate';
import { useAuth } from '@/lib/AuthContext';
import { getDisplayName } from '@/lib/profile';
import { MESSAGES_INBOX_QUERY_KEY } from '@/lib/queryKeys';
import { cn } from '@/lib/utils';
import {
  glassDialogIconButton,
  glassDialogInputStyles,
  glassDialogLinkStyles,
  glassDialogMutedText,
  glassDialogPanelStyles,
  glassDialogTitleText,
} from '@/components/layout/glassStyles';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

const PANEL_WIDTH = 300;

function useDebouncedValue(value, delay = 250) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

function matchesSearch(user, query) {
  if (!query) {
    return true;
  }

  const haystack = [
    getDisplayName(user),
    user.email,
    user.department,
    user.job_title,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return haystack.includes(query.toLowerCase());
}

function sortUsersByOnline(users, isOnline) {
  return [...users].sort((a, b) => {
    const aOnline = a.is_online ?? isOnline(a.id);
    const bOnline = b.is_online ?? isOnline(b.id);

    if (aOnline !== bOnline) {
      return aOnline ? -1 : 1;
    }

    return getDisplayName(a).localeCompare(getDisplayName(b), undefined, { sensitivity: 'base' });
  });
}

function organizeUsers(users, recentMessagedAt, isOnline) {
  const recentIds = new Set();
  const recent = [];

  const messagedUsers = users.filter((user) => recentMessagedAt.has(Number(user.id)));

  messagedUsers.sort((a, b) => {
    const aTime = recentMessagedAt.get(Number(a.id)) || 0;
    const bTime = recentMessagedAt.get(Number(b.id)) || 0;

    if (aTime !== bTime) {
      return bTime - aTime;
    }

    return getDisplayName(a).localeCompare(getDisplayName(b), undefined, { sensitivity: 'base' });
  });

  for (const user of messagedUsers) {
    recent.push(user);
    recentIds.add(Number(user.id));
  }

  const remaining = users.filter((user) => !recentIds.has(Number(user.id)));
  const online = [];
  const offline = [];

  for (const user of sortUsersByOnline(remaining, isOnline)) {
    if (user.is_online ?? isOnline(user.id)) {
      online.push(user);
    } else {
      offline.push(user);
    }
  }

  return { recent, online, offline };
}

function RosterRow({ user, isOnline, onChat, opening }) {
  const online = user.is_online ?? isOnline(user.id);

  return (
    <button
      type="button"
      onClick={() => onChat(user)}
      disabled={opening}
      className={cn(
        'group flex w-full items-center gap-3 rounded-xl border border-transparent px-2.5 py-2 text-left transition-all',
        'hover:border-border/80 hover:bg-muted/50 hover:shadow-sm disabled:opacity-60',
        online && 'bg-success/[0.03] hover:bg-success/[0.06]'
      )}
    >
      <div
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-full p-[2px]',
          online ? 'bg-success/40' : 'bg-border/60'
        )}
      >
        <UserAvatar
          user={{ ...user, is_online: online }}
          className="h-9 w-9"
          showOnlineStatus={false}
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className={cn('truncate text-sm font-medium leading-tight', glassDialogTitleText, 'group-hover:text-primary')}>
          {getDisplayName(user)}
        </p>
        <p className={cn(
          'truncate text-[11px] leading-tight',
          online ? 'font-medium text-success' : glassDialogMutedText
        )}
        >
          {online ? 'Online now' : (user.job_title || user.department || 'Away')}
        </p>
      </div>
      {opening ? (
        <Loader2 className={cn('h-4 w-4 shrink-0 animate-spin', glassDialogMutedText)} />
      ) : (
        <MessageCircle className={cn('h-4 w-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-100', glassDialogMutedText)} />
      )}
    </button>
  );
}

function ExpandArrowButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'pointer-events-auto inline-flex h-10 w-7 items-center justify-center rounded-l-xl border border-r-0',
        glassDialogIconButton,
        glassDialogPanelStyles
      )}
      aria-label="Open team list"
      title="Team"
    >
      <ChevronLeft className="h-4 w-4" />
    </button>
  );
}

function UserSection({ title, users, isOnline, onChat, openingUserId, accent = false }) {
  if (users.length === 0) {
    return null;
  }

  return (
    <section className="space-y-1">
      <div className={cn('flex items-center justify-between px-2 py-1', accent && 'text-success')}>
        <p className={cn('text-[11px] font-semibold uppercase tracking-wide', glassDialogMutedText)}>
          {title}
        </p>
        <span className={cn(
          'rounded-full px-2 py-0.5 text-[10px] font-semibold',
          accent ? 'bg-success/10 text-success' : cn('bg-muted', glassDialogMutedText)
        )}
        >
          {users.length}
        </span>
      </div>
      <div className="space-y-0.5">
        {users.map((user) => (
          <RosterRow
            key={user.id}
            user={user}
            isOnline={isOnline}
            onChat={onChat}
            opening={openingUserId === user.id}
          />
        ))}
      </div>
    </section>
  );
}

export default function TeamRosterPanel({ hidden = false }) {
  const { user: authUser } = useAuth();
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [search, setSearch] = useState('');
  const [activeChat, setActiveChat] = useState(null);
  const [openingUserId, setOpeningUserId] = useState(null);
  const panelRef = useRef(null);
  const { isOnline, onlineUserIds } = useUserPresence();
  const debouncedSearch = useDebouncedValue(search.trim());

  const { data, isLoading } = useQuery({
    queryKey: ['user-roster'],
    queryFn: () => db.getUserRoster(),
    staleTime: 60_000,
    enabled: !hidden && expanded,
  });

  const { data: inboxData } = useQuery({
    queryKey: MESSAGES_INBOX_QUERY_KEY,
    queryFn: () => db.messages.listConversations(),
    staleTime: 30_000,
    enabled: !hidden && expanded,
  });

  const users = useMemo(() => {
    const roster = Array.isArray(data?.users) ? data.users : [];
    return roster.filter((user) => String(user.id) !== String(authUser?.id));
  }, [data?.users, authUser?.id]);

  const filteredUsers = useMemo(
    () => users.filter((user) => matchesSearch(user, debouncedSearch)),
    [users, debouncedSearch]
  );

  const recentMessagedAt = useMemo(() => {
    const map = new Map();
    const conversations = Array.isArray(inboxData?.conversations) ? inboxData.conversations : [];

    for (const conversation of conversations) {
      const id = Number(conversation.other_user?.id);
      if (!id) {
        continue;
      }

      const timestamp = conversation.last_message_at
        ? new Date(conversation.last_message_at).getTime()
        : 0;

      map.set(id, Math.max(map.get(id) || 0, timestamp));
    }

    return map;
  }, [inboxData?.conversations]);

  const { recent, online, offline } = useMemo(
    () => organizeUsers(filteredUsers, recentMessagedAt, isOnline),
    [filteredUsers, recentMessagedAt, isOnline, onlineUserIds]
  );

  const onlineCount = onlineUserIds.size;
  const hasResults = recent.length > 0 || online.length > 0 || offline.length > 0;

  useEffect(() => {
    if (!expanded) {
      setSearch('');
    }
  }, [expanded]);

  useEffect(() => {
    if (!expanded) {
      return undefined;
    }

    const handlePointerDown = (event) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      if (panelRef.current?.contains(target)) {
        return;
      }
      if (target instanceof Element && target.closest('[data-mini-chat]')) {
        return;
      }
      setExpanded(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [expanded]);

  const handleOpenChat = async (user) => {
    setOpeningUserId(user.id);

    try {
      const payload = await db.messages.startConversation(user.id);
      const conversationId = payload?.conversation?.id ?? null;
      const chatUser = payload?.conversation?.other_user || payload?.recipient_user || user;

      setActiveChat({ user: chatUser, conversationId });
      setExpanded(false);
    } catch (error) {
      toast.error(error?.message || 'Could not open chat.');
    } finally {
      setOpeningUserId(null);
    }
  };

  const handleBackToList = () => {
    setActiveChat(null);
    setExpanded(true);
  };

  if (hidden && !activeChat) {
    return null;
  }

  return (
    <>
      {!hidden ? (
      <div className="pointer-events-none fixed right-0 top-1/2 z-20 hidden -translate-y-1/2 md:block">
        <AnimatePresence initial={false} mode="wait">
          {!expanded ? (
            <motion.div
              key="toggle"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={{ duration: 0.18 }}
            >
              <ExpandArrowButton onClick={() => setExpanded(true)} />
            </motion.div>
          ) : (
            <motion.aside
              key="panel"
              ref={panelRef}
              initial={{ opacity: 0, x: 16, width: 56 }}
              animate={{ opacity: 1, x: 0, width: PANEL_WIDTH }}
              exit={{ opacity: 0, x: 16, width: 56 }}
              transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
              className={cn(
                'pointer-events-auto mr-3 flex flex-col overflow-hidden rounded-2xl border',
                'max-h-[min(400px,calc(100dvh-12rem))]',
                'lg:max-h-[min(560px,calc(100dvh-10rem))]',
                glassDialogPanelStyles
              )}
            >
              <div className="flex items-start justify-between gap-2 border-b border-border/60 px-4 py-3.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Users className="h-4 w-4" />
                    </span>
                    <div>
                      <p className={cn('text-sm font-semibold tracking-tight', glassDialogTitleText)}>Team</p>
                      <p className={cn('text-[11px]', glassDialogMutedText)}>
                        {onlineCount} online{users.length > 0 ? ` · ${users.length} members` : ''}
                      </p>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setExpanded(false)}
                  className={cn(
                    'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/70',
                    glassDialogIconButton
                  )}
                  aria-label="Close team panel"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="shrink-0 border-b border-border/60 px-3 py-2.5">
                <div className="relative">
                  <Search className={cn('absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2', glassDialogMutedText)} />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search team..."
                    className={cn('h-8 pl-8 pr-8 text-xs', glassDialogInputStyles)}
                  />
                  {search ? (
                    <button
                      type="button"
                      onClick={() => setSearch('')}
                      className={cn('absolute right-2 top-1/2 -translate-y-1/2', glassDialogIconButton)}
                      aria-label="Clear search"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3 [scrollbar-width:thin]">
                {isLoading ? (
                  <div className={cn('flex items-center justify-center py-10', glassDialogMutedText)}>
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                ) : !hasResults ? (
                  <p className={cn('px-2 py-8 text-center text-sm', glassDialogMutedText)}>
                    {debouncedSearch ? 'No matches found.' : 'No colleagues found.'}
                  </p>
                ) : (
                  <div className="space-y-4">
                    <UserSection
                      title="Recent chats"
                      users={recent}
                      isOnline={isOnline}
                      onChat={handleOpenChat}
                      openingUserId={openingUserId}
                    />
                    <UserSection
                      title="Online"
                      users={online}
                      isOnline={isOnline}
                      onChat={handleOpenChat}
                      openingUserId={openingUserId}
                      accent
                    />
                    <UserSection
                      title="Away"
                      users={offline}
                      isOnline={isOnline}
                      onChat={handleOpenChat}
                      openingUserId={openingUserId}
                    />
                  </div>
                )}
              </div>

              <div className="border-t border-border/60 p-3">
                <Link
                  to="/people"
                  onClick={() => setExpanded(false)}
                  className={cn(
                    'flex h-9 items-center justify-center rounded-xl border border-border/70 bg-muted/40 text-xs font-medium',
                    glassDialogLinkStyles,
                    'hover:border-primary/30 hover:bg-primary/[0.04]',
                    'dark:bg-muted/20'
                  )}
                >
                  Browse all people
                </Link>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>
      ) : null}

      <AnimatePresence>
        {activeChat ? (
          <div
            className="pointer-events-none fixed right-3 z-30 hidden md:block"
            style={{ bottom: 'calc(5.25rem + env(safe-area-inset-bottom))' }}
          >
            <MiniChatPanel
              key={activeChat.user?.id || activeChat.conversationId}
              user={activeChat.user}
              conversationId={activeChat.conversationId}
              onBack={handleBackToList}
              onClose={handleBackToList}
              onConversationStarted={(conversationId, user) => {
                setActiveChat({ user, conversationId });
                queryClient.invalidateQueries({ queryKey: MESSAGES_INBOX_QUERY_KEY });
              }}
              onMessaged={() => {
                queryClient.invalidateQueries({ queryKey: MESSAGES_INBOX_QUERY_KEY });
              }}
            />
          </div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
