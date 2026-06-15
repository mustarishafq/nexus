import { cn } from '@/lib/utils';

export function PageHeader({
  icon: Icon,
  title,
  description,
  meta,
  actions,
  className,
}) {
  return (
    <div className={cn('flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div>
        <div className="flex items-center gap-2">
          {Icon ? <Icon className="h-5 w-5 text-primary" /> : null}
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{title}</h1>
        </div>
        {description ? (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {meta || actions ? (
        <div className="flex flex-col items-start gap-2 sm:items-end">
          {meta ? (
            <p className="text-xs text-muted-foreground sm:text-sm">{meta}</p>
          ) : null}
          {actions}
        </div>
      ) : null}
    </div>
  );
}
