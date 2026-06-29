import React, { useEffect, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useActiveBroadcasts } from '@/hooks/useActiveBroadcasts';
import {
  acknowledgeBroadcasts,
  getUnacknowledgedBroadcasts,
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
  const { data } = useActiveBroadcasts({ enabled: Boolean(user?.id) });
  const [open, setOpen] = useState(false);
  const [pendingBroadcasts, setPendingBroadcasts] = useState(EMPTY_BROADCASTS);

  useEffect(() => {
    if (!user?.id || !data?.length) {
      setPendingBroadcasts((prev) => (prev.length === 0 ? prev : EMPTY_BROADCASTS));
      setOpen(false);
      return;
    }

    if (isBroadcastModalSnoozedToday(user.id)) {
      setPendingBroadcasts((prev) => (prev.length === 0 ? prev : EMPTY_BROADCASTS));
      setOpen(false);
      return;
    }

    const unacknowledged = getUnacknowledgedBroadcasts(user.id, data);
    const nextIds = getBroadcastIds(unacknowledged);

    setPendingBroadcasts((prev) => (getBroadcastIds(prev) === nextIds ? prev : unacknowledged));
    setOpen(unacknowledged.length > 0);
  }, [user?.id, data]);

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
