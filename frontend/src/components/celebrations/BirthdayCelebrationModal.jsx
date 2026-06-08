import React, { useEffect } from 'react';
import { Cake, PartyPopper } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { fireBirthdayConfetti } from '@/lib/confettiBurst';
import { getBirthdayAge } from '@/lib/birthday';

export default function BirthdayCelebrationModal({ open, onOpenChange, user }) {
  const name = user?.full_name || user?.name || user?.email || 'there';
  const age = getBirthdayAge(user?.date_of_birth);

  useEffect(() => {
    if (!open) return;

    fireBirthdayConfetti();
    const timer = setTimeout(() => fireBirthdayConfetti(), 600);

    return () => clearTimeout(timer);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md text-center border-pink-500/20 overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 -top-8 h-24 bg-gradient-to-b from-pink-500/15 to-transparent" />

        <DialogHeader className="items-center space-y-3 pt-2">
          <div className="relative">
            <div className="w-16 h-16 rounded-full bg-pink-500/10 ring-4 ring-pink-500/20 flex items-center justify-center mx-auto">
              <Cake className="w-8 h-8 text-pink-600 dark:text-pink-400" />
            </div>
            <PartyPopper className="w-5 h-5 text-amber-500 absolute -right-1 -top-1" />
          </div>
          <DialogTitle className="text-2xl">Happy Birthday!</DialogTitle>
          <DialogDescription className="text-base text-foreground/80">
            {age != null && age > 0 ? (
              <>Wishing you an amazing day, <span className="font-semibold text-foreground">{name}</span> — cheers to turning {age}!</>
            ) : (
              <>Wishing you a wonderful birthday, <span className="font-semibold text-foreground">{name}</span>!</>
            )}
          </DialogDescription>
        </DialogHeader>

        <p className="text-sm text-muted-foreground px-2">
          Hope your special day is filled with joy, laughter, and great moments with the team.
        </p>

        <Button className="w-full" onClick={() => onOpenChange(false)}>
          Thank you!
        </Button>
      </DialogContent>
    </Dialog>
  );
}
