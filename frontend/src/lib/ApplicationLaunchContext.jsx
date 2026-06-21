import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import db from '@/api/base44Client';
import ApplicationLaunchOverlay from '@/components/applications/ApplicationLaunchOverlay';
import { openApplicationTarget } from '@/lib/applications';
import {
  getLaunchDurationPreset,
  normalizeLaunchConfig,
  resolveLaunchConfigFromSettings,
  shouldShowLaunchOverlay,
} from '@/lib/launchConfig';
import { DEFAULT_BRAND_COLOR } from '@/lib/imageColor';
import { useAuth } from '@/lib/AuthContext';

const ApplicationLaunchContext = createContext(null);

function lockBodyScroll(active) {
  if (!active) return undefined;

  const { documentElement, body } = document;
  const prevHtmlOverflow = documentElement.style.overflow;
  const prevBodyOverflow = body.style.overflow;
  const prevBodyTouchAction = body.style.touchAction;

  documentElement.style.overflow = 'hidden';
  body.style.overflow = 'hidden';
  body.style.touchAction = 'none';

  return () => {
    documentElement.style.overflow = prevHtmlOverflow;
    body.style.overflow = prevBodyOverflow;
    body.style.touchAction = prevBodyTouchAction;
  };
}

function resolveLaunchTarget(result, navigate) {
  if (!result) return;

  if (result.action === 'navigate') {
    navigate(result.path);
    return;
  }

  if (result.action === 'open_external') {
    const tab = result.newTab
      ? window.open(result.url, '_blank', 'noopener,noreferrer')
      : null;

    if (tab) {
      tab.opener = null;
      return;
    }

    window.location.href = result.url;
  }
}

export function ApplicationLaunchProvider({ children }) {
  const { appPublicSettings } = useAuth();
  const [launch, setLaunch] = useState(null);
  const [launchingId, setLaunchingId] = useState(null);
  const pendingTargetRef = useRef(null);
  const previewReadyTimerRef = useRef(null);
  const previewResolveRef = useRef(null);
  const launchConfig = useMemo(
    () => resolveLaunchConfigFromSettings(appPublicSettings),
    [appPublicSettings],
  );
  const durationPreset = useMemo(
    () => getLaunchDurationPreset(launchConfig.duration, appPublicSettings?.launch_durations),
    [launchConfig.duration, appPublicSettings?.launch_durations],
  );

  useEffect(() => {
    if (!launch) return undefined;
    return lockBodyScroll(true);
  }, [launch]);

  const finishLaunch = useCallback(() => {
    const pendingTarget = pendingTargetRef.current;
    pendingTargetRef.current = null;

    if (previewReadyTimerRef.current) {
      window.clearTimeout(previewReadyTimerRef.current);
      previewReadyTimerRef.current = null;
    }

    setLaunch(null);
    setLaunchingId(null);

    if (pendingTarget) {
      window.setTimeout(() => resolveLaunchTarget(pendingTarget, pendingTarget.navigate), 0);
    }

    previewResolveRef.current?.();
    previewResolveRef.current = null;
  }, []);

  const launchWithAnimation = useCallback(async (application, navigate) => {
    if (!application?.is_enabled || launchingId === application.id) {
      return;
    }

    if (!shouldShowLaunchOverlay(launchConfig)) {
      setLaunchingId(application.id);
      try {
        const result = await openApplicationTarget(db, application, { navigate, deferNavigation: true });
        resolveLaunchTarget(result, navigate);
      } finally {
        setLaunchingId(null);
      }
      return;
    }

    setLaunchingId(application.id);
    pendingTargetRef.current = null;

    const launchKey = `${application.id}-${Date.now()}`;
    setLaunch({
      key: launchKey,
      application,
      config: launchConfig,
      animationCatalog: appPublicSettings?.launch_animations,
      ready: false,
    });

    let launchError = null;
    let launchTarget = null;

    const launchPromise = openApplicationTarget(db, application, {
      navigate,
      deferNavigation: true,
    })
      .then((result) => {
        launchTarget = result;
      })
      .catch((error) => {
        launchError = error;
      });

    await Promise.all([
      launchPromise,
      new Promise((resolve) => window.setTimeout(resolve, durationPreset.min_ms)),
    ]);

    if (launchError) {
      setLaunch(null);
      setLaunchingId(null);
      pendingTargetRef.current = null;
      throw launchError;
    }

    pendingTargetRef.current = launchTarget ? { ...launchTarget, navigate } : null;
    setLaunch((current) => (current?.key === launchKey ? { ...current, ready: true } : current));
  }, [appPublicSettings?.launch_animations, durationPreset.min_ms, launchConfig, launchingId]);

  const previewLaunchAnimation = useCallback((config, options = {}) => {
    const normalizedConfig = normalizeLaunchConfig(config);

    if (!shouldShowLaunchOverlay(normalizedConfig)) {
      return Promise.resolve({ skipped: true, reason: 'instant' });
    }

    if (launch || launchingId) {
      return Promise.resolve({ skipped: true, reason: 'busy' });
    }

    const durationCatalog = options.durationCatalog ?? appPublicSettings?.launch_durations;
    const durationPresetForPreview = getLaunchDurationPreset(normalizedConfig.duration, durationCatalog);
    const application = options.application ?? {
      id: 'launch-preview',
      name: 'Preview App',
      color: DEFAULT_BRAND_COLOR,
      is_enabled: true,
    };

    return new Promise((resolve) => {
      previewResolveRef.current = resolve;

      const launchKey = `preview-${Date.now()}`;
      setLaunchingId(application.id);
      pendingTargetRef.current = null;

      setLaunch({
        key: launchKey,
        application,
        config: normalizedConfig,
        animationCatalog: options.animationCatalog ?? appPublicSettings?.launch_animations,
        durationCatalog,
        ready: false,
        preview: true,
      });

      previewReadyTimerRef.current = window.setTimeout(() => {
        previewReadyTimerRef.current = null;
        setLaunch((current) => (current?.key === launchKey ? { ...current, ready: true } : current));
      }, durationPresetForPreview.min_ms);
    });
  }, [appPublicSettings?.launch_animations, appPublicSettings?.launch_durations, launch, launchingId]);

  const value = useMemo(
    () => ({
      launchingId,
      launchWithAnimation,
      previewLaunchAnimation,
    }),
    [launchWithAnimation, launchingId, previewLaunchAnimation],
  );

  return (
    <ApplicationLaunchContext.Provider value={value}>
      {children}
      <ApplicationLaunchOverlay
        launch={launch}
        onDismiss={finishLaunch}
        durationCatalog={appPublicSettings?.launch_durations}
      />
    </ApplicationLaunchContext.Provider>
  );
}

export function useApplicationLaunch() {
  const context = useContext(ApplicationLaunchContext);

  if (!context) {
    throw new Error('useApplicationLaunch must be used within ApplicationLaunchProvider');
  }

  return context;
}
