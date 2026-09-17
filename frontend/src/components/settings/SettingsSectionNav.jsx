import React from 'react';
import { cn } from '@/lib/utils';

export default function SettingsSectionNav({
  items,
  value,
  onChange,
  className,
  type = 'line',
  ariaLabel = 'Tabs',
}) {
  const isHorizontal = type === 'underline';

  return (
    <>
      <select
        aria-label={ariaLabel}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          'h-9 w-80 max-w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground shadow-sm outline-none transition-colors focus-visible:ring-1 focus-visible:ring-ring md:hidden',
          className,
        )}
      >
        {items.map((item) => (
          <option key={item.id} value={item.id}>
            {item.label}
          </option>
        ))}
      </select>

      <nav
        aria-label={ariaLabel}
        className={cn('hidden w-max md:block', className)}
      >
        <div
          className={cn(
            isHorizontal
              ? 'flex items-end gap-0 border-b border-border'
              : 'sticky top-24 flex flex-col border-l border-border',
          )}
        >
          {items.map((item) => {
            const Icon = item.icon;
            const active = value === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onChange(item.id)}
                className={cn(
                  'relative inline-flex items-center gap-2 text-sm font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  isHorizontal
                    ? 'px-3 pb-3 pt-1'
                    : 'min-h-[40px] px-3 py-2.5 text-left',
                  active
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {active ? (
                  <span
                    className={cn(
                      'absolute bg-primary',
                      isHorizontal
                        ? 'inset-x-0 -bottom-px h-0.5 rounded-full'
                        : 'inset-y-0 -left-px w-0.5 rounded-full',
                    )}
                  />
                ) : null}
                {Icon ? <Icon className="h-4 w-4 shrink-0" /> : null}
                {item.label}
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
