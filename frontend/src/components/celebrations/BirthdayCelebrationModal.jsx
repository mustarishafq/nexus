import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Cake, Music, PartyPopper, Sparkles, Star } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { fireBirthdayConfetti } from '@/lib/confettiBurst';
import { getBirthdayAge } from '@/lib/birthday';
import { playBirthdaySong, stopBirthdaySong } from '@/lib/birthdaySound';
import { toAbsoluteUrl } from '@/lib/media';
import { cn } from '@/lib/utils';

const FLOATING_DECOR = [
  { Icon: Sparkles, className: 'left-5 top-14 text-amber-400/80', delay: 0 },
  { Icon: Star, className: 'right-7 top-20 text-pink-400/70', delay: 0.4 },
  { Icon: Sparkles, className: 'right-10 bottom-28 text-rose-400/60', delay: 0.8 },
  { Icon: Star, className: 'left-8 bottom-32 text-amber-300/60', delay: 1.1 },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.15 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 18, scale: 0.96 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring', stiffness: 320, damping: 22 },
  },
};

function FloatingDecor({ Icon, className, delay }) {
  return (
    <motion.div
      className={cn('pointer-events-none absolute', className)}
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{
        opacity: [0.45, 0.9, 0.45],
        y: [0, -10, 0],
        rotate: [0, 8, -6, 0],
        scale: [1, 1.08, 1],
      }}
      transition={{
        delay,
        duration: 3.2,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    >
      <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
    </motion.div>
  );
}

export default function BirthdayCelebrationModal({ open, onOpenChange, onDismiss, user }) {
  const name = user?.name?.trim() || user?.full_name?.trim() || user?.email || 'there';
  const age = getBirthdayAge(user?.date_of_birth);
  const [dontShowAgainToday, setDontShowAgainToday] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);

  const startBirthdaySong = useCallback(async (fromUserGesture = false) => {
    const started = await playBirthdaySong({ fromUserGesture });
    setAudioBlocked(!started);
    return started;
  }, []);

  useEffect(() => {
    if (open) {
      setDontShowAgainToday(false);
      setAudioBlocked(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      stopBirthdaySong();
      return;
    }

    fireBirthdayConfetti();
    const confettiTimer = setTimeout(() => fireBirthdayConfetti(), 600);
    void startBirthdaySong(false);

    return () => {
      clearTimeout(confettiTimer);
      stopBirthdaySong();
    };
  }, [open, startBirthdaySong]);

  const handleGestureUnlock = useCallback(() => {
    if (!audioBlocked) return;
    void startBirthdaySong(true);
  }, [audioBlocked, startBirthdaySong]);

  const handleDismiss = () => {
    onDismiss?.({ snoozeForToday: dontShowAgainToday });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md overflow-hidden border-pink-500/25 bg-background p-0 shadow-2xl shadow-pink-500/10 sm:rounded-2xl">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-pink-500/20 via-rose-500/10 to-transparent" />
          <div className="absolute -left-10 top-8 h-32 w-32 rounded-full bg-amber-400/15 blur-3xl" />
          <div className="absolute -right-8 top-16 h-28 w-28 rounded-full bg-pink-500/20 blur-3xl" />
          <div className="absolute bottom-0 inset-x-0 h-24 bg-gradient-to-t from-amber-500/10 to-transparent" />
          {FLOATING_DECOR.map(({ Icon, className, delay }, index) => (
            <FloatingDecor key={index} Icon={Icon} className={className} delay={delay} />
          ))}
        </div>

        <motion.div
          className="relative px-6 pb-6 pt-8 text-center"
          variants={containerVariants}
          initial="hidden"
          animate={open ? 'visible' : 'hidden'}
          onPointerDown={handleGestureUnlock}
        >
          <motion.div variants={itemVariants} className="relative mx-auto mb-5 w-fit">
            <motion.div
              className="absolute -inset-2 rounded-full bg-gradient-to-tr from-pink-500/40 via-rose-400/30 to-amber-400/40 blur-sm"
              animate={{ scale: [1, 1.08, 1], opacity: [0.55, 0.85, 0.55] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.div
              className="absolute -inset-1 rounded-full ring-2 ring-pink-400/30 ring-offset-2 ring-offset-background"
              animate={{ rotate: 360 }}
              transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
            />
            <Avatar className="relative h-24 w-24 border-[3px] border-background shadow-lg shadow-pink-500/20">
              <AvatarImage
                src={toAbsoluteUrl(user?.profile_picture)}
                alt={name}
                className="object-cover"
              />
              <AvatarFallback className="bg-gradient-to-br from-pink-500/15 to-amber-500/15">
                <Cake className="h-10 w-10 text-pink-600 dark:text-pink-400" />
              </AvatarFallback>
            </Avatar>
            <motion.div
              className="absolute -right-2 -top-2 flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 shadow-md shadow-amber-500/30"
              animate={{ rotate: [-8, 8, -8], y: [0, -3, 0] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
            >
              <PartyPopper className="h-4 w-4 text-white" />
            </motion.div>
          </motion.div>

          <motion.div variants={itemVariants} className="space-y-2">
            <DialogHeader className="items-center space-y-2">
              <DialogTitle className="text-3xl font-bold tracking-tight sm:text-[2rem]">
                <span className="bg-gradient-to-r from-pink-600 via-rose-500 to-amber-500 bg-clip-text text-transparent dark:from-pink-400 dark:via-rose-300 dark:to-amber-300">
                  Happy Birthday!
                </span>
              </DialogTitle>
              {age != null && age > 0 ? (
                <motion.span
                  className="inline-flex items-center rounded-full border border-pink-500/25 bg-pink-500/10 px-3 py-0.5 text-xs font-semibold text-pink-700 dark:text-pink-300"
                  animate={{ scale: [1, 1.04, 1] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                >
                  Turning {age} today
                </motion.span>
              ) : null}
              <DialogDescription className="max-w-sm text-base leading-relaxed text-foreground/85">
                {age != null && age > 0 ? (
                  <>
                    Wishing you an amazing day,{' '}
                    <span className="font-semibold text-foreground">{name}</span>
                    {' '}— cheers to another wonderful year!
                  </>
                ) : (
                  <>
                    Wishing you a wonderful birthday,{' '}
                    <span className="font-semibold text-foreground">{name}</span>!
                  </>
                )}
              </DialogDescription>
            </DialogHeader>
          </motion.div>

          <motion.p
            variants={itemVariants}
            className="mx-auto mt-4 max-w-xs rounded-xl border border-pink-500/15 bg-pink-500/5 px-4 py-3 text-sm leading-relaxed text-muted-foreground"
          >
            Hope your special day is filled with joy, laughter, and great moments with the team.
          </motion.p>

          {audioBlocked ? (
            <motion.button
              type="button"
              variants={itemVariants}
              className="mx-auto mt-4 inline-flex items-center gap-2 rounded-full border border-pink-500/25 bg-pink-500/10 px-4 py-2 text-sm font-medium text-pink-700 transition-colors hover:bg-pink-500/15 dark:text-pink-300"
              onClick={() => void startBirthdaySong(true)}
            >
              <Music className="h-4 w-4" />
              Tap for birthday music
            </motion.button>
          ) : null}

          <motion.div variants={itemVariants} className="mt-6 space-y-4">
            <div className="flex items-center justify-between gap-3 border-t border-pink-500/15 pt-4">
              <label
                htmlFor="birthday-dont-show-today"
                className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 rounded-md text-left transition-colors hover:bg-pink-500/5 sm:min-h-9 sm:flex-initial"
              >
                <Checkbox
                  id="birthday-dont-show-today"
                  checked={dontShowAgainToday}
                  onCheckedChange={(checked) => setDontShowAgainToday(checked === true)}
                  className="h-[1.125rem] w-[1.125rem] rounded-[4px] border-2 border-muted-foreground/50 bg-background shadow-none data-[state=checked]:border-pink-500 data-[state=checked]:bg-pink-500"
                />
                <span className="text-sm leading-snug text-foreground/90 select-none">
                  Don&apos;t show again today
                </span>
              </label>
              <Button
                className="h-9 shrink-0 border-0 bg-gradient-to-r from-pink-500 via-rose-500 to-amber-500 px-6 text-sm font-semibold text-white shadow-lg shadow-pink-500/25 transition-all hover:from-pink-600 hover:via-rose-600 hover:to-amber-500 hover:shadow-pink-500/35 sm:min-w-[7rem]"
                onClick={handleDismiss}
              >
                Thank you!
              </Button>
            </div>
          </motion.div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}
