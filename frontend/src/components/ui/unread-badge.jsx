import { cn } from '@/lib/utils';

const sizeStyles = {
  sm: 'min-w-[18px] rounded-full px-1.5 text-[10px] leading-[18px]',
  xs: 'min-w-[16px] h-4 rounded-full px-1 text-[9px] leading-4',
};

export function UnreadBadge({ count, className, size = 'sm' }) {
  if (!count || count <= 0) {
    return null;
  }

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center bg-destructive text-center font-bold text-destructive-foreground',
        sizeStyles[size],
        className
      )}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}
