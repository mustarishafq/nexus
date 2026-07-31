import db from '@/api/apiClient';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, isToday, isTomorrow, parseISO, startOfWeek, endOfWeek } from 'date-fns';
import { AnimatePresence, motion } from 'framer-motion';
import { Cake, Award, MessageCircle, PartyPopper, SmilePlus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import MiniChatPanel from '@/components/messages/MiniChatPanel';
import { reactionMotion, spawnReactionBurst } from '@/components/feed/ReactionBurst';
import { useIsMobile } from '@/hooks/use-mobile';
import { getDisplayName } from '@/lib/profile';
import { MESSAGES_INBOX_QUERY_KEY } from '@/lib/queryKeys';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import UserAvatar from '@/components/users/UserAvatar';

const DEFAULT_REACTIONS = ['🎉', '🎂', '👏', '🎈', '❤️', '🥳', '🙌'];

function ScrollingName({ name, className }) {
  const containerRef = useRef(null);
  const textRef = useRef(null);
  const [overflowPx, setOverflowPx] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    const text = textRef.current;
    if (!container || !text) return undefined;

    const measure = () => {
      setOverflowPx(Math.max(0, Math.ceil(text.scrollWidth - container.clientWidth)));
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, [name]);

  const shouldScroll = overflowPx > 4;
  const durationSec = Math.min(22, Math.max(10, overflowPx / 8));

  return (
    <div
      ref={containerRef}
      className={cn(
        'min-w-0 overflow-hidden',
        shouldScroll && 'celebration-name-viewport',
        className
      )}
      title={name}
    >
      <p
        ref={textRef}
        className={cn(
          'whitespace-nowrap text-sm font-semibold leading-tight',
          shouldScroll && 'celebration-name-track'
        )}
        style={
          shouldScroll
            ? {
                '--celebration-name-shift': `-${overflowPx}px`,
                animationDuration: `${durationSec}s`,
              }
            : undefined
        }
      >
        {name}
      </p>
    </div>
  );
}

function celebrationsQueryKey(localDate) {
  return ['dashboard-celebrations', localDate];
}

function parseCelebrationDate(celebrationDate) {
  if (!celebrationDate) return null;
  return typeof celebrationDate === 'string' ? parseISO(celebrationDate) : celebrationDate;
}

function groupByCelebrationDate(items) {
  const groups = [];
  const indexByDate = new Map();

  for (const person of items) {
    const key = person.celebration_date || 'unknown';
    if (!indexByDate.has(key)) {
      indexByDate.set(key, groups.length);
      groups.push({ dateKey: key, date: parseCelebrationDate(person.celebration_date), people: [] });
    }
    groups[indexByDate.get(key)].people.push(person);
  }

  return groups;
}

function updateCelebrationPerson(queryClient, queryKey, recipientUserId, celebrationType, updater) {
  const listKey = celebrationType === 'birthday' ? 'birthdays' : 'service_anniversaries';

  queryClient.setQueryData(queryKey, (current) => {
    if (!current) return current;

    return {
      ...current,
      [listKey]: current[listKey].map((person) =>
        person.id === recipientUserId ? updater(person) : person
      ),
    };
  });
}

function findPersonByReactionId(data, reactionId) {
  if (!data) return null;

  for (const celebrationType of ['birthday', 'service_anniversary']) {
    const listKey = celebrationType === 'birthday' ? 'birthdays' : 'service_anniversaries';

    for (const person of data[listKey] || []) {
      const reaction = person.my_reaction ?? person.my_wish;
      if (reaction?.id === reactionId) {
        return { person, celebrationType };
      }
    }
  }

  return null;
}

function applyReactionChange(person, reaction, reactionId = person.my_reaction?.id ?? person.my_wish?.id) {
  const previousReaction = person.my_reaction?.reaction ?? person.my_wish?.reaction ?? null;
  const counts = { ...(person.reaction_counts || {}) };

  if (previousReaction) {
    counts[previousReaction] = (counts[previousReaction] || 1) - 1;
    if (counts[previousReaction] <= 0) {
      delete counts[previousReaction];
    }
  }

  if (reaction) {
    counts[reaction] = (counts[reaction] || 0) + 1;
  }

  const reactionsCount = Object.values(counts).reduce((total, count) => total + count, 0);

  return {
    ...person,
    reactions_count: reactionsCount,
    reaction_counts: counts,
    my_reaction: reaction ? { id: reactionId, reaction } : null,
    my_wish: reaction ? { id: reactionId, reaction } : null,
  };
}

function celebrationGroupLabel(date) {
  if (!date) return 'Soon';
  if (isToday(date)) return `Today · ${format(date, 'MMM d')}`;
  if (isTomorrow(date)) return `Tomorrow · ${format(date, 'MMM d')}`;
  return format(date, 'EEE · MMM d');
}

function ReactionSummary({ reactionCounts, limit = 3 }) {
  const entries = Object.entries(reactionCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);

  if (entries.length === 0) return null;

  const total = Object.values(reactionCounts).reduce((sum, count) => sum + count, 0);

  return (
    <span
      className="inline-flex max-w-full items-center gap-1 rounded-full border border-border/60 bg-muted/60 px-1.5 py-0.5"
      title={Object.entries(reactionCounts)
        .map(([emoji, count]) => `${emoji} ${count}`)
        .join(' · ')}
    >
      <span className="inline-flex items-center gap-0.5">
        {entries.map(([emoji]) => (
          <span key={emoji} className="text-[11px] leading-none">
            {emoji}
          </span>
        ))}
      </span>
      {total > 0 ? (
        <span className="text-[10px] font-medium tabular-nums leading-none text-muted-foreground">
          {total}
        </span>
      ) : null}
    </span>
  );
}

function CelebrationFeedCard({
  person,
  celebrationType,
  celebrationDate,
  subtitle,
  accent,
  reactions,
  onReact,
  onMessage,
  isSubmitting,
  isMessaging,
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const canReact = person.can_react ?? person.can_wish !== false;
  const canMessage = canReact;
  const myReaction = person.my_reaction?.reaction ?? person.my_wish?.reaction ?? null;
  const reactionCounts = person.reaction_counts || {};
  const date = parseCelebrationDate(celebrationDate);
  const today = date ? isToday(date) : false;
  const displayName = getDisplayName(person, person.email);
  const hasReactions = Object.keys(reactionCounts).length > 0;
  const hasMeta = Boolean(subtitle) || hasReactions;

  const accentStyles = {
    birthday: {
      avatar: 'bg-pink-500/10 text-pink-600 dark:text-pink-400',
      todayRow: 'bg-pink-500/[0.05]',
    },
    anniversary: {
      avatar: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
      todayRow: 'bg-amber-500/[0.05]',
    },
  }[accent];

  const handleReact = (reaction, event) => {
    if (!canReact || isSubmitting) return;

    const reactionId = person.my_reaction?.id ?? person.my_wish?.id;
    if (myReaction === reaction && reactionId) {
      onReact({ removeReactionId: reactionId });
      setPickerOpen(false);
      return;
    }

    if (event) {
      spawnReactionBurst(reaction, event.clientX, event.clientY);
    }

    onReact({
      recipientUserId: person.id,
      celebrationType,
      celebrationDate,
      reaction,
    });
    setPickerOpen(false);
  };

  const wishLabel =
    celebrationType === 'service_anniversary' ? 'Send anniversary message' : 'Send birthday message';

  return (
    <div
      className={cn(
        'flex items-center gap-2.5 px-3 py-2.5 transition-colors sm:gap-3 sm:px-3.5',
        today && accentStyles.todayRow
      )}
    >
      <UserAvatar
        user={person}
        className="h-8 w-8 shrink-0"
        fallbackClassName={cn('text-[10px] font-bold', accentStyles.avatar)}
      />

      <div className="min-w-0 flex-1">
        <ScrollingName name={displayName} />
        {hasMeta ? (
          <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[11px] leading-tight text-muted-foreground">
            {subtitle ? <span className="min-w-0 truncate">{subtitle}</span> : null}
            <ReactionSummary reactionCounts={reactionCounts} />
          </div>
        ) : null}
      </div>

      {(canReact || canMessage) ? (
        <div className="flex shrink-0 items-center gap-1">
          {canMessage ? (
            <motion.button
              type="button"
              disabled={isMessaging}
              title={wishLabel}
              aria-label={wishLabel}
              whileHover={reactionMotion.whileHover}
              whileTap={reactionMotion.whileTap}
              transition={reactionMotion.spring}
              onClick={() => onMessage?.(person, celebrationType)}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-border/70 bg-background text-muted-foreground transition-colors hover:border-primary/30 hover:bg-muted hover:text-primary"
            >
              <MessageCircle className="h-3.5 w-3.5" />
            </motion.button>
          ) : null}

          {canReact ? (
            <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
              <PopoverTrigger asChild>
                <motion.button
                  type="button"
                  disabled={isSubmitting}
                  title="React"
                  whileHover={reactionMotion.whileHover}
                  whileTap={reactionMotion.whileTap}
                  transition={reactionMotion.spring}
                  className={cn(
                    'inline-flex h-7 w-7 items-center justify-center rounded-full border border-border/70 bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
                    myReaction && 'border-primary/30 bg-primary/5 text-primary'
                  )}
                >
                  {myReaction ? (
                    <span className="text-sm leading-none">{myReaction}</span>
                  ) : (
                    <SmilePlus className="h-3.5 w-3.5" />
                  )}
                </motion.button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-auto p-2">
                <div className="flex gap-1">
                  {reactions.map((reaction) => (
                    <motion.button
                      key={reaction}
                      type="button"
                      disabled={isSubmitting}
                      whileHover={reactionMotion.whileHover}
                      whileTap={reactionMotion.whileTap}
                      transition={reactionMotion.spring}
                      onClick={(event) => handleReact(reaction, event)}
                      title={myReaction === reaction ? 'Remove reaction' : `React with ${reaction}`}
                      className={cn(
                        'h-9 w-9 rounded-full text-lg hover:bg-muted',
                        myReaction === reaction && 'bg-primary/10 ring-2 ring-primary/30'
                      )}
                    >
                      {reaction}
                    </motion.button>
                  ))}
                </div>
                {hasReactions ? (
                  <div className="mt-2 flex flex-wrap gap-1 border-t border-border/60 pt-2">
                    {Object.entries(reactionCounts)
                      .sort((a, b) => b[1] - a[1])
                      .map(([emoji, count]) => (
                        <span
                          key={emoji}
                          className="inline-flex items-center gap-1 rounded-full bg-muted/80 px-2 py-0.5 text-xs"
                        >
                          <span>{emoji}</span>
                          <span className="tabular-nums text-muted-foreground">{count}</span>
                        </span>
                      ))}
                  </div>
                ) : null}
              </PopoverContent>
            </Popover>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function CelebrationFeed({
  items,
  celebrationType,
  accent,
  subtitleFor,
  reactions,
  onReact,
  onMessage,
  isSubmitting,
  messagingUserId,
  emptyMessage,
  emptyHint,
}) {
  const groups = useMemo(() => groupByCelebrationDate(items), [items]);

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <div
          className={cn(
            'mb-3 flex h-10 w-10 items-center justify-center rounded-xl',
            accent === 'anniversary' ? 'bg-amber-500/10' : 'bg-pink-500/10'
          )}
        >
          {accent === 'anniversary' ? (
            <Award className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          ) : (
            <Cake className="h-4 w-4 text-pink-600 dark:text-pink-400" />
          )}
        </div>
        <p className="text-sm font-medium">{emptyMessage}</p>
        {emptyHint ? (
          <p className="mt-1 text-xs text-muted-foreground">{emptyHint}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="overflow-hidden divide-y divide-border/70 rounded-xl border border-border/70 bg-muted/10">
      {groups.map((group) => {
        const isTodayGroup = group.date ? isToday(group.date) : false;
        const headerTone =
          accent === 'anniversary'
            ? 'text-amber-700 dark:text-amber-300'
            : 'text-pink-700 dark:text-pink-300';

        return (
          <div key={group.dateKey}>
            <div
              className={cn(
                'flex items-center justify-between gap-2 border-b border-border/50 px-3 py-1.5',
                'bg-muted/50',
                isTodayGroup && (accent === 'anniversary' ? 'bg-amber-500/10' : 'bg-pink-500/10')
              )}
            >
              <p
                className={cn(
                  'text-[11px] font-semibold tracking-wide',
                  isTodayGroup ? headerTone : 'text-muted-foreground'
                )}
              >
                {celebrationGroupLabel(group.date)}
              </p>
              <span className="text-[10px] tabular-nums text-muted-foreground">
                {group.people.length}
              </span>
            </div>
            {group.people.map((person) => (
              <CelebrationFeedCard
                key={`${person.id}-${person.celebration_date || celebrationType}`}
                person={person}
                celebrationType={celebrationType}
                celebrationDate={person.celebration_date}
                subtitle={subtitleFor?.(person)}
                accent={accent}
                reactions={reactions}
                onReact={onReact}
                onMessage={onMessage}
                isSubmitting={isSubmitting}
                isMessaging={messagingUserId === person.id}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}

export default function TodaysCelebrationsWidget({ embedded = false }) {
  const today = new Date();
  const localDate = format(today, 'yyyy-MM-dd');
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
  const queryClient = useQueryClient();
  const queryKey = celebrationsQueryKey(localDate);
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [activeChat, setActiveChat] = useState(null);
  const [messagingUserId, setMessagingUserId] = useState(null);

  const { data, isLoading, isError } = useQuery({
    queryKey,
    queryFn: () => db.dashboard.celebrations({ date: localDate }),
    staleTime: 60 * 1000,
  });

  const reactMutation = useMutation({
    mutationFn: async ({ removeReactionId, recipientUserId, celebrationType, celebrationDate, reaction }) => {
      if (removeReactionId) {
        return db.dashboard.removeReaction(removeReactionId);
      }
      return db.dashboard.sendReaction({
        recipient_user_id: recipientUserId,
        celebration_type: celebrationType,
        celebration_date: celebrationDate,
        reaction,
      });
    },
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData(queryKey);

      if (variables.removeReactionId) {
        const match = findPersonByReactionId(previous, variables.removeReactionId);
        if (match) {
          updateCelebrationPerson(
            queryClient,
            queryKey,
            match.person.id,
            match.celebrationType,
            (person) => applyReactionChange(person, null, null)
          );
        }
      } else {
        updateCelebrationPerson(
          queryClient,
          queryKey,
          variables.recipientUserId,
          variables.celebrationType,
          (person) => applyReactionChange(person, variables.reaction, person.my_reaction?.id ?? 'optimistic')
        );
      }

      return { previous };
    },
    onSuccess: (result, variables) => {
      if (!variables.removeReactionId && result?.reaction?.id) {
        updateCelebrationPerson(
          queryClient,
          queryKey,
          variables.recipientUserId,
          variables.celebrationType,
          (person) => ({
            ...person,
            my_reaction: { id: result.reaction.id, reaction: variables.reaction },
            my_wish: { id: result.reaction.id, reaction: variables.reaction },
          })
        );
      }

      toast.success(variables.removeReactionId ? 'Reaction removed.' : 'Reaction sent!');
    },
    onError: (error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
      toast.error(error?.data?.message || error?.message || 'Could not save reaction.');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const handleMessage = async (person) => {
    if (!person?.id || messagingUserId) return;

    setMessagingUserId(person.id);
    try {
      const payload = await db.messages.startConversation(person.id);
      const conversationId = payload?.conversation?.id ?? null;
      const chatUser = payload?.conversation?.other_user || payload?.recipient_user || person;

      if (isMobile) {
        if (conversationId) {
          navigate(`/messages/${conversationId}`);
        } else {
          navigate(`/messages/new/${person.id}`);
        }
        return;
      }

      setActiveChat({ user: chatUser, conversationId });
    } catch (error) {
      if (isMobile) {
        navigate(`/messages/new/${person.id}`);
        return;
      }
      toast.error(error?.message || 'Could not open chat.');
    } finally {
      setMessagingUserId(null);
    }
  };

  const birthdays = data?.birthdays || [];
  const serviceAnniversaries = data?.service_anniversaries || [];
  const reactions = data?.reactions || DEFAULT_REACTIONS;
  const defaultTab = birthdays.length > 0 ? 'birthdays' : 'anniversaries';
  const totalCount = birthdays.length + serviceAnniversaries.length;

  const containerClass = embedded
    ? 'bg-transparent border-0 rounded-none'
    : 'bg-card rounded-2xl border border-border';

  const weekLabel = `${format(weekStart, 'MMM d')} – ${format(weekEnd, 'MMM d')}`;

  return (
    <>
      <div className={containerClass}>
        <div className="flex items-start gap-3 p-5 pb-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <PartyPopper className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm">Celebrations</h3>
              {totalCount > 0 ? (
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-medium">
                  {totalCount}
                </Badge>
              ) : null}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">{weekLabel}</p>
          </div>
        </div>

        {isLoading ? (
          <p className="px-5 pb-5 text-sm text-muted-foreground text-center py-6">Loading celebrations...</p>
        ) : isError ? (
          <p className="px-5 pb-5 text-sm text-destructive text-center py-6">Could not load celebrations.</p>
        ) : (
          <Tabs defaultValue={defaultTab} className="px-5 pb-5">
            <TabsList className="grid w-full grid-cols-2 h-auto p-1 mb-3">
              <TabsTrigger
                value="birthdays"
                className="gap-1.5 px-2 py-2 text-xs data-[state=active]:text-pink-600 dark:data-[state=active]:text-pink-400"
              >
                <Cake className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Birthdays</span>
                {birthdays.length > 0 ? (
                  <Badge variant="secondary" className="h-4 min-w-4 px-1 text-[9px] shrink-0">
                    {birthdays.length}
                  </Badge>
                ) : null}
              </TabsTrigger>
              <TabsTrigger
                value="anniversaries"
                className="gap-1.5 px-2 py-2 text-xs data-[state=active]:text-amber-600 dark:data-[state=active]:text-amber-400"
              >
                <Award className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Anniversaries</span>
                {serviceAnniversaries.length > 0 ? (
                  <Badge variant="secondary" className="h-4 min-w-4 px-1 text-[9px] shrink-0">
                    {serviceAnniversaries.length}
                  </Badge>
                ) : null}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="birthdays" className="mt-0 focus-visible:outline-none">
              <CelebrationFeed
                items={birthdays}
                celebrationType="birthday"
                accent="birthday"
                reactions={reactions}
                onReact={reactMutation.mutate}
                onMessage={handleMessage}
                isSubmitting={reactMutation.isPending}
                messagingUserId={messagingUserId}
                emptyMessage="No birthdays this week"
                emptyHint="Check back next week"
              />
            </TabsContent>

            <TabsContent value="anniversaries" className="mt-0 focus-visible:outline-none">
              <CelebrationFeed
                items={serviceAnniversaries}
                celebrationType="service_anniversary"
                accent="anniversary"
                subtitleFor={(person) => {
                  if (person.years_of_service === 1) return '1 year';
                  if (person.years_of_service != null) return `${person.years_of_service} years`;
                  return null;
                }}
                reactions={reactions}
                onReact={reactMutation.mutate}
                onMessage={handleMessage}
                isSubmitting={reactMutation.isPending}
                messagingUserId={messagingUserId}
                emptyMessage="No anniversaries this week"
                emptyHint="Milestones will show up here"
              />
            </TabsContent>
          </Tabs>
        )}
      </div>

      <AnimatePresence>
        {activeChat ? (
          <div
            className="pointer-events-none fixed right-3 z-30 hidden md:block"
            style={{ bottom: 'calc(5.25rem + env(safe-area-inset-bottom))' }}
            data-mini-chat
          >
            <MiniChatPanel
              key={activeChat.user?.id || activeChat.conversationId}
              user={activeChat.user}
              conversationId={activeChat.conversationId}
              onClose={() => setActiveChat(null)}
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
