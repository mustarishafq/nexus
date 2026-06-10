import React, { useCallback, useEffect, useRef, useState } from 'react';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import { AnimatePresence, motion } from 'framer-motion';

const SPLASH_SRC = '/lottie/splash.lottie';
const SPLASH_BG = '#01298c';
const MIN_SPLASH_MS = 1200;
const MAX_SPLASH_MS = 6000;

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
  const [active, setActive] = useState(shouldShowSplash);
  const [exiting, setExiting] = useState(false);
  const animCompleteRef = useRef(false);
  const minElapsedRef = useRef(false);
  const dismissedRef = useRef(false);

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

  useEffect(() => {
    if (!active) return undefined;

    const minTimer = window.setTimeout(() => {
      minElapsedRef.current = true;
      tryDismiss();
    }, MIN_SPLASH_MS);

    const maxTimer = window.setTimeout(dismiss, MAX_SPLASH_MS);

    return () => {
      window.clearTimeout(minTimer);
      window.clearTimeout(maxTimer);
    };
  }, [active, dismiss, tryDismiss]);

  useEffect(() => {
    if (!active) return undefined;

    const { documentElement, body } = document;
    const prevHtmlOverflow = documentElement.style.overflow;
    const prevBodyOverflow = body.style.overflow;
    const prevBodyTouchAction = body.style.touchAction;
    const prevBodyOverscroll = body.style.overscrollBehavior;
    const prevHtmlBackground = documentElement.style.backgroundColor;
    const prevBodyBackground = body.style.backgroundColor;
    const prevHtmlHeight = documentElement.style.height;
    const prevBodyHeight = body.style.height;
    const prevHtmlMinHeight = documentElement.style.minHeight;
    const prevBodyMinHeight = body.style.minHeight;

    documentElement.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    body.style.touchAction = 'none';
    body.style.overscrollBehavior = 'none';
    documentElement.style.backgroundColor = SPLASH_BG;
    body.style.backgroundColor = SPLASH_BG;
    documentElement.style.height = '100dvh';
    body.style.height = '100dvh';
    documentElement.style.minHeight = '100dvh';
    body.style.minHeight = '100dvh';

    const preventTouchMove = (event) => {
      event.preventDefault();
    };

    document.addEventListener('touchmove', preventTouchMove, { passive: false });

    return () => {
      documentElement.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
      body.style.touchAction = prevBodyTouchAction;
      body.style.overscrollBehavior = prevBodyOverscroll;
      documentElement.style.backgroundColor = prevHtmlBackground;
      body.style.backgroundColor = prevBodyBackground;
      documentElement.style.height = prevHtmlHeight;
      body.style.height = prevBodyHeight;
      documentElement.style.minHeight = prevHtmlMinHeight;
      body.style.minHeight = prevBodyMinHeight;
      document.removeEventListener('touchmove', preventTouchMove);
    };
  }, [active]);

  const handleDotLottieRef = useCallback((dotLottie) => {
    if (!dotLottie) return;

    dotLottie.addEventListener('complete', () => {
      animCompleteRef.current = true;
      tryDismiss();
    });
  }, [tryDismiss]);

  if (!active) return null;

  return (
    <AnimatePresence onExitComplete={() => setActive(false)}>
      {!exiting && (
        <motion.div
          key="pwa-splash"
          className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden overscroll-none touch-none bg-[#01298c]"
          style={{ height: '100dvh', minHeight: '100dvh' }}
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.45, ease: 'easeInOut' }}
          aria-hidden="true"
        >
          <div className="h-48 w-48 sm:h-56 sm:w-56">
            <DotLottieReact
              src={SPLASH_SRC}
              autoplay
              loop={false}
              className="size-full"
              layout={{ fit: 'contain', align: [0.5, 0.5] }}
              dotLottieRefCallback={handleDotLottieRef}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
