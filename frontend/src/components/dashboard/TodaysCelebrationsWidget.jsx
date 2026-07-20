import db from '@/api/apiClient';
import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, isToday, isTomorrow, parseISO, startOfWeek, endOfWeek } from 'date-fns';
import { Cake, Award, PartyPopper, SmilePlus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getDisplayName } from '@/lib/profile';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import UserAvatar from '@/components/users/UserAvatar';

const DEFAULT_REACTIONS = ['🎉', '🎂', '👏', '🎈', '❤️', '🥳', '🙌'];

function celebrationsQueryKey(localDate) {
  return ['dashboard-celebrations', localDate];
}

function celebrationDayLabel(celebrationDate) {
  if (!celebrationDate) return 'Soon';

  const date = typeof celebrationDate === 'string' ? parseISO(celebrationDate) : celebrationDate;
  if (isToday(date)) return 'Today';
  if (isTomorrow(date)) return 'Tomorrow';
  return format(date, 'EEE');
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

function CelebrationDateBadge({ date, accent }) {
  const today = date ? isToday(date) : false;

  const todayTone =
    accent === 'anniversary'
      ? 'bg-amber-500 text-white shadow-sm shadow-amber-500/20'
      : 'bg-pink-500 text-white shadow-sm shadow-pink-500/20';

  return (
    <div
      className={cn(
        'flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-xl',
        today ? todayTone : 'border border-border/70 bg-muted/30'
      )}
    >
      <span
        className={cn(
          'text-[9px] font-semibold uppercase leading-none tracking-wide',
          today ? 'text-white/80' : 'text-muted-foreground'
        )}
      >
        {date ? format(date, 'MMM') : '—'}
      </span>
      <span className="mt-0.5 text-sm font-bold leading-none tabular-nums">
        {date ? format(date, 'd') : '·'}
      </span>
    </div>
  );
}

function ReactionCountPills({ reactionCounts }) {
  const entries = Object.entries(reactionCounts);
  if (entries.length === 0) return null;

  return (
    <div className="flex items-center gap-1 overflow-hidden">
      {entries.map(([emoji, count]) => (
        <span
          key={emoji}
          className="inline-flex shrink-0 items-center justify-center h-6 min-w-6 px-1.5 rounded-full bg-muted/80 border border-border/60 text-sm leading-none"
          title={`${count} reaction${count === 1 ? '' : 's'}`}
        >
          <span className="text-xs">{emoji}</span>
          {count > 1 ? (
            <span className="text-[9px] font-semibold text-muted-foreground ml-0.5 tabular-nums">{count}</span>
          ) : null}
        </span>
      ))}
    </div>
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
  isSubmitting,
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const canReact = person.can_react ?? person.can_wish !== false;
  const myReaction = person.my_reaction?.reaction ?? person.my_wish?.reaction ?? null;
  const reactionCounts = person.reaction_counts || {};
  const date = parseCelebrationDate(celebrationDate);
  const today = date ? isToday(date) : false;

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

  const handleReact = (reaction) => {
    if (!canReact || isSubmitting) return;

    const reactionId = person.my_reaction?.id ?? person.my_wish?.id;
    if (myReaction === reaction && reactionId) {
      onReact({ removeReactionId: reactionId });
      setPickerOpen(false);
      return;
    }

    onReact({
      recipientUserId: person.id,
      celebrationType,
      celebrationDate,
      reaction,
    });
    setPickerOpen(false);
  };

  return (
    <div
      className={cn(
        'flex items-center gap-2.5 px-2.5 py-2.5 transition-colors',
        today && accentStyles.todayRow
      )}
    >
      <CelebrationDateBadge date={date} accent={accent} />

      <UserAvatar
        user={person}
        className="h-8 w-8 shrink-0"
        fallbackClassName={cn('text-[10px] font-bold', accentStyles.avatar)}
      />

      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-tight truncate">
          {getDisplayName(person, person.email)}
        </p>
        {subtitle ? (
          <p className="mt-0.5 text-[11px] text-muted-foreground truncate">{subtitle}</p>
        ) : (
          <p className="mt-0.5 text-[11px] text-muted-foreground truncate">
            {celebrationDayLabel(celebrationDate)}
          </p>
        )}
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <ReactionCountPills reactionCounts={reactionCounts} />

        {canReact ? (
          <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                disabled={isSubmitting}
                title="React"
                className={cn(
                  'inline-flex items-center justify-center h-8 w-8 rounded-full border border-border/70 bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
                  myReaction && 'border-primary/30 bg-primary/5 text-primary'
                )}
              >
                {myReaction ? (
                  <span className="text-sm leading-none">{myReaction}</span>
                ) : (
                  <SmilePlus className="w-3.5 h-3.5" />
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-auto p-2">
              <div className="flex gap-1">
                {reactions.map((reaction) => (
                  <button
                    key={reaction}
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => handleReact(reaction)}
                    title={myReaction === reaction ? 'Remove reaction' : `React with ${reaction}`}
                    className={cn(
                      'h-9 w-9 rounded-full text-lg transition-transform hover:scale-110 hover:bg-muted',
                      myReaction === reaction && 'bg-primary/10 ring-2 ring-primary/30'
                    )}
                  >
                    {reaction}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        ) : null}
      </div>
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
  isSubmitting,
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
      {groups.map((group) => (
        <div key={group.dateKey}>
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
              isSubmitting={isSubmitting}
            />
          ))}
        </div>
      ))}
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

          <div className="max-h-80 overflow-y-auto">
            <TabsContent value="birthdays" className="mt-0 focus-visible:outline-none">
              <CelebrationFeed
                items={birthdays}
                celebrationType="birthday"
                accent="birthday"
                reactions={reactions}
                onReact={reactMutation.mutate}
                isSubmitting={reactMutation.isPending}
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
                  const day = celebrationDayLabel(person.celebration_date);
                  const years =
                    person.years_of_service === 1
                      ? '1 year'
                      : person.years_of_service != null
                        ? `${person.years_of_service} years`
                        : null;
                  if (day && years) return `${day} · ${years}`;
                  return day || years || 'Anniversary';
                }}
                reactions={reactions}
                onReact={reactMutation.mutate}
                isSubmitting={reactMutation.isPending}
                emptyMessage="No anniversaries this week"
                emptyHint="Milestones will show up here"
              />
            </TabsContent>
          </div>
        </Tabs>
      )}
    </div>
  );
}
