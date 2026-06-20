import React from 'react';
import { cn } from '@/lib/utils';

export default function SettingsSectionNav({
  items,
  value,
  onChange,
  className,
}) {
  return (
    <>
      <div className={cn('flex gap-1 overflow-x-auto pb-1 lg:hidden', className)}>
        {items.map((item) => {
          const Icon = item.icon;
          const active = value === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChange(item.id)}
              className={cn(
                'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                active
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-background text-muted-foreground hover:border-primary/30 hover:text-foreground',
              )}
            >
              {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
              {item.label}
            </button>
          );
        })}
      </div>

      <nav className={cn('hidden lg:block', className)}>
        <div className="sticky top-24 space-y-1 rounded-2xl border bg-card p-2">
          {items.map((item) => {
            const Icon = item.icon;
            const active = value === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onChange(item.id)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition-colors',
                  active
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                )}
              >
                {Icon ? <Icon className="h-4 w-4 shrink-0" /> : null}
                <span className="font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
