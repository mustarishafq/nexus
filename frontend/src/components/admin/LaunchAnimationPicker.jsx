import React, { useMemo, useState } from 'react';
import { Label } from '@/components/ui/label';
import LaunchAnimationThumbnail from '@/components/applications/launch-animations/LaunchAnimationThumbnail';
import { LAUNCH_ANIMATION_CATEGORIES, mergeLaunchAnimationCatalog } from '@/lib/launchConfig';
import { cn } from '@/lib/utils';

export default function LaunchAnimationPicker({ value, onChange, catalog }) {
  const options = mergeLaunchAnimationCatalog(catalog);
  const [category, setCategory] = useState('all');

  const filtered = useMemo(() => {
    if (category === 'all') return options;
    return options.filter((option) => option.category === category);
  }, [category, options]);

  return (
    <div className="space-y-3">
      <div>
        <Label>Launch animation</Label>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Each card shows a live preview of the motion. Filter by category or browse all styles.
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {LAUNCH_ANIMATION_CATEGORIES.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setCategory(item.id)}
            className={cn(
              'rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
              category === item.id
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-muted/30 text-muted-foreground hover:border-primary/40 hover:text-foreground',
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {filtered.map((option) => (
          <LaunchAnimationThumbnail
            key={option.id}
            style={option.id}
            selected={value === option.id}
            onSelect={onChange}
            catalog={options}
          />
        ))}
      </div>
    </div>
  );
}
