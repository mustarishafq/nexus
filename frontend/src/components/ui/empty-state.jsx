import { cn } from '@/lib/utils';

const variantStyles = {
  default: 'rounded-2xl border border-border bg-card px-6 py-16 text-center',
  dashed: 'rounded-2xl border border-dashed border-border px-6 py-16 text-center',
  compact: 'px-4 py-10 text-center',
  inline: 'flex flex-col items-center justify-center py-20 text-center',
};

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  variant = 'default',
  iconClassName,
  className,
}) {
  return (
    <div className={cn(variantStyles[variant], className)}>
      {Icon ? (
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-muted/60">
          <Icon className={cn('h-6 w-6 text-muted-foreground', iconClassName)} />
        </div>
      ) : null}
      <p className="mt-4 text-sm font-medium">{title}</p>
      {description ? (
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
