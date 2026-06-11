import React, { useEffect, useRef, useState } from 'react';

import { Download, Share, WifiOff, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  canShowIosInstallPrompt,
  dismissIosInstallPrompt,
  IOS_INSTALL_STEPS,
  isRunningStandalone,
  supportsNativeInstallPrompt,
} from '@/lib/pwa';

export default function PwaInstallPrompt() {
  const isMobile = useIsMobile();
  const deferredPromptRef = useRef(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(isRunningStandalone());
  const [isOffline, setIsOffline] = useState(typeof navigator !== 'undefined' ? !navigator.onLine : false);
  const [isIosInstall, setIsIosInstall] = useState(false);
  const [hasNativePrompt, setHasNativePrompt] = useState(false);

  useEffect(() => {
    const updateInstalledState = () => {
      const installed = isRunningStandalone();
      setIsInstalled(installed);

      if (!installed && deferredPromptRef.current) {
        setShowPrompt(true);
        setHasNativePrompt(true);
      }
    };

    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      deferredPromptRef.current = event;
      setHasNativePrompt(true);
      setShowPrompt(true);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      deferredPromptRef.current = null;
      setHasNativePrompt(false);
      setShowPrompt(false);
    };

    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    updateInstalledState();

    const iosInstallable = canShowIosInstallPrompt();
    setIsIosInstall(iosInstallable);

    const timer = iosInstallable
      ? window.setTimeout(() => setShowPrompt(true), 2500)
      : null;

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('focus', updateInstalledState);
    document.addEventListener('visibilitychange', updateInstalledState);

    return () => {
      if (timer) window.clearTimeout(timer);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('focus', updateInstalledState);
      document.removeEventListener('visibilitychange', updateInstalledState);
    };
  }, []);

  const dismissPrompt = () => {
    if (isIosInstall) {
      dismissIosInstallPrompt();
    }
    setShowPrompt(false);
  };

  const install = async () => {
    if (!deferredPromptRef.current) return;

    deferredPromptRef.current.prompt();
    await deferredPromptRef.current.userChoice;
    deferredPromptRef.current = null;
    setHasNativePrompt(false);
    setShowPrompt(false);
  };

  const showNativeInstall = showPrompt && !isInstalled && hasNativePrompt && supportsNativeInstallPrompt();
  const showIosInstall = showPrompt && !isInstalled && isIosInstall;
  const shouldShow = showNativeInstall || showIosInstall || isOffline;

  return (
    <AnimatePresence>
      {shouldShow && (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          className={
            isMobile
              ? 'fixed inset-x-4 z-50 bottom-[calc(4.5rem+env(safe-area-inset-bottom))]'
              : 'fixed bottom-4 right-4 z-50 w-[min(92vw,360px)]'
          }
        >
          <div className="rounded-2xl border border-border/70 bg-card/95 backdrop-blur-xl shadow-xl p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                {isOffline ? (
                  <WifiOff className="w-5 h-5 text-primary" />
                ) : isIosInstall ? (
                  <Share className="w-5 h-5 text-primary" />
                ) : (
                  <Download className="w-5 h-5 text-primary" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-sm">
                  {isOffline ? 'You are offline' : isIosInstall ? 'Add to Home Screen' : 'Install the app'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {isOffline
                    ? 'Cached pages stay available while you reconnect.'
                    : isIosInstall
                      ? 'Install Nexus on your iPhone or iPad for a faster, app-like experience.'
                      : 'Add Nexus to your device for a faster, app-like experience.'}
                </p>
              </div>
              {!isOffline && (
                <button
                  type="button"
                  onClick={dismissPrompt}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Dismiss install prompt"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {showIosInstall && (
              <ol className="space-y-2 pl-4 text-xs text-muted-foreground list-decimal">
                {IOS_INSTALL_STEPS.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            )}

            {!isOffline && (
              <div className="flex gap-2 justify-end">
                {showIosInstall ? (
                  <Button size="sm" onClick={dismissPrompt}>
                    Got it
                  </Button>
                ) : (
                  <>
                    <Button variant="outline" size="sm" onClick={dismissPrompt}>
                      Not now
                    </Button>
                    <Button size="sm" className="gap-1.5" onClick={install}>
                      <Download className="w-4 h-4" /> Install
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
