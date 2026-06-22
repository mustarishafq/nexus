import { cn } from '@/lib/utils';

export const glassPanelStyles = cn(
  'backdrop-blur-2xl',
  'bg-card/30 border-border/50 shadow-[0_8px_24px_rgba(0,0,0,0.08)] ring-1 ring-black/5',
  'dark:bg-card/35 dark:border-border/70 dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)] dark:ring-white/10'
);

/** Higher-opacity glass for dialogs/sheets — keeps text readable in light mode */
export const glassDialogPanelStyles = cn(
  'backdrop-blur-2xl text-foreground',
  'bg-card/95 border-border shadow-lg ring-1 ring-black/5',
  'supports-[backdrop-filter]:bg-card/90',
  'dark:bg-card/85 dark:border-border/70 dark:shadow-[0_8px_32px_rgba(0,0,0,0.45)] dark:ring-white/10'
);

/** Muted copy that stays legible on glass dialog surfaces */
export const glassDialogMutedText = 'text-foreground/70 dark:text-muted-foreground';

export const glassDockStyles = cn(glassPanelStyles, 'rounded-2xl border');
