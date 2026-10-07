import React, { useEffect, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { shouldShowBirthdayCelebration } from '@/lib/birthday';
import { useCelebrationGate } from '@/lib/CelebrationGateContext';
import { useActiveBroadcasts } from '@/hooks/useActiveBroadcasts';
import {
  acknowledgeBroadcasts,
  getUnacknowledgedBroadcasts,
  isApplicationBroadcast,
  isBroadcastModalSnoozedToday,
  snoozeBroadcastModalForToday,
} from '@/lib/broadcast';
import BroadcastAnnouncementModal from './BroadcastAnnouncementModal';

const EMPTY_BROADCASTS = [];

function getBroadcastIds(broadcasts) {
  return broadcasts.map((broadcast) => String(broadcast.id)).join(',');
}

export default function BroadcastAnnouncementGate() {
  const { user } = useAuth();
  const { birthdayModalOpen } = useCelebrationGate();
  const { data } = useActiveBroadcasts({ enabled: Boolean(user?.id) });
  const [open, setOpen] = useState(false);
  const [pendingBroadcasts, setPendingBroadcasts] = useState(EMPTY_BROADCASTS);

  useEffect(() => {
    if (!user?.id || !data?.length) {
      setPendingBroadcasts((prev) => (prev.length === 0 ? prev : EMPTY_BROADCASTS));
      setOpen(false);
      return;
    }

    // "Don't show again today" quiets announcements, but not what an application raised
    // for this person (e.g. a letter to return): that comes back each sign-in until resolved.
    const candidates = isBroadcastModalSnoozedToday(user.id)
      ? data.filter(isApplicationBroadcast)
      : data;
    const unacknowledged = getUnacknowledgedBroadcasts(user.id, candidates);
    const nextIds = getBroadcastIds(unacknowledged);

    setPendingBroadcasts((prev) => (getBroadcastIds(prev) === nextIds ? prev : unacknowledged));

    const birthdayBlocking = birthdayModalOpen || shouldShowBirthdayCelebration(user);
    setOpen(unacknowledged.length > 0 && !birthdayBlocking);
  }, [user, data, birthdayModalOpen]);

  if (!user) return null;

  return (
    <BroadcastAnnouncementModal
      open={open}
      onOpenChange={setOpen}
      broadcasts={pendingBroadcasts}
      onAcknowledge={(ids, { snoozeForToday = false } = {}) => {
        acknowledgeBroadcasts(user.id, ids);
        if (snoozeForToday) {
          snoozeBroadcastModalForToday(user.id);
        }
      }}
    />
  );
}
