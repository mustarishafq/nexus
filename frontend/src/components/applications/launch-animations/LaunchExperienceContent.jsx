import React from 'react';
import { cn } from '@/lib/utils';
import LaunchAnimationStage from '@/components/applications/launch-animations/LaunchAnimationStage';
import LaunchProgressIndicator from '@/components/applications/launch-animations/LaunchProgressIndicator';
import { LaunchHint, LaunchTitle } from '@/components/applications/launch-animations/shared';
import {
  getLaunchAnimationMeta,
  isCompactLaunchOverlayMode,
  normalizeLaunchOverlayMode,
} from '@/lib/launchConfig';

export default function LaunchExperienceContent({
  application,
  style,
  overlayMode,
  progressStyle,
  energy,
  onBoost,
  exiting = false,
  ready = false,
  compact = false,
  interactive = true,
  showHint = true,
  showSkip = true,
  onSkip,
  animationCatalog,
}) {
  const resolvedOverlayMode = normalizeLaunchOverlayMode(overlayMode);
  const isCompactShell = isCompactLaunchOverlayMode(resolvedOverlayMode);
  const progress = Math.max(energy, ready ? 0.25 : 0.08);
  const meta = getLaunchAnimationMeta(style, animationCatalog);

  return (
    <div className={cn('space-y-6', isCompactShell && 'space-y-4')}>
      {!isCompactShell ? <LaunchTitle application={application} /> : null}

      <LaunchAnimationStage
        style={style}
        application={application}
        energy={energy}
        onBoost={onBoost}
        exiting={exiting}
        compact={compact || isCompactShell}
        interactive={interactive}
        catalog={animationCatalog}
        showHint={showHint}
      />

      <div className="space-y-3">
        <LaunchProgressIndicator style={progressStyle} progress={progress} />
        {showHint ? (
          <LaunchHint className={isCompactShell ? 'text-[10px]' : undefined}>
            {ready ? 'Opening now…' : meta.hint}
          </LaunchHint>
        ) : null}
        {showSkip ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onSkip?.();
            }}
            className="mx-auto block text-[11px] uppercase tracking-[0.18em] text-white/45 transition-colors hover:text-white/75"
          >
            {ready ? 'Continue' : 'Skip'}
          </button>
        ) : null}
      </div>
    </div>
  );
}
