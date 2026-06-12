import { cn } from '@/lib/utils';

export const glassPanelStyles = cn(
  'backdrop-blur-2xl',
  'bg-card/30 border-border/50 shadow-[0_8px_24px_rgba(0,0,0,0.08)] ring-1 ring-black/5',
  'dark:bg-card/35 dark:border-border/70 dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)] dark:ring-white/10'
);

export const glassDockStyles = cn(glassPanelStyles, 'rounded-2xl border');
