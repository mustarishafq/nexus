import React from 'react';
import { cn } from '@/lib/utils';

/**
 * Shared Recharts tooltip props — theme-aware for light + dark mode.
 * Spread onto every raw <Tooltip /> (never leave tooltips unstyled).
 */
export const chartTooltipProps = {
  contentStyle: {
    padding: '6px 10px',
    fontSize: '11px',
    backgroundColor: 'hsl(var(--popover))',
    color: 'hsl(var(--popover-foreground))',
    border: '1px solid hsl(var(--border))',
    borderRadius: '8px',
  },
  labelStyle: {
    color: 'hsl(var(--foreground))',
  },
  itemStyle: {
    color: 'hsl(var(--popover-foreground))',
  },
  cursor: {
    fill: 'hsl(var(--muted) / 0.55)',
  },
  wrapperStyle: {
    outline: 'none',
  },
};

/** Axis tick fill for XAxis / YAxis */
export const chartAxisTick = {
  fill: 'hsl(var(--muted-foreground))',
};

/** Cartesian grid stroke */
export const chartGridStroke = 'hsl(var(--border))';

/**
 * Compact frosted-glass tooltip panel for custom Recharts `content`.
 * Prefer this when you need a formatter beyond default contentStyle.
 */
export function ChartTooltipBox({
  active,
  payload,
  label,
  formatter,
  labelFormatter,
  className,
}) {
  if (!active || !payload?.length) {
    return null;
  }

  const displayLabel = labelFormatter ? labelFormatter(label, payload) : label;

  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-popover/95 px-2.5 py-1.5 text-[11px] text-popover-foreground shadow-md backdrop-blur-sm',
        className,
      )}
    >
      {displayLabel != null && displayLabel !== '' ? (
        <div className="mb-0.5 font-medium text-foreground">{displayLabel}</div>
      ) : null}
      <div className="space-y-0.5">
        {payload.map((item, index) => {
          const rawValue = item.value;
          const rawName = item.name;
          let value = rawValue;
          let name = rawName;

          if (formatter) {
            const formatted = formatter(rawValue, rawName, item, index, payload);
            if (Array.isArray(formatted)) {
              value = formatted[0];
              name = formatted[1] ?? rawName;
            } else if (formatted != null) {
              value = formatted;
            }
          }

          return (
            <div
              key={item.dataKey ?? item.name ?? index}
              className="flex items-center gap-2 text-popover-foreground"
            >
              {item.color || item.payload?.fill ? (
                <span
                  className="h-2 w-2 shrink-0 rounded-[2px]"
                  style={{ backgroundColor: item.color || item.payload?.fill }}
                />
              ) : null}
              <span className="text-muted-foreground">{name}</span>
              <span className="ml-auto font-medium tabular-nums text-foreground">{value}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
