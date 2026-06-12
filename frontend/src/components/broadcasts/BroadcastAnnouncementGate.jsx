import React, { useEffect, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useActiveBroadcasts } from '@/hooks/useActiveBroadcasts';
import { acknowledgeBroadcasts, getUnacknowledgedBroadcasts } from '@/lib/broadcast';
import BroadcastAnnouncementModal from './BroadcastAnnouncementModal';

export default function BroadcastAnnouncementGate() {
  const { user } = useAuth();
  const { data: broadcasts = [] } = useActiveBroadcasts({ enabled: Boolean(user?.id) });
  const [open, setOpen] = useState(false);
  const [pendingBroadcasts, setPendingBroadcasts] = useState([]);

  useEffect(() => {
    if (!user?.id || broadcasts.length === 0) {
      setPendingBroadcasts([]);
      setOpen(false);
      return;
    }

    const unacknowledged = getUnacknowledgedBroadcasts(user.id, broadcasts);
    setPendingBroadcasts(unacknowledged);
    setOpen(unacknowledged.length > 0);
  }, [user?.id, broadcasts]);

  if (!user) return null;

  return (
    <BroadcastAnnouncementModal
      open={open}
      onOpenChange={setOpen}
      broadcasts={pendingBroadcasts}
      onAcknowledge={(ids) => acknowledgeBroadcasts(user.id, ids)}
    />
  );
}
