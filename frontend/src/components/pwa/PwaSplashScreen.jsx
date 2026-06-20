import React, { useCallback, useEffect, useRef, useState } from 'react';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import { AnimatePresence, motion } from 'framer-motion';

import SplashStage from '@/components/pwa/splash-animations/SplashStage';
import SplashBackground from '@/components/pwa/splash-animations/SplashBackground';
import SplashMedia from '@/components/pwa/splash-animations/SplashMedia';
import SplashSystemName from '@/components/pwa/splash-animations/SplashSystemName';
import { useAuth } from '@/lib/AuthContext';
import { buildSplashRuntime, isSplashAnimationInteractive, resolveSplashConfigFromSettings } from '@/lib/splashConfig';

const SPLASH_SRC = '/lottie/splash.lottie';

function shouldShowSplash() {
  if (typeof window === 'undefined') return false;

  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true;

  if (isStandalone) return true;

  try {
    return !sessionStorage.getItem('nexus_splash_shown');
  } catch {
    return true;
  }
}

export default function PwaSplashScreen() {
  const { appPublicSettings, isLoadingPublicSettings } = useAuth();
  const [active, setActive] = useState(shouldShowSplash);
  const [exiting, setExiting] = useState(false);
  const animCompleteRef = useRef(false);
  const minElapsedRef = useRef(false);
  const dismissedRef = useRef(false);
  const splashConfigRef = useRef(null);
  const systemNameRef = useRef(null);

  if (!isLoadingPublicSettings && splashConfigRef.current === null) {
    splashConfigRef.current = resolveSplashConfigFromSettings(appPublicSettings);
    systemNameRef.current = appPublicSettings?.system_name || 'EMZI Nexus Brain';
  }

  const splashConfig = splashConfigRef.current;
  const systemName = systemNameRef.current || appPublicSettings?.system_name || 'EMZI Nexus Brain';
  const runtime = splashConfig ? buildSplashRuntime(splashConfig, splashConfig.animation_style, systemName) : null;
  const usesLottie = splashConfig?.animation_style === 'lottie';
  const interactive = isSplashAnimationInteractive(splashConfig?.animation_style);

  const dismiss = useCallback(() => {
    if (dismissedRef.current) return;
    dismissedRef.current = true;

    try {
      sessionStorage.setItem('nexus_splash_shown', '1');
    } catch {
      // ignore storage errors
    }

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

  const waitingForSettings = isLoadingPublicSettings || !splashConfig || !runtime;
  const exitFadeSeconds = (runtime?.timing.exitFadeMs ?? 450) / 1000;

  return (
    <AnimatePresence onExitComplete={() => setActive(false)}>
      {!exiting && (
        <motion.div
          key="pwa-splash"
          className={interactive
            ? 'fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden overscroll-none touch-manipulation'
            : 'fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden overscroll-none touch-none'}
          style={{ backgroundColor: splashConfig?.background_color || '#022e96' }}
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: exitFadeSeconds, ease: 'easeInOut' }}
          aria-hidden="true"
        >
          {waitingForSettings ? null : usesLottie ? (
            <>
              <SplashBackground config={splashConfig ?? {}} />
              <div className="relative z-10 flex flex-col items-center justify-center gap-4">
                {runtime.title.position === 'above' ? <SplashSystemName runtime={runtime} /> : null}
                <div className="h-48 w-48 sm:h-56 sm:w-56">
                  {runtime.media.show && runtime.media.customUrl && runtime.media.type === 'video' ? (
                    <SplashMedia runtime={runtime} className="h-full w-full" />
                  ) : runtime.media.show && runtime.media.customUrl ? (
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
