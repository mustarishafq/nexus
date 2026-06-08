import React, { useEffect, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { getBirthdayShownKey, isBirthdayToday } from '@/lib/birthday';
import BirthdayCelebrationModal from '@/components/celebrations/BirthdayCelebrationModal';

export default function BirthdayCelebrationGate() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user?.id || !user?.date_of_birth) return;
    if (!isBirthdayToday(user.date_of_birth)) return;

    const storageKey = getBirthdayShownKey(user.id);
    if (sessionStorage.getItem(storageKey)) return;

    sessionStorage.setItem(storageKey, '1');
    setOpen(true);
  }, [user]);

  if (!user) return null;

  return (
    <BirthdayCelebrationModal
      open={open}
      onOpenChange={setOpen}
      user={user}
    />
  );
}
