import db from '@/api/apiClient';
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
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

function ReactionCountPills({ reactionCounts }) {
  const entries = Object.entries(reactionCounts);

  return (
    <div className="mt-1.5 h-6 flex items-center gap-1 overflow-hidden">
      {entries.map(([emoji, count]) => (
        <span
          key={emoji}
          className="inline-flex shrink-0 items-center justify-center h-6 min-w-6 px-1 rounded-full bg-muted border border-border/70 text-sm leading-none shadow-sm"
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
  badge,
  accent,
  reactions,
  onReact,
  isSubmitting,
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const canReact = person.can_react ?? person.can_wish !== false;
  const myReaction = person.my_reaction?.reaction ?? person.my_wish?.reaction ?? null;
  const reactionCounts = person.reaction_counts || {};

  const accentStyles = {
    birthday: {
      avatar: 'bg-pink-500/10 text-pink-600 dark:text-pink-400',
      badge: 'bg-pink-500/10 text-pink-700 dark:text-pink-300 border-pink-500/20',
    },
    anniversary: {
      avatar: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
      badge: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20',
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
    <article className="rounded-lg border border-border/80 bg-background overflow-hidden">
      <div className="flex items-center gap-3 p-3 min-w-0">
        <UserAvatar
          user={person}
          className="h-9 w-9 shrink-0"
          fallbackClassName={cn('text-xs font-bold', accentStyles.avatar)}
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-tight truncate">{getDisplayName(person, person.email)}</p>
          <div className="mt-1 flex items-center">
            <Badge variant="outline" className={cn('text-[10px] px-2 py-0 h-5', accentStyles.badge)}>
              {badge}
            </Badge>
          </div>
          <ReactionCountPills reactionCounts={reactionCounts} />
        </div>

        {canReact ? (
          <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                disabled={isSubmitting}
                title="React"
                className={cn(
                  'shrink-0 inline-flex items-center justify-center h-8 w-8 rounded-full border border-border/70 bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
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
    </article>
  );
}

function CelebrationFeed({
  items,
  celebrationType,
  celebrationDate,
  accent,
  badgeFor,
  reactions,
  onReact,
  isSubmitting,
  emptyMessage,
}) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-6 col-span-full">{emptyMessage}</p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {items.map((person) => (
        <CelebrationFeedCard
          key={person.id}
          person={person}
          celebrationType={celebrationType}
          celebrationDate={celebrationDate}
          badge={badgeFor(person)}
          accent={accent}
          reactions={reactions}
          onReact={onReact}
          isSubmitting={isSubmitting}
        />
      ))}
    </div>
  );
}

export default function TodaysCelebrationsWidget({ embedded = false }) {
  const localDate = format(new Date(), 'yyyy-MM-dd');
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
  const hasCelebrations = birthdays.length > 0 || serviceAnniversaries.length > 0;

  const containerClass = embedded
    ? 'bg-transparent border-0 rounded-none'
    : 'bg-card rounded-2xl border border-border';
  const contentPadding = embedded ? 'px-5 pb-5' : 'px-5 pb-5';

  const SectionTitle = ({ tabs = null }) => (
    <div className="p-5 pb-3 space-y-3">
      <div className="flex items-center gap-2 min-w-0">
        <PartyPopper className="w-4 h-4 text-primary shrink-0" />
        <h3 className="font-semibold text-sm">Today&apos;s Celebrations</h3>
      </div>
      {tabs}
    </div>
  );

  const tabsList = (
    <TabsList className="grid w-full grid-cols-2 h-auto p-1">
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
  );

  return (
    <div className={containerClass}>
      {isLoading ? (
        <>
          <SectionTitle />
          <p className={cn('text-sm text-muted-foreground text-center', contentPadding)}>
            Loading celebrations...
          </p>
        </>
      ) : isError ? (
        <>
          <SectionTitle />
          <p className={cn('text-sm text-destructive text-center', contentPadding)}>
            Could not load celebrations.
          </p>
        </>
      ) : !hasCelebrations ? (
        <>
          <SectionTitle />
          <p className={cn('text-sm text-muted-foreground text-center py-6', contentPadding)}>
            No birthdays or anniversaries today.
          </p>
        </>
      ) : (
        <Tabs defaultValue={defaultTab}>
          <SectionTitle tabs={tabsList} />

          <div className={cn('max-h-80 overflow-y-auto px-5 pb-5', embedded && 'px-4 pb-4 pt-0')}>
            <TabsContent value="birthdays" className="mt-0 focus-visible:outline-none">
              <CelebrationFeed
                items={birthdays}
                celebrationType="birthday"
                celebrationDate={localDate}
                accent="birthday"
                badgeFor={(person) =>
                  person.age != null && person.age > 0 ? `Turns ${person.age}` : 'Birthday'
                }
                reactions={reactions}
                onReact={reactMutation.mutate}
                isSubmitting={reactMutation.isPending}
                emptyMessage="No birthdays today"
              />
            </TabsContent>

            <TabsContent value="anniversaries" className="mt-0 focus-visible:outline-none">
              <CelebrationFeed
                items={serviceAnniversaries}
                celebrationType="service_anniversary"
                celebrationDate={localDate}
                accent="anniversary"
                badgeFor={(person) =>
                  person.years_of_service === 1 ? '1 year' : `${person.years_of_service} years`
                }
                reactions={reactions}
                onReact={reactMutation.mutate}
                isSubmitting={reactMutation.isPending}
                emptyMessage="No anniversaries today"
              />
            </TabsContent>
          </div>
        </Tabs>
      )}
    </div>
  );
}
