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

/** Faint secondary copy (timestamps, hints) on glass dialog surfaces */
export const glassDialogFaintText = 'text-foreground/60 dark:text-muted-foreground';

/** Icon-only controls on glass dialog surfaces */
export const glassDialogIconButton = cn(
  'text-foreground/65 transition-colors hover:bg-muted hover:text-foreground',
  'dark:text-muted-foreground'
);

/** Text inputs on glass dialog surfaces */
export const glassDialogInputStyles =
  'border-border/80 bg-background text-foreground placeholder:text-foreground/45';

/** Footer / secondary action links on glass dialog surfaces */
export const glassDialogLinkStyles = cn(
  'text-foreground/75 transition-colors hover:text-primary',
  'dark:text-muted-foreground'
);

/** Primary row titles on glass dialog surfaces */
export const glassDialogTitleText = 'text-foreground';

/** Top navigation bar — opaque enough for legible labels in light mode */
export const glassTopBarStyles = cn(
  'backdrop-blur-2xl text-foreground',
  'bg-card/95 border-border shadow-sm ring-1 ring-black/5',
  'supports-[backdrop-filter]:bg-card/92',
  'dark:bg-card/35 dark:border-border/70 dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)] dark:ring-white/10'
);

export const glassDockStyles = cn(glassPanelStyles, 'rounded-2xl border');
