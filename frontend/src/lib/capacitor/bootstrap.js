import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { Keyboard } from '@capacitor/keyboard';
import { App as CapacitorApp } from '@capacitor/app';
import { isNativePlatform, isAndroid } from '@/lib/capacitor/platform';
import { initDeepLinks } from '@/lib/capacitor/deepLinks';
import { registerNativePush } from '@/lib/capacitor/push';

/**
 * Single entry point for all native-only wiring. Safe to call on web too —
 * every step early-returns via isNativePlatform(), so the web/PWA bundle
 * behaves exactly as before. Call once from main.jsx.
 */
export async function initCapacitor() {
  if (!isNativePlatform()) return;

  document.documentElement.classList.add('capacitor-native', `capacitor-${isAndroid() ? 'android' : 'ios'}`);

  try {
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: '#022E96' });
    await StatusBar.setOverlaysWebView({ overlay: false });
  } catch (error) {
    console.warn('[capacitor] StatusBar setup failed:', error);
  }

  try {
    await Keyboard.setResizeMode({ mode: 'body' });
    await Keyboard.setScroll({ isDisabled: false });
  } catch (error) {
    console.warn('[capacitor] Keyboard setup failed:', error);
  }

  CapacitorApp.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack) {
      window.history.back();
    } else {
      CapacitorApp.exitApp();
    }
  });

  initDeepLinks();
  registerNativePush().catch((error) => console.warn('[capacitor] Push registration failed:', error));

  // Hide the native splash once the React app has painted its first frame.
  window.requestAnimationFrame(() => {
    window.setTimeout(() => {
      SplashScreen.hide().catch(() => {});
    }, 150);
  });
}
