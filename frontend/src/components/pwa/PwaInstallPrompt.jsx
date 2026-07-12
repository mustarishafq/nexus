import React, { useEffect, useState } from 'react';

import { Download, Share, WifiOff, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { useIsMobile } from '@/hooks/use-mobile';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { usePwaInstall } from '@/hooks/usePwaInstall';
import {
  canShowManualInstallPrompt,
  CHROMIUM_INSTALL_STEPS,
  dismissManualInstallPrompt,
  getManualInstallPlatform,
  getManualInstallSteps,
} from '@/lib/pwa';

export default function PwaInstallPrompt() {
  const isMobile = useIsMobile();
  const pwaInstall = usePwaInstall();
  const { isOffline: networkOffline } = useOnlineStatus();
  const [showPrompt, setShowPrompt] = useState(false);
  const [offlineDismissed, setOfflineDismissed] = useState(false);
  const [manualInstallPlatform, setManualInstallPlatform] = useState(null);

  const isOffline = networkOffline && !offlineDismissed;

  useEffect(() => {
    if (!networkOffline) {
      setOfflineDismissed(false);
    }
  }, [networkOffline]);

  useEffect(() => {
    const manualInstallable = canShowManualInstallPrompt();
    setManualInstallPlatform(getManualInstallPlatform());

    const timer = manualInstallable
      ? window.setTimeout(() => setShowPrompt(true), 2500)
      : null;

    if (pwaInstall.hasNativePrompt && !pwaInstall.installed) {
      setShowPrompt(true);
    }

    return () => {
      if (timer) window.clearTimeout(timer);
    };
  }, [pwaInstall.hasNativePrompt, pwaInstall.installed]);

  const dismissPrompt = () => {
    if (isOffline) {
      setOfflineDismissed(true);
      return;
    }
    if (pwaInstall.manualInstall) {
      dismissManualInstallPrompt();
    }
    setShowPrompt(false);
  };

  const install = async () => {
    const choice = await pwaInstall.install();
    if (choice?.outcome !== 'unavailable') {
      setShowPrompt(false);
    }
  };

  const showNativeInstall = showPrompt && !pwaInstall.installed && pwaInstall.hasNativePrompt;
  const showManualInstall = showPrompt && !pwaInstall.installed && pwaInstall.manualInstall;
  const showChromiumFallback = showPrompt && !pwaInstall.installed && pwaInstall.chromiumFallback;
  const shouldShow = showNativeInstall || showManualInstall || showChromiumFallback || isOffline;
  const manualInstallSteps = getManualInstallSteps();

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
                ) : showManualInstall ? (
                  <Share className="w-5 h-5 text-primary" />
                ) : (
                  <Download className="w-5 h-5 text-primary" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-sm">
                  {isOffline ? 'You are offline' : showManualInstall
                    ? (manualInstallPlatform === 'macos-safari' ? 'Add to Dock' : 'Add to Home Screen')
                    : showChromiumFallback
                      ? 'Install from Chrome'
                      : 'Install the app'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {isOffline
                    ? 'Cached pages stay available while you reconnect.'
                    : showManualInstall
                      ? (manualInstallPlatform === 'macos-safari'
                        ? 'Install Nexus on your Mac for a faster, app-like experience.'
                        : 'Install Nexus on your iPhone or iPad for a faster, app-like experience.')
                      : showChromiumFallback
                        ? 'Use the install icon in Chrome\'s address bar to add Nexus.'
                        : 'Add Nexus to your device for a faster, app-like experience.'}
                </p>
              </div>
              <button
                type="button"
                onClick={dismissPrompt}
                className="text-muted-foreground hover:text-foreground"
                aria-label={isOffline ? 'Dismiss offline notice' : 'Dismiss install prompt'}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {showManualInstall && (
              <ol className="space-y-2 pl-4 text-xs text-muted-foreground list-decimal">
                {manualInstallSteps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            )}

            {showChromiumFallback && (
              <ol className="space-y-2 pl-4 text-xs text-muted-foreground list-decimal">
                {CHROMIUM_INSTALL_STEPS.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            )}

            {isOffline ? (
              <div className="flex gap-2 justify-end">
                <Button size="sm" variant="outline" onClick={dismissPrompt}>
                  Dismiss
                </Button>
              </div>
            ) : (
              <div className="flex gap-2 justify-end">
                {showManualInstall || showChromiumFallback ? (
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
