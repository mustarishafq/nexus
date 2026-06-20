import React from 'react';
import { Check } from 'lucide-react';

import { cn } from '@/lib/utils';
import { mergeSplashAnimationCatalog } from '@/lib/splashAnimations';
import SplashStage from '@/components/pwa/splash-animations/SplashStage';

export default function SplashAnimationPicker({ value, onChange, catalog, config, systemName = '' }) {
  const options = mergeSplashAnimationCatalog(catalog);

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {options.map((option) => {
        const selected = value === option.id;

        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            className={cn(
              'group relative overflow-hidden rounded-2xl border text-left transition-all',
              selected
                ? 'border-primary ring-2 ring-primary/30 shadow-md'
                : 'border-border hover:border-primary/40 hover:shadow-sm',
            )}
          >
            <div className="relative h-36 overflow-hidden">
              {option.id === 'lottie' ? (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-white/80" style={{ backgroundColor: config?.background_color || '#022e96' }}>
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-xs font-medium uppercase tracking-wide">
                    Lottie
                  </div>
                  <span className="text-[11px]">Original file</span>
                </div>
              ) : (
                <SplashStage
                  config={config}
                  variant={option.id}
                  systemName={systemName}
                  mode="thumbnail"
                  className="relative h-full w-full overflow-hidden"
                />
              )}

              {selected ? (
                <span className="absolute right-2 top-2 z-20 inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check className="h-3.5 w-3.5" />
                </span>
              ) : null}
            </div>

            <div className="space-y-1 p-3">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium">{option.label}</p>
                {option.interactive ? (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                    Interactive
                  </span>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{option.description}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
