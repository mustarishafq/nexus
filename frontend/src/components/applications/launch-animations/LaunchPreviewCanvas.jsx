import React from 'react';
import LaunchExperienceContent from '@/components/applications/launch-animations/LaunchExperienceContent';
import LaunchOverlayShell from '@/components/applications/launch-animations/LaunchOverlayShell';
import LaunchMockAppGrid from '@/components/applications/launch-animations/LaunchMockAppGrid';
import LaunchPreviewLayoutGuide from '@/components/applications/launch-animations/LaunchPreviewLayoutGuide';
import { DEFAULT_BRAND_COLOR } from '@/lib/imageColor';
import {
  getLaunchOverlayLayoutKind,
  getLaunchOverlayLayoutLabel,
} from '@/lib/launchConfig';

const PREVIEW_APP = {
  name: 'Preview App',
  color: DEFAULT_BRAND_COLOR,
};

export default function LaunchPreviewCanvas({
  launchConfig,
  settings,
  energy,
  onBoost,
  ready = false,
  showLayoutGuide = true,
}) {
  const layoutKind = getLaunchOverlayLayoutKind(launchConfig.overlay_mode);
  const layoutLabel = getLaunchOverlayLayoutLabel(launchConfig.overlay_mode, settings?.launch_overlay_modes);
  const showMockApps = layoutKind !== 'fullscreen';

  return (
    <div className="relative h-full w-full overflow-hidden">
      <LaunchMockAppGrid className={showMockApps ? 'opacity-100' : 'opacity-0'} />

      <LaunchOverlayShell
        mode={launchConfig.overlay_mode}
        brandColor={PREVIEW_APP.color}
        className="absolute inset-0 z-10 h-full w-full"
      >
        <LaunchExperienceContent
          application={PREVIEW_APP}
          style={launchConfig.animation_style}
          overlayMode={launchConfig.overlay_mode}
          progressStyle={launchConfig.progress_style}
          energy={energy}
          onBoost={onBoost}
          ready={ready}
          interactive={launchConfig.interactive}
          showHint={launchConfig.show_hint}
          showSkip={launchConfig.show_skip}
          animationCatalog={settings?.launch_animations}
        />
      </LaunchOverlayShell>

      {showLayoutGuide ? (
        <LaunchPreviewLayoutGuide
          overlayMode={launchConfig.overlay_mode}
          layoutLabel={layoutLabel}
        />
      ) : null}
    </div>
  );
}
