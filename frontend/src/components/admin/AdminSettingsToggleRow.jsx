import React from 'react';
import { cn } from '@/lib/utils';

export default function AdminSettingsToggleRow({ label, description, htmlFor, children, className }) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        {label}
        {description ? (
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <div className="shrink-0 self-end sm:self-auto">{children}</div>
    </div>
  );
}
