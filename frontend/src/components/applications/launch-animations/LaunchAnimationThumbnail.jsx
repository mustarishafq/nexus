import React, { useEffect } from 'react';
import { Check } from 'lucide-react';
import LaunchAnimationStage from '@/components/applications/launch-animations/LaunchAnimationStage';
import { useLaunchOverlayEnergy } from '@/components/applications/launch-animations/useLaunchOverlayEnergy';
import { DEFAULT_BRAND_COLOR } from '@/lib/imageColor';
import { cn } from '@/lib/utils';
import { normalizeLaunchAnimation } from '@/lib/launchConfig';

const PREVIEW_APP = {
  name: 'App',
  color: DEFAULT_BRAND_COLOR,
};

export default function LaunchAnimationThumbnail({
  style,
  selected = false,
  onSelect,
  catalog,
  application = PREVIEW_APP,
}) {
  const resolvedStyle = normalizeLaunchAnimation(style);
  const { energy, setEnergy } = useLaunchOverlayEnergy(true, resolvedStyle);

  useEffect(() => {
    setEnergy(0.48);
  }, [resolvedStyle, setEnergy]);

  return (
    <button
      type="button"
      onClick={() => onSelect?.(resolvedStyle)}
      className={cn(
        'group relative overflow-hidden rounded-2xl border text-left transition-all',
        selected
          ? 'border-primary ring-2 ring-primary/30 shadow-md'
          : 'border-border hover:border-primary/40 hover:shadow-sm',
      )}
    >
      <div
        className="relative h-36 w-full overflow-hidden"
        style={{
          background: `radial-gradient(circle at 50% 40%, color-mix(in srgb, ${application.color || DEFAULT_BRAND_COLOR} 30%, #0f172a), #020617)`,
        }}
      >
        {resolvedStyle === 'none' ? (
          <div className="flex h-full items-center justify-center px-4">
            <div className="rounded-xl border border-dashed border-white/25 px-3 py-2 text-center text-[11px] text-white/60">
              Opens immediately
            </div>
          </div>
        ) : (
          <LaunchAnimationStage
            style={resolvedStyle}
            application={application}
            energy={energy}
            compact
            interactive={false}
            showHint={false}
            catalog={catalog}
            className="h-full min-h-0"
          />
        )}

        {selected ? (
          <span className="absolute right-2 top-2 z-20 inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Check className="h-3.5 w-3.5" />
          </span>
        ) : null}
      </div>

      <div className="space-y-1 p-3">
        <p className="text-sm font-medium">{catalog?.find((item) => item.id === resolvedStyle)?.label || resolvedStyle}</p>
        <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
          {catalog?.find((item) => item.id === resolvedStyle)?.description}
        </p>
      </div>
    </button>
  );
}
