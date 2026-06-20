import db from '@/api/base44Client';
import React, { createContext, useState, useContext, useEffect } from 'react';
import { clearBirthdayShownKeys } from '@/lib/birthday';
import { clearBroadcastAckKeys } from '@/lib/broadcast';
import { syncNotificationSettingsCache } from '@/lib/notificationSettings';

const AuthContext = createContext(null);
const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;
const DARK_THEME_COLOR = '#0F172A';

function resolveSplashThemeColor(settings) {
  const candidates = [
    settings?.splash?.background_color,
    settings?.splash_background_color,
    settings?.background_color,
  ];

  const valid = candidates.find((value) => typeof value === 'string' && HEX_COLOR_REGEX.test(value.trim()));
  return valid ? valid.toUpperCase() : '#022E96';
}

function applyThemeColor(color) {
  if (typeof document === 'undefined') return;
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  if (themeMeta) {
    themeMeta.setAttribute('content', color);
  }
}

function resolveThemePreference() {
  if (typeof window === 'undefined') return 'light';

  const saved = window.localStorage.getItem('nexus-theme');
  if (saved === 'dark' || saved === 'light') return saved;
  if (saved === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function resolveThemeColor(settings) {
  const preference = resolveThemePreference();
  if (preference === 'dark') return DARK_THEME_COLOR;
  return resolveSplashThemeColor(settings);
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [appPublicSettings, setAppPublicSettings] = useState(null); // Contains only { id, public_settings }
  const [forcePasswordChange, setForcePasswordChange] = useState(false);

  useEffect(() => {
    checkAppState();
  }, []);

  useEffect(() => {
    const handleSettingsUpdated = () => {
      refreshPublicSettings();
    };

    window.addEventListener('app-settings-updated', handleSettingsUpdated);
    return () => window.removeEventListener('app-settings-updated', handleSettingsUpdated);
  }, []);

  useEffect(() => {
    const updateThemeMeta = () => {
      applyThemeColor(resolveThemeColor(appPublicSettings));
    };

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const observer = new MutationObserver(updateThemeMeta);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    window.addEventListener('storage', updateThemeMeta);
    mediaQuery.addEventListener('change', updateThemeMeta);
    updateThemeMeta();

    return () => {
      observer.disconnect();
      window.removeEventListener('storage', updateThemeMeta);
      mediaQuery.removeEventListener('change', updateThemeMeta);
    };
  }, [appPublicSettings]);

  const refreshPublicSettings = async () => {
    try {
      const publicSettings = await db.appSettings.public();
      setAppPublicSettings(publicSettings || { system_name: 'EMZI Nexus Brain' });

      if (publicSettings?.system_name) {
        document.title = publicSettings.system_name;
        // Update apple-mobile-web-app-title meta tag for iOS PWA
        const appleTitle = document.getElementById('apple-app-title');
        if (appleTitle) {
          appleTitle.setAttribute('content', publicSettings.system_name);
        }
      }

      applyThemeColor(resolveThemeColor(publicSettings));
    } catch {
      setAppPublicSettings({ system_name: 'EMZI Nexus Brain' });
      applyThemeColor(resolveThemeColor(null));
    }
  };

  const checkAppState = async () => {
    try {
      setIsLoadingAuth(true);
      setIsLoadingPublicSettings(true);
      setAuthError(null);

      await refreshPublicSettings();

      await checkUserAuth();
      setIsLoadingPublicSettings(false);
    } catch (error) {
      console.error('Unexpected error:', error);
      setAppPublicSettings({ system_name: 'EMZI Nexus Brain' });
      setAuthError({
        type: 'unknown',
        message: error.message || 'An unexpected error occurred'
      });
      setIsLoadingPublicSettings(false);
      setIsLoadingAuth(false);
    }
  };

  const checkUserAuth = async () => {
    try {
      setIsLoadingAuth(true);
      const currentUser = await db.auth.me();
      syncNotificationSettingsCache(currentUser?.notification_settings);
      setUser(currentUser);
      setIsAuthenticated(true);
      
      // Check if user needs to force password change
      setForcePasswordChange(currentUser.force_password_change || false);
      
      setIsLoadingAuth(false);
      setAuthChecked(true);
      setAuthError(null);
    } catch (error) {
      console.error('User auth check failed:', error);
      setIsLoadingAuth(false);
      setUser(null);
      setIsAuthenticated(false);
      setForcePasswordChange(false);
      setAuthChecked(true);
      if (error?.status === 403 && error?.data?.code === 'account_not_approved') {
        setAuthError({
          type: 'user_not_approved',
          message: 'Your account is pending admin approval.',
        });
        return;
      }
      setAuthError({
        type: 'auth_required',
        message: 'Please login to continue.',
      });
    }
  };

  const logout = (shouldRedirect = true) => {
    clearBirthdayShownKeys();
    clearBroadcastAckKeys();
    setUser(null);
    setIsAuthenticated(false);
    setForcePasswordChange(false);
    
    if (shouldRedirect) {
      // Use the SDK's logout method which handles token cleanup and redirect
      db.auth.logout('/login');
    } else {
      // Just remove the token without redirect
      db.auth.logout();
    }
  };

  const navigateToLogin = () => {
    db.auth.redirectToLogin('/login');
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      isAuthenticated, 
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      authChecked,
      forcePasswordChange,
      logout,
      navigateToLogin,
      checkUserAuth,
      checkAppState
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
