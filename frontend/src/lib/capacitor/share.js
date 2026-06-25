import { Share } from '@capacitor/share';
import { isNativePlatform } from '@/lib/capacitor/platform';

/**
 * Cross-platform share helper. Uses the Capacitor Share plugin (native
 * sheet) on Android/iOS, and falls back to navigator.share on web, then
 * clipboard as a last resort. Drop-in replacement for any `navigator.share`
 * call already in the app.
 */
export async function shareContent({ title, text, url, dialogTitle = 'Share' } = {}) {
  if (isNativePlatform()) {
    await Share.share({ title, text, url, dialogTitle });
    return { success: true, method: 'native' };
  }

  if (typeof navigator !== 'undefined' && navigator.share) {
    await navigator.share({ title, text, url });
    return { success: true, method: 'web-share' };
  }

  if (typeof navigator !== 'undefined' && navigator.clipboard && url) {
    await navigator.clipboard.writeText(url);
    return { success: true, method: 'clipboard' };
  }

  return { success: false, error: 'Sharing is not supported in this environment' };
}

export function isShareSupported() {
  return isNativePlatform() || (typeof navigator !== 'undefined' && Boolean(navigator.share));
}
