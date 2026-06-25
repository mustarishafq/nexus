import { App as CapacitorApp } from '@capacitor/app';
import { isNativePlatform } from '@/lib/capacitor/platform';

export const DEEP_LINK_EVENT = 'capacitor-deeplink';

/**
 * Listens for `appUrlOpen` (emzinexus://... and https://emzinexus.com/...
 * universal links) and dispatches a DOM event with the in-app path so a
 * component inside the Router (see DeepLinkListener in App.jsx) can
 * navigate with react-router, without this module needing router access.
 */
export function initDeepLinks() {
  if (!isNativePlatform()) return;

  CapacitorApp.addListener('appUrlOpen', ({ url }) => {
    try {
      const parsed = new URL(url);
      const path = `${parsed.pathname}${parsed.search}${parsed.hash}` || '/';
      window.dispatchEvent(new CustomEvent(DEEP_LINK_EVENT, { detail: { path, url } }));
    } catch (error) {
      console.warn('[deep-link] Failed to parse URL:', url, error);
    }
  });
}
