import React, { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import LaunchExperienceContent from '@/components/applications/launch-animations/LaunchExperienceContent';
import LaunchOverlayShell from '@/components/applications/launch-animations/LaunchOverlayShell';
import { useLaunchOverlayEnergy } from '@/components/applications/launch-animations/useLaunchOverlayEnergy';
import {
  getLaunchDurationPreset,
  isCompactLaunchOverlayMode,
  normalizeLaunchDuration,
  normalizeLaunchOverlayMode,
  normalizeLaunchProgressStyle,
  normalizeLaunchAnimation,
} from '@/lib/launchConfig';
import { DEFAULT_BRAND_COLOR } from '@/lib/imageColor';

export default function ApplicationLaunchOverlay({ launch, onDismiss, durationCatalog }) {
  const [exiting, setExiting] = React.useState(false);
  const dismissTimerRef = useRef(null);
  const { energy, boost } = useLaunchOverlayEnergy(Boolean(launch), launch?.key);

  const style = normalizeLaunchAnimation(launch?.config?.animation_style);
  const overlayMode = normalizeLaunchOverlayMode(launch?.config?.overlay_mode);
  const progressStyle = normalizeLaunchProgressStyle(launch?.config?.progress_style);
  const duration = normalizeLaunchDuration(launch?.config?.duration);
  const preset = getLaunchDurationPreset(duration, launch?.durationCatalog ?? durationCatalog);
  const application = launch?.application;
  const brandColor = application?.color || DEFAULT_BRAND_COLOR;
  const isCompactShell = isCompactLaunchOverlayMode(overlayMode);

  const beginExit = () => {
    if (exiting) return;
    setExiting(true);
    dismissTimerRef.current = window.setTimeout(() => {
      onDismiss?.();
    }, 420);
  };

  useEffect(() => {
    if (!launch) return undefined;

    setExiting(false);
    const maxTimer = window.setTimeout(beginExit, preset.max_ms);

    return () => window.clearTimeout(maxTimer);
  }, [launch?.key, preset.max_ms]);

  useEffect(() => {
    if (!launch?.ready || exiting || energy < 0.55) return undefined;

    const readyTimer = window.setTimeout(beginExit, Math.max(280, preset.min_ms * 0.35));
    return () => window.clearTimeout(readyTimer);
  }, [launch?.ready, energy, exiting, preset.min_ms]);

  useEffect(() => () => {
    if (dismissTimerRef.current) {
      window.clearTimeout(dismissTimerRef.current);
    }
  }, []);

  if (!launch) return null;

  return (
    <AnimatePresence>
      <motion.div
        key={launch.key}
        className="fixed inset-0 z-[120] touch-none overscroll-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        role="dialog"
        aria-modal="true"
        aria-label={launch.preview
          ? `Preview launch for ${application?.name || 'application'}`
          : `Launching ${application?.name || 'application'}`}
        onPointerDown={() => {
          if (launch.config?.interactive !== false) {
            boost(style === 'portal' ? 0.18 : 0.14);
          }
        }}
      >
        <LaunchOverlayShell mode={overlayMode} brandColor={brandColor} compact={isCompactShell}>
          <LaunchExperienceContent
            application={application}
            style={style}
            overlayMode={overlayMode}
            progressStyle={progressStyle}
            energy={energy}
            onBoost={boost}
            exiting={exiting}
            ready={launch.ready}
            compact={isCompactShell}
            interactive={launch.config?.interactive !== false}
            showHint={launch.config?.show_hint !== false}
            showSkip={launch.config?.show_skip !== false}
            onSkip={() => {
              if (launch.ready) {
                beginExit();
                return;
              }
              boost(0.35);
            }}
            animationCatalog={launch.animationCatalog}
          />
        </LaunchOverlayShell>
      </motion.div>
    </AnimatePresence>
  );
}
