/** Cleared when the app process is killed (e.g. removed from phone recents). */
export const SPLASH_SESSION_KEY = 'nexus_splash_session_done';

export function hasCompletedSessionSplash() {
  if (typeof window === 'undefined') return false;

  try {
    return window.sessionStorage.getItem(SPLASH_SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

export function shouldShowPwaSplash() {
  if (typeof window === 'undefined') return false;
  if (hasCompletedSessionSplash()) return false;

  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true;

  return isStandalone;
}

export function markSplashCompleted() {
  try {
    window.sessionStorage.setItem(SPLASH_SESSION_KEY, '1');
    window.localStorage.removeItem('nexus_splash_first_launch_done');
  } catch {
    // ignore storage errors
  }
}
