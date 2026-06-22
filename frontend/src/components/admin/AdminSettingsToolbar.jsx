import React from 'react';
import { cn } from '@/lib/utils';

export default function AdminSettingsToolbar({
  label,
  control,
  actions,
  description,
  className,
}) {
  return (
    <div className={cn('rounded-2xl border bg-muted/10 p-4 space-y-3', className)}>
      <div className="flex flex-col gap-3 md:flex-row md:items-end">
        <div className="min-w-0 flex-1 space-y-2">
          {label}
          {control}
        </div>
        {actions ? (
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap md:w-auto md:justify-end md:shrink-0">
            {actions}
          </div>
        ) : null}
      </div>
      {description ? (
        <p className="text-xs text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}

export function adminSettingsToolbarButtonClassName(extra = '') {
  return cn('min-h-[40px] w-full sm:w-auto', extra);
}
