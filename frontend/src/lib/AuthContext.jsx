import db from '@/api/base44Client';
import React, { createContext, useState, useContext, useEffect } from 'react';
import { clearBirthdayShownKeys } from '@/lib/birthday';

const AuthContext = createContext();

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
    } catch {
      setAppPublicSettings({ system_name: 'EMZI Nexus Brain' });
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
