const MANUAL_INSTALL_DISMISS_KEY = 'nexus-pwa-ios-install-dismissed-until';

let deferredInstallPrompt = null;
let relatedAppInstalled = false;
let listenersInitialized = false;
const installStateListeners = new Set();

export function isRunningStandalone() {
  if (typeof window === 'undefined') return false;

  return (
    window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true
  );
}

export function isIosDevice() {
  if (typeof navigator === 'undefined') return false;

  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

export function isSafari() {
  if (typeof navigator === 'undefined') return false;

  const ua = navigator.userAgent;
  return ua.includes('Safari/') && !ua.includes('Chrome') && !ua.includes('Chromium') && !ua.includes('Edg/');
}

export function isMacOs() {
  if (typeof navigator === 'undefined') return false;

  return /Mac/.test(navigator.userAgent) && !isIosDevice();
}

/** Browsers that may fire `beforeinstallprompt` (Chromium on desktop/Android). */
export function supportsNativeInstallPrompt() {
  if (typeof navigator === 'undefined') return false;
  if (isSafari() || isIosDevice()) return false;

  const ua = navigator.userAgent;
  return ua.includes('Chrome') || ua.includes('Edg/') || ua.includes('OPR/');
}

export function needsManualInstallInstructions() {
  if (isRunningStandalone()) return false;
  if (isIosDevice()) return true;
  if (isSafari() && isMacOs()) return true;
  return false;
}

export function getManualInstallPlatform() {
  if (isRunningStandalone()) return null;
  if (isIosDevice()) return 'ios';
  if (isSafari() && isMacOs()) return 'macos-safari';
  return null;
}

export function canShowIosInstallPrompt() {
  return getManualInstallPlatform() === 'ios' && !isManualInstallDismissed();
}

export function canShowManualInstallPrompt() {
  return needsManualInstallInstructions() && !isManualInstallDismissed();
}

export function isManualInstallDismissed() {
  if (typeof localStorage === 'undefined') return false;

  const dismissedUntil = Number(localStorage.getItem(MANUAL_INSTALL_DISMISS_KEY) || 0);
  return dismissedUntil > Date.now();
}

export function dismissIosInstallPrompt(days = 14) {
  dismissManualInstallPrompt(days);
}

export function dismissManualInstallPrompt(days = 14) {
  if (typeof localStorage === 'undefined') return;

  const expiresAt = Date.now() + days * 24 * 60 * 60 * 1000;
  localStorage.setItem(MANUAL_INSTALL_DISMISS_KEY, String(expiresAt));
}

export const IOS_INSTALL_STEPS = [
  'Open this page in Safari if you are using another browser.',
  'Tap the Share button (square with an arrow).',
  'Scroll down and tap "Add to Home Screen".',
  'Tap "Add" to install Nexus on your device.',
];

export const MACOS_SAFARI_INSTALL_STEPS = [
  'Open this page in Safari if you are using another browser.',
  'Choose File → Add to Dock from the menu bar.',
  'Or click Share in the toolbar and choose Add to Dock.',
  'Click Add to install Nexus on your Mac.',
];

export function getManualInstallSteps() {
  const platform = getManualInstallPlatform();
  if (platform === 'ios') return IOS_INSTALL_STEPS;
  if (platform === 'macos-safari') return MACOS_SAFARI_INSTALL_STEPS;
  return [];
}

export function getManualInstallDescription() {
  const platform = getManualInstallPlatform();
  if (platform === 'ios') {
    return 'On iPhone and iPad, install Nexus from Safari using Add to Home Screen.';
  }
  if (platform === 'macos-safari') {
    return 'In Safari on Mac, add Nexus to your Dock for an app-like experience.';
  }
  return 'Use your browser menu to install this app on your device.';
}

export const CHROMIUM_INSTALL_STEPS = [
  'If Chrome shows "Open in app" in the address bar, Nexus is already installed — click that to launch it.',
  'To install fresh, click the install icon in the address bar (to the right of the URL).',
  'Or open the Chrome menu (⋮) and choose Install Nexus…',
];

export function getChromiumInstallDescription() {
  return 'Install Nexus using Chrome\'s install option in the address bar. If you already installed it, click Open in app there instead.';
}

export function isPwaInstalled() {
  return isRunningStandalone() || relatedAppInstalled;
}

export function getPwaInstallState() {
  const installed = isPwaInstalled();
  const hasNativePrompt = deferredInstallPrompt !== null;
  const manualInstall = !installed && needsManualInstallInstructions();
  const chromiumFallback = !installed && !hasNativePrompt && supportsNativeInstallPrompt();

  return {
    installed,
    hasNativePrompt,
    manualInstall,
    chromiumFallback,
    supportsNative: supportsNativeInstallPrompt(),
  };
}

function notifyInstallStateListeners() {
  const state = getPwaInstallState();
  installStateListeners.forEach((listener) => listener(state));
}

async function refreshRelatedAppInstallState() {
  if (!('getInstalledRelatedApps' in navigator)) return;

  try {
    const apps = await navigator.getInstalledRelatedApps();
    const nextInstalled = apps.length > 0;
    if (nextInstalled !== relatedAppInstalled) {
      relatedAppInstalled = nextInstalled;
      notifyInstallStateListeners();
    }
  } catch {
    // Ignore unsupported or blocked lookups.
  }
}

export function initPwaInstallListeners() {
  if (typeof window === 'undefined' || listenersInitialized) return;
  listenersInitialized = true;

  const handleBeforeInstallPrompt = (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    notifyInstallStateListeners();
  };

  const handleAppInstalled = () => {
    deferredInstallPrompt = null;
    relatedAppInstalled = true;
    notifyInstallStateListeners();
  };

  const handleFocus = () => {
    refreshRelatedAppInstallState();
  };

  window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  window.addEventListener('appinstalled', handleAppInstalled);
  window.addEventListener('focus', handleFocus);
  document.addEventListener('visibilitychange', handleFocus);

  refreshRelatedAppInstallState();
  notifyInstallStateListeners();
}

export function subscribePwaInstallState(listener) {
  initPwaInstallListeners();
  installStateListeners.add(listener);
  listener(getPwaInstallState());

  return () => {
    installStateListeners.delete(listener);
  };
}

export async function promptPwaInstall() {
  if (!deferredInstallPrompt) {
    return { outcome: 'unavailable' };
  }

  deferredInstallPrompt.prompt();
  const choice = await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;

  if (choice?.outcome === 'accepted') {
    relatedAppInstalled = true;
  }

  notifyInstallStateListeners();
  return choice;
}

export function getInstalledStatusMessage() {
  if (isRunningStandalone()) {
    return 'You are currently using the installed Nexus app.';
  }

  if (relatedAppInstalled) {
    return 'Nexus is already installed. Use Chrome\'s "Open in app" button in the address bar, or open Nexus from your Applications folder.';
  }

  return 'Nexus is already installed on this device.';
}

export function getInstallStatusMessage(state = getPwaInstallState()) {
  if (state.installed) {
    return getInstalledStatusMessage();
  }
  if (state.manualInstall) {
    return getManualInstallDescription();
  }
  if (state.hasNativePrompt) {
    return 'The browser install prompt is ready.';
  }
  if (state.chromiumFallback) {
    return getChromiumInstallDescription();
  }
  if (state.supportsNative) {
    return 'Install prompt is currently unavailable. Keep browsing for a moment and try again.';
  }
  return 'Use your browser menu to install this app on your device.';
}
