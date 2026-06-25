import type { CapacitorConfig } from '@capacitor/cli';

// VITE_API_BASE_URL must point at the deployed Express API for native builds
// (native apps have no dev-server proxy, unlike `vite dev`).
const PROD_API_ORIGIN = process.env.CAPACITOR_API_BASE_URL || 'https://emzinexus.com';

const config: CapacitorConfig = {
  appId: 'com.emzi.nexus',
  appName: 'EMZI Nexus Brain',
  webDir: 'dist',

  // Deep link / universal link scheme: emzinexus://...
  // Combine with Android intent-filters (AndroidManifest.xml) and
  // iOS Associated Domains (capacitor.entitlements) for https universal links.
  server: {
    androidScheme: 'https',
    iosScheme: 'https',
    allowNavigation: [
      'emzinexus.com',
      '*.emzinexus.com',
    ],
  },

  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      launchFadeOutDuration: 300,
      backgroundColor: '#022E96',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#022E96',
      overlaysWebView: false,
    },
    Keyboard: {
      resize: 'body',
      style: 'dark',
      resizeOnFullScreen: true,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
