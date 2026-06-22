import React, { useMemo, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  LAUNCH_OVERLAY_PLACEMENT_CATEGORIES,
  LAUNCH_OVERLAY_PLACEMENT_LABELS,
  mergeLaunchOverlayModeCatalog,
} from '@/lib/launchConfig';

function PlacementWireframe({ placement }) {
  if (placement === 'fullscreen') {
    return (
      <div className="relative h-12 rounded-md bg-cyan-500/10">
        <span className="absolute inset-0 flex items-center justify-center text-[9px] font-medium uppercase tracking-wide text-cyan-700 dark:text-cyan-300">
          Edge to edge
        </span>
      </div>
    );
  }

  if (placement === 'bottom') {
    return (
      <div className="relative h-12 rounded-md border border-border bg-background">
        <div className="absolute inset-x-2 top-2 h-5 rounded-sm bg-muted/80" />
        <div className="absolute inset-x-0 bottom-0 h-3.5 rounded-b-md bg-primary/30" />
      </div>
    );
  }

  if (placement === 'bottom_right') {
    return (
      <div className="relative h-12 rounded-md border border-border bg-background">
        <div className="absolute inset-2 rounded-sm bg-muted/70" />
        <div className="absolute bottom-1.5 right-1.5 h-4 w-8 rounded-sm border border-amber-500/50 bg-amber-500/25" />
      </div>
    );
  }

  if (placement === 'top') {
    return (
      <div className="relative h-12 rounded-md border border-border bg-background">
        <div className="absolute inset-x-0 top-0 h-3.5 rounded-t-md bg-primary/30" />
        <div className="absolute inset-x-2 bottom-2 top-5 rounded-sm bg-muted/70" />
      </div>
    );
  }

  if (placement === 'side') {
    return (
      <div className="relative h-12 rounded-md border border-border bg-background">
        <div className="absolute inset-y-2 left-0 w-4 rounded-r-sm bg-primary/30" />
        <div className="absolute inset-2 left-5 rounded-sm bg-muted/70" />
      </div>
    );
  }

  if (placement === 'border') {
    return (
      <div className="relative h-12 rounded-md border border-border bg-background">
        <div className="absolute inset-2 rounded-sm bg-muted/50" />
        <div className="absolute inset-x-4 top-3 bottom-3 rounded-md border-2 border-violet-500/50 bg-violet-500/10" />
      </div>
    );
  }

  return (
    <div className="relative h-12 rounded-md border border-border bg-background">
      <div className="absolute inset-2 rounded-sm bg-muted/50" />
      <div className="absolute inset-x-4 top-3 bottom-3 rounded-md bg-violet-500/15" />
    </div>
  );
}

export default function LaunchOverlayModePicker({ value, onChange, catalog }) {
  const options = mergeLaunchOverlayModeCatalog(catalog);
  const [placement, setPlacement] = useState('all');

  const filtered = useMemo(() => {
    if (placement === 'all') return options;
    return options.filter((option) => option.placement === placement);
  }, [options, placement]);

  return (
    <div className="space-y-3">
      <div>
        <Label>Overlay layout</Label>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Pick where the launch overlay sits on screen — full screen, bottom right, bordered panel, and more.
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {LAUNCH_OVERLAY_PLACEMENT_CATEGORIES.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setPlacement(item.id)}
            className={cn(
              'rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
              placement === item.id
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-muted/30 text-muted-foreground hover:border-primary/40 hover:text-foreground',
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
          No layouts in this placement group.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((option) => {
            const selected = value === option.id;
            const placementLabel = LAUNCH_OVERLAY_PLACEMENT_LABELS[option.placement] || option.placement;

            return (
              <button
                key={option.id}
                type="button"
                onClick={() => onChange(option.id)}
                className={cn(
                  'rounded-2xl border p-3 text-left transition-all',
                  selected
                    ? 'border-primary bg-primary/5 ring-2 ring-primary/20 shadow-sm'
                    : 'border-border bg-card hover:border-primary/35 hover:bg-muted/20',
                )}
              >
                <div className="mb-2 overflow-hidden rounded-lg border border-border/80 bg-muted/30 p-2">
                  <PlacementWireframe placement={option.placement} />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium">{option.label}</p>
                  <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                    {placementLabel}
                  </Badge>
                  {option.interactive ? (
                    <Badge variant="outline" className="h-5 border-primary/30 px-1.5 text-[10px] text-primary">
                      Interactive
                    </Badge>
                  ) : null}
                  {selected ? <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">Selected</Badge> : null}
                </div>
                <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{option.description}</p>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
