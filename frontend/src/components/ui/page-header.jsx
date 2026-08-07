import { cn } from '@/lib/utils';

export function PageHeader({
  icon: Icon,
  title,
  description,
  meta,
  actions,
  className,
  hideDescriptionOnMobile = false,
}) {
  return (
    <div className={cn('flex flex-col gap-2 sm:gap-3', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {Icon ? <Icon className="h-5 w-5 shrink-0 text-primary" /> : null}
            <h1 className="min-w-0 truncate text-xl font-bold tracking-tight sm:text-2xl">{title}</h1>
            {meta && !actions ? (
              <span className="ml-auto shrink-0 text-xs text-muted-foreground sm:text-sm">{meta}</span>
            ) : null}
          </div>
          {description ? (
            <p
              className={cn(
                'mt-1 text-sm text-muted-foreground',
                hideDescriptionOnMobile && 'hidden sm:block'
              )}
            >
              {description}
            </p>
          ) : null}
          {meta && actions ? (
            <p className="mt-1 text-xs text-muted-foreground sm:text-sm">{meta}</p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 items-center gap-2 pt-0.5">
            {actions}
          </div>
        ) : null}
      </div>
    </div>
  );
}
