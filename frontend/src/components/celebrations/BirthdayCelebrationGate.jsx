import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import {
  markBirthdayCelebrationShown,
  shouldShowBirthdayCelebration,
  snoozeBirthdayCelebrationForToday,
} from '@/lib/birthday';
import { useCelebrationGate } from '@/lib/CelebrationGateContext';
import BirthdayCelebrationModal from '@/components/celebrations/BirthdayCelebrationModal';

export default function BirthdayCelebrationGate() {
  const { user } = useAuth();
  const { setBirthdayModalOpen } = useCelebrationGate();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!shouldShowBirthdayCelebration(user)) {
      setOpen(false);
      setBirthdayModalOpen(false);
      return;
    }

    setOpen(true);
    setBirthdayModalOpen(true);
  }, [user, setBirthdayModalOpen]);

  const handleOpenChange = useCallback((nextOpen) => {
    setOpen(nextOpen);

    if (!nextOpen) {
      setBirthdayModalOpen(false);
      if (user?.id) {
        markBirthdayCelebrationShown(user.id);
      }
    }
  }, [setBirthdayModalOpen, user?.id]);

  const handleDismiss = useCallback(({ snoozeForToday = false } = {}) => {
    if (snoozeForToday && user?.id) {
      snoozeBirthdayCelebrationForToday(user.id);
    }
    handleOpenChange(false);
  }, [handleOpenChange, user?.id]);

  if (!user) return null;

  return (
    <BirthdayCelebrationModal
      open={open}
      onOpenChange={handleOpenChange}
      onDismiss={handleDismiss}
      user={user}
    />
  );
}
