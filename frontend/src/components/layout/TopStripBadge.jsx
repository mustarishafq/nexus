import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export const TOP_STRIP_BADGE_WIDTH_CLASS = 'w-[4.5rem] sm:w-[6rem]';

export const TOP_STRIP_ROW_CLASS = 'flex h-8 items-stretch shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]';

export function TopStripDismissButton({ onClick, ariaLabel }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-8 w-9 shrink-0 items-center justify-center border-l border-white/10 text-white/60 transition-colors hover:bg-white/10 hover:text-white sm:w-10"
      aria-label={ariaLabel}
    >
      <X className="h-3 w-3" />
    </button>
  );
}

export function TopStripBadge({ label, dotClassName, pulse = false, className }) {
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center gap-1.5 self-stretch border-r border-white/10 bg-black/25 px-2 backdrop-blur-sm',
        TOP_STRIP_BADGE_WIDTH_CLASS,
        className,
      )}
    >
      <span className="relative flex h-1.5 w-1.5 shrink-0">
        {pulse ? (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-70" />
        ) : null}
        <span className={cn('relative inline-flex h-1.5 w-1.5 rounded-full', dotClassName)} />
      </span>
      <span className="text-[9px] font-bold uppercase leading-none tracking-[0.16em] opacity-95">
        {label}
      </span>
    </div>
  );
}
