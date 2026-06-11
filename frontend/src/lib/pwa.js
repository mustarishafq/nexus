const IOS_INSTALL_DISMISS_KEY = 'nexus-pwa-ios-install-dismissed-until';

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

export function supportsNativeInstallPrompt() {
  return !isIosDevice();
}

export function canShowIosInstallPrompt() {
  return isIosDevice() && !isRunningStandalone() && !isIosInstallDismissed();
}

export function isIosInstallDismissed() {
  if (typeof localStorage === 'undefined') return false;

  const dismissedUntil = Number(localStorage.getItem(IOS_INSTALL_DISMISS_KEY) || 0);
  return dismissedUntil > Date.now();
}

export function dismissIosInstallPrompt(days = 14) {
  if (typeof localStorage === 'undefined') return;

  const expiresAt = Date.now() + days * 24 * 60 * 60 * 1000;
  localStorage.setItem(IOS_INSTALL_DISMISS_KEY, String(expiresAt));
}

export const IOS_INSTALL_STEPS = [
  'Tap the Share button in Safari (square with an arrow).',
  'Scroll down and tap "Add to Home Screen".',
  'Tap "Add" to install Nexus on your device.',
];
