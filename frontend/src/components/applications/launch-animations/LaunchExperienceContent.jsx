import React from 'react';
import { cn } from '@/lib/utils';
import LaunchAnimationStage from '@/components/applications/launch-animations/LaunchAnimationStage';
import LaunchProgressIndicator from '@/components/applications/launch-animations/LaunchProgressIndicator';
import { LaunchHint, LaunchTitle } from '@/components/applications/launch-animations/shared';
import {
  getLaunchAnimationMeta,
  isCompactLaunchOverlayMode,
  isDensePanelLaunchOverlayMode,
  isLightLaunchSurfaceOverlayMode,
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
  const isDensePanel = isDensePanelLaunchOverlayMode(resolvedOverlayMode);
  const lightSurface = isLightLaunchSurfaceOverlayMode(resolvedOverlayMode);
  const progress = Math.max(energy, ready ? 0.25 : 0.08);
  const meta = getLaunchAnimationMeta(style, animationCatalog);

  return (
    <div className={cn('space-y-6', (isCompactShell || isDensePanel) && 'space-y-3')}>
      {isDensePanel ? (
        <p className="text-center text-sm font-semibold leading-tight text-foreground">{application?.name}</p>
      ) : !isCompactShell ? (
        <LaunchTitle application={application} />
      ) : null}

      <LaunchAnimationStage
        style={style}
        application={application}
        energy={energy}
        onBoost={onBoost}
        exiting={exiting}
        compact={compact || isCompactShell || isDensePanel}
        interactive={interactive}
        catalog={animationCatalog}
        showHint={showHint && !isDensePanel}
        className={isDensePanel ? 'min-h-[96px]' : undefined}
      />

      <div className={cn('space-y-3', isDensePanel && 'space-y-2')}>
        <LaunchProgressIndicator
          style={progressStyle}
          progress={progress}
          surface={lightSurface ? 'light' : 'dark'}
        />
        {showHint ? (
          <LaunchHint
            className={cn(
              (isCompactShell || isDensePanel) && 'text-[10px]',
              isDensePanel && 'text-muted-foreground',
            )}
          >
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
            className={cn(
              'mx-auto block uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-foreground',
              isDensePanel ? 'text-[10px]' : 'text-[11px] text-white/45 hover:text-white/75',
            )}
          >
            {ready ? 'Continue' : 'Skip'}
          </button>
        ) : null}
      </div>
    </div>
  );
}
