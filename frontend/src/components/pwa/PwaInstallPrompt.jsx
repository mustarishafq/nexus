import React, { useEffect, useState } from 'react';

import { Download, X, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';

export default function PwaInstallPrompt() {
  const isRunningStandalone =
    typeof window !== 'undefined'
    && (
      window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone === true
    );
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(isRunningStandalone);
  const [isOffline, setIsOffline] = useState(typeof navigator !== 'undefined' ? !navigator.onLine : false);

  useEffect(() => {
    const updateInstalledState = () => {
      const installed =
        window.matchMedia('(display-mode: standalone)').matches
        || window.navigator.standalone === true;

      setIsInstalled(installed);

      if (!installed && deferredPrompt) {
        setShowPrompt(true);
      }
    };

    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setDeferredPrompt(event);
      setShowPrompt(true);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      setShowPrompt(false);
    };

    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    updateInstalledState();

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('focus', updateInstalledState);
    document.addEventListener('visibilitychange', updateInstalledState);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('focus', updateInstalledState);
      document.removeEventListener('visibilitychange', updateInstalledState);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  return (
    <AnimatePresence>
      {((showPrompt && !isInstalled && Boolean(deferredPrompt)) || isOffline) && (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          className="fixed bottom-4 right-4 z-50 w-[min(92vw,360px)]"
        >
          <div className="rounded-2xl border border-border/70 bg-card/95 backdrop-blur-xl shadow-xl p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                {isOffline ? <WifiOff className="w-5 h-5 text-primary" /> : <Download className="w-5 h-5 text-primary" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-sm">
                  {isOffline ? 'You are offline' : 'Install the app'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {isOffline
                    ? 'Cached pages stay available while you reconnect.'
                    : 'Add Nexus to your device for a faster, app-like experience.'}
                </p>
              </div>
              {!isOffline && (
                <button
                  type="button"
                  onClick={() => setShowPrompt(false)}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Dismiss install prompt"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {!isOffline && (
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setShowPrompt(false)}>
                  Not now
                </Button>
                <Button size="sm" className="gap-1.5" onClick={install}>
                  <Download className="w-4 h-4" /> Install
                </Button>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}