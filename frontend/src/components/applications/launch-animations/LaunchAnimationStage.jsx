import React, { useRef } from 'react';
import { cn } from '@/lib/utils';
import {
  LAUNCH_ANIMATION_COMPONENTS,
  useLaunchEnergy,
  useOrbiterPoints,
  useRipplePoints,
} from '@/components/applications/launch-animations/LaunchAnimationVariants';
import { getLaunchAnimationMeta, normalizeLaunchAnimation } from '@/lib/launchConfig';

export default function LaunchAnimationStage({
  style,
  application,
  energy: externalEnergy,
  onBoost,
  exiting = false,
  compact = false,
  interactive = true,
  catalog,
  showHint = true,
  className,
}) {
  const boundsRef = useRef(null);
  const resolvedStyle = normalizeLaunchAnimation(style);
  const { energy: internalEnergy, boost } = useLaunchEnergy();
  const { ripples, addRipple } = useRipplePoints();
  const { orbiters, addOrbiter } = useOrbiterPoints(compact ? 2 : 3);
  const energy = externalEnergy ?? internalEnergy;
  const meta = getLaunchAnimationMeta(resolvedStyle, catalog);
  const Animation = LAUNCH_ANIMATION_COMPONENTS[resolvedStyle];

  const handlePointer = (event) => {
    if (!interactive || exiting) return;

    onBoost?.();
    boost(resolvedStyle === 'ripple' ? 0.16 : resolvedStyle === 'orbit' ? 0.14 : 0.12);

    if (resolvedStyle === 'ripple' && boundsRef.current) {
      const bounds = boundsRef.current.getBoundingClientRect();
      addRipple(event, bounds);
    }

    if (resolvedStyle === 'orbit') {
      addOrbiter();
    }
  };

  if (!Animation) {
    return (
      <div className={cn('flex w-full items-center justify-center', compact ? 'min-h-[120px]' : 'min-h-[220px]', className)}>
        <div className="rounded-xl border border-dashed border-white/20 px-4 py-3 text-center text-xs text-white/60">
          Opens immediately — no overlay
        </div>
      </div>
    );
  }

  return (
    <div
      ref={boundsRef}
      className={cn(
        'relative flex w-full items-center justify-center',
        compact ? 'min-h-[120px]' : 'min-h-[220px]',
        className,
      )}
      onPointerDown={handlePointer}
    >
      <Animation
        application={application}
        energy={energy}
        exiting={exiting}
        compact={compact}
        ripples={ripples}
        orbiters={orbiters}
      />
      {!compact && interactive && !exiting && showHint ? (
        <p className="pointer-events-none absolute inset-x-0 bottom-0 text-center text-[11px] text-white/55">
          {meta.hint}
        </p>
      ) : null}
    </div>
  );
}
