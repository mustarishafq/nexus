import React, { useCallback, useEffect, useRef, useState } from 'react';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import { AnimatePresence, motion } from 'framer-motion';

import SplashStage from '@/components/pwa/splash-animations/SplashStage';
import SplashBackground from '@/components/pwa/splash-animations/SplashBackground';
import SplashMedia from '@/components/pwa/splash-animations/SplashMedia';
import SplashSystemName from '@/components/pwa/splash-animations/SplashSystemName';
import { useAuth } from '@/lib/AuthContext';
import { buildSplashRuntime, isSplashAnimationInteractive, resolveSplashConfigFromSettings, shouldUseFullscreenVideoSplash } from '@/lib/splashConfig';
import { cn } from '@/lib/utils';

const SPLASH_SRC = '/lottie/splash.lottie';
const SPLASH_CACHE_KEY = 'nexus_splash_public_cache_v1';
/** Cleared when the app process is killed (e.g. removed from phone recents). */
const SPLASH_SESSION_KEY = 'nexus_splash_session_done';

function hasCompletedSessionSplash() {
  if (typeof window === 'undefined') return false;

  try {
    return window.sessionStorage.getItem(SPLASH_SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

function shouldShowSplash() {
  if (typeof window === 'undefined') return false;
  if (hasCompletedSessionSplash()) return false;

  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true;

  return isStandalone;
}

function markSplashCompleted() {
  try {
    window.sessionStorage.setItem(SPLASH_SESSION_KEY, '1');
    // Legacy key from an earlier build — no longer used for gating.
    window.localStorage.removeItem('nexus_splash_first_launch_done');
  } catch {
    // ignore storage errors
  }
}

function readCachedSplashSeed() {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(SPLASH_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCachedSplashSeed(settings, systemName) {
  if (typeof window === 'undefined') return;

  try {
    const splash = settings?.splash && typeof settings.splash === 'object' ? settings.splash : settings || {};
    window.localStorage.setItem(
      SPLASH_CACHE_KEY,
      JSON.stringify({
        splash,
        system_name: systemName || 'EMZI Nexus Brain',
      }),
    );
  } catch {
    // ignore cache write failures
  }
}

function getNeutralStartupSeed() {
  return {
    splash: {
      splash_enabled: true,
      splash_animation_style: 'fade-rise',
      splash_background_color: '#022e96',
      splash_accent_color: '#FA9D04',
      splash_secondary_color: '#017CF3',
      splash_show_logo: false,
      splash_show_system_name: false,
      splash_background_overlay_opacity: 0,
      splash_backdrop_blur: 0,
    },
    system_name: 'EMZI Nexus Brain',
  };
}

export default function PwaSplashScreen() {
  const { appPublicSettings, isLoadingPublicSettings } = useAuth();
  const [active, setActive] = useState(shouldShowSplash);
  const [exiting, setExiting] = useState(false);
  const [videoBackgroundColor, setVideoBackgroundColor] = useState(null);
  const animCompleteRef = useRef(false);
  const minElapsedRef = useRef(false);
  const dismissedRef = useRef(false);
  const splashConfigRef = useRef(null);
  const systemNameRef = useRef(null);
  const hydratedFromSettingsRef = useRef(false);

  if (splashConfigRef.current === null) {
    const cachedSeed = readCachedSplashSeed();
    const initialSeed = appPublicSettings || cachedSeed || getNeutralStartupSeed();
    splashConfigRef.current = resolveSplashConfigFromSettings(initialSeed?.splash || initialSeed);
    systemNameRef.current = initialSeed?.system_name || 'EMZI Nexus Brain';
  }

  if (!isLoadingPublicSettings && !hydratedFromSettingsRef.current) {
    splashConfigRef.current = resolveSplashConfigFromSettings(appPublicSettings);
    systemNameRef.current = appPublicSettings?.system_name || 'EMZI Nexus Brain';
    writeCachedSplashSeed(appPublicSettings, systemNameRef.current);
    hydratedFromSettingsRef.current = true;
  }

  const splashConfig = splashConfigRef.current;
  const systemName = systemNameRef.current || appPublicSettings?.system_name || 'EMZI Nexus Brain';
  const runtime = splashConfig ? buildSplashRuntime(splashConfig, splashConfig.animation_style, systemName) : null;
  const usesLottie = splashConfig?.animation_style === 'lottie';
  const fullscreenVideo = shouldUseFullscreenVideoSplash(runtime);
  const interactive = isSplashAnimationInteractive(splashConfig?.animation_style);
  const splashBackgroundColor = videoBackgroundColor || splashConfig?.background_color;

  const dismiss = useCallback(() => {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    markSplashCompleted();
    setExiting(true);
  }, []);

  const tryDismiss = useCallback(() => {
    if (animCompleteRef.current && minElapsedRef.current) {
      dismiss();
    }
  }, [dismiss]);

  const markAnimationComplete = useCallback(() => {
    animCompleteRef.current = true;
    tryDismiss();
  }, [tryDismiss]);

  useEffect(() => {
    if (!active || !runtime) return undefined;

    const minTimer = window.setTimeout(() => {
      minElapsedRef.current = true;
      tryDismiss();
    }, runtime.timing.minDurationMs);

    const maxTimer = window.setTimeout(dismiss, runtime.timing.maxDurationMs);

    return () => {
      window.clearTimeout(minTimer);
      window.clearTimeout(maxTimer);
    };
  }, [active, dismiss, runtime, tryDismiss]);

  useEffect(() => {
    if (!active || !runtime) return undefined;

    if (!usesLottie) {
      animCompleteRef.current = false;
      const fallbackMs = interactive
        ? Math.max(runtime.timing.animationDurationMs + 800, runtime.timing.minDurationMs + 500)
        : runtime.timing.animationDurationMs + 400;
      const fallbackTimer = window.setTimeout(
        markAnimationComplete,
        fallbackMs,
      );
      return () => window.clearTimeout(fallbackTimer);
    }

    if (runtime.media.customUrl) {
      animCompleteRef.current = false;
      const fallbackTimer = window.setTimeout(
        markAnimationComplete,
        runtime.timing.animationDurationMs + 400,
      );
      return () => window.clearTimeout(fallbackTimer);
    }

    return undefined;
  }, [active, interactive, markAnimationComplete, runtime, usesLottie]);

  useEffect(() => {
    if (!active) return undefined;

    const { documentElement, body } = document;
    const prevHtmlOverflow = documentElement.style.overflow;
    const prevBodyOverflow = body.style.overflow;
    const prevBodyTouchAction = body.style.touchAction;
    const prevBodyOverscroll = body.style.overscrollBehavior;

    documentElement.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    body.style.touchAction = 'none';
    body.style.overscrollBehavior = 'none';

    const preventTouchMove = (event) => {
      event.preventDefault();
    };

    document.addEventListener('touchmove', preventTouchMove, { passive: false });

    return () => {
      documentElement.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
      body.style.touchAction = prevBodyTouchAction;
      body.style.overscrollBehavior = prevBodyOverscroll;
      document.removeEventListener('touchmove', preventTouchMove);
    };
  }, [active]);

  const handleDotLottieRef = useCallback((dotLottie) => {
    if (!dotLottie) return;

    dotLottie.addEventListener('complete', () => {
      markAnimationComplete();
    });
  }, [markAnimationComplete]);

  if (!active || splashConfig?.enabled === false) return null;

  const exitFadeSeconds = (runtime?.timing.exitFadeMs ?? 450) / 1000;

  return (
    <AnimatePresence onExitComplete={() => setActive(false)}>
      {!exiting && (
        <motion.div
          key="pwa-splash"
          className={cn(
            'fixed inset-0 z-[9999] overflow-hidden overscroll-none',
            !fullscreenVideo && 'flex items-center justify-center',
            interactive ? 'touch-manipulation' : 'touch-none',
          )}
          style={{ backgroundColor: splashBackgroundColor }}
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: exitFadeSeconds, ease: 'easeInOut' }}
          aria-hidden="true"
        >
          {usesLottie ? (
            <>
              {!fullscreenVideo ? <SplashBackground config={splashConfig ?? {}} /> : null}
              {fullscreenVideo ? (
                <>
                  <SplashMedia
                    runtime={runtime}
                    mode="fullscreen"
                    onBackgroundColor={setVideoBackgroundColor}
                  />
                  <div className="relative z-10 flex flex-col items-center justify-center gap-4">
                    {runtime.title.position === 'above' ? <SplashSystemName runtime={runtime} /> : null}
                    {runtime.title.position === 'below' ? <SplashSystemName runtime={runtime} /> : null}
                  </div>
                </>
              ) : (
                <div className="relative z-10 flex flex-col items-center justify-center gap-4">
                  {runtime.title.position === 'above' ? <SplashSystemName runtime={runtime} /> : null}
                  <div className="h-48 w-48 sm:h-56 sm:w-56">
                    {runtime.media.show && runtime.media.customUrl ? (
                      <SplashMedia runtime={runtime} className="h-full w-full" />
                    ) : (
                      <DotLottieReact
                        src={SPLASH_SRC}
                        autoplay
                        loop={false}
                        className="size-full"
                        layout={{ fit: 'contain', align: [0.5, 0.5] }}
                        dotLottieRefCallback={handleDotLottieRef}
                      />
                    )}
                  </div>
                  {runtime.title.position === 'below' ? <SplashSystemName runtime={runtime} /> : null}
                </div>
              )}
            </>
          ) : (
            <SplashStage
              config={splashConfig}
              variant={splashConfig.animation_style}
              systemName={systemName}
              mode="live"
              onComplete={markAnimationComplete}
              className="absolute inset-0"
            />
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
