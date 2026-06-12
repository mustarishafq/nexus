import db from '@/api/base44Client';
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

import { Settings as SettingsIcon, Bell, Mail, Volume2, VolumeX, Shield, ShieldCheck, BellRing, BellOff, Loader2, Download, Moon, Sun } from 'lucide-react';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { useAuth } from '@/lib/AuthContext';
import { useWebPush } from '@/hooks/useWebPush';
import { syncNotificationSettingsCache } from '@/lib/notificationSettings';
import { playNotificationSound, unlockNotificationAudio } from '@/lib/notificationSound';
import {
  canShowIosInstallPrompt,
  IOS_INSTALL_STEPS,
  isIosDevice,
  isRunningStandalone,
  supportsNativeInstallPrompt,
} from '@/lib/pwa';
import AdminSettings from '@/pages/AdminSettings';

export default function Settings() {
  const { appPublicSettings, user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const isAdmin = user?.role === 'admin';
  const [settings, setSettings] = useState({
    in_app: true,
    email: true,
    sound: false,
  });
  const [activeTab, setActiveTab] = useState('user');
  const { pushState, subscribe, unsubscribe } = useWebPush(appPublicSettings?.web_push_public_key);
  const [installState, setInstallState] = useState({
    available: false,
    installed: isRunningStandalone(),
    iosInstall: canShowIosInstallPrompt(),
    loading: false,
  });
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState(null);

  useEffect(() => {
    db.auth.me().then((u) => {
      if (!u.notification_settings) return;

      const loaded = typeof u.notification_settings === 'string'
        ? JSON.parse(u.notification_settings || '{}')
        : (u.notification_settings || {});

      const next = { in_app: true, email: true, sound: false, ...loaded };
      setSettings(next);
      syncNotificationSettingsCache(next);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const tabFromUrl = searchParams.get('tab');
    const nextTab = isAdmin && tabFromUrl === 'admin' ? 'admin' : 'user';
    setActiveTab(nextTab);
  }, [isAdmin, searchParams]);

  useEffect(() => {
    const updateInstallState = () => {
      const installed = isRunningStandalone();

      setInstallState((current) => ({
        ...current,
        installed,
        iosInstall: isIosDevice() && !installed,
      }));

      if (installed) {
        setDeferredInstallPrompt(null);
      }
    };

    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setDeferredInstallPrompt(event);
      setInstallState((current) => ({
        ...current,
        available: true,
      }));
    };

    const handleAppInstalled = () => {
      setDeferredInstallPrompt(null);
      setInstallState((current) => ({
        ...current,
        available: false,
        installed: true,
        loading: false,
      }));
    };

    updateInstallState();

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('focus', updateInstallState);
    document.addEventListener('visibilitychange', updateInstallState);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('focus', updateInstallState);
      document.removeEventListener('visibilitychange', updateInstallState);
    };
  }, []);

  const subscribeToPush = async () => {
    const result = await subscribe();
    if (result.success) {
      toast.success('Web push enabled');
      return;
    }
    toast.error(result.error || 'Unable to enable web push');
  };

  const unsubscribeFromPush = async () => {
    const result = await unsubscribe();
    if (result.success) {
      toast.success('Web push disabled');
      return;
    }
    toast.error(result.error || 'Unable to disable web push');
  };

  const save = async () => {
    await db.auth.updateMe({ notification_settings: settings });
    syncNotificationSettingsCache(settings);
    toast.success('Settings saved');
  };

  const installApp = async () => {
    if (installState.iosInstall) {
      return;
    }

    if (!deferredInstallPrompt) {
      toast.info('Install prompt is not available yet on this browser session.');
      return;
    }

    setInstallState((current) => ({ ...current, loading: true }));

    try {
      deferredInstallPrompt.prompt();
      const choice = await deferredInstallPrompt.userChoice;

      setDeferredInstallPrompt(null);
      setInstallState((current) => ({
        ...current,
        loading: false,
        available: false,
        installed: choice?.outcome === 'accepted' ? true : current.installed,
      }));
    } catch {
      setInstallState((current) => ({ ...current, loading: false }));
      toast.error('Unable to open install prompt right now.');
    }
  };

  const handleTabChange = (value) => {
    setActiveTab(value);

    if (value === 'admin' && isAdmin) {
      setSearchParams({ tab: 'admin' });
      return;
    }

    setSearchParams({});
  };

  return (
    <div className="space-y-6 w-full">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <SettingsIcon className="w-6 h-6 text-primary" /> Settings
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Manage account preferences and system settings</p>
      </motion.div>

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="h-10">
          <TabsTrigger value="user" className="gap-2">
            <SettingsIcon className="w-4 h-4" /> Settings
          </TabsTrigger>
          {isAdmin ? (
            <TabsTrigger value="admin" className="gap-2">
              <Shield className="w-4 h-4" /> Admin Settings
            </TabsTrigger>
          ) : null}
        </TabsList>

        <TabsContent value="user" className="space-y-6">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Moon className="w-4 h-4 text-primary" /> Appearance
              </CardTitle>
              <CardDescription>Choose light or dark mode for the interface</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Sun className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Dark Mode</Label>
                    <p className="text-xs text-muted-foreground">Switch between light and dark themes</p>
                  </div>
                </div>
                <ThemeToggle variant="switch" />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Bell className="w-4 h-4 text-primary" /> Notification Channels
              </CardTitle>
              <CardDescription>Choose how you receive notifications</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Bell className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <Label className="text-sm font-medium">In-App Notifications</Label>
                    <p className="text-xs text-muted-foreground">Show notifications in the app</p>
                  </div>
                </div>
                <Switch
                  checked={settings.in_app}
                  onCheckedChange={(v) => setSettings((p) => {
                    const next = { ...p, in_app: v };
                    syncNotificationSettingsCache(next);
                    return next;
                  })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-info/10 flex items-center justify-center">
                    <Mail className="w-4 h-4 text-info" />
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Email Notifications</Label>
                    <p className="text-xs text-muted-foreground">Receive email for important alerts</p>
                  </div>
                </div>
                <Switch
                  checked={settings.email}
                  onCheckedChange={(v) => setSettings((p) => {
                    const next = { ...p, email: v };
                    syncNotificationSettingsCache(next);
                    return next;
                  })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-warning/10 flex items-center justify-center">
                    {settings.sound ? <Volume2 className="w-4 h-4 text-warning" /> : <VolumeX className="w-4 h-4 text-warning" />}
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Sound Alerts</Label>
                    <p className="text-xs text-muted-foreground">Play sound for new notifications</p>
                  </div>
                </div>
                <Switch
                  checked={settings.sound}
                  onCheckedChange={(v) => {
                    setSettings((p) => {
                      const next = { ...p, sound: v };
                      syncNotificationSettingsCache(next);
                      return next;
                    });

                    if (v) {
                      void unlockNotificationAudio().then(() => playNotificationSound());
                    }
                  }}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-dashed border-primary/30 bg-primary/5">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-primary" /> Web Push Notifications
              </CardTitle>
              <CardDescription>Receive notifications on phone, laptop, and iOS when the browser is closed</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!pushState.supported ? (
                <div className="text-sm text-muted-foreground">
                  This browser does not support Web Push.
                </div>
              ) : !appPublicSettings?.web_push_public_key ? (
                <div className="text-sm text-muted-foreground">
                  Web Push is not configured yet. Ask an admin to set the VAPID keys.
                </div>
              ) : (
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      {pushState.subscribed ? <BellRing className="w-4 h-4 text-emerald-600" /> : <BellOff className="w-4 h-4 text-muted-foreground" />}
                      {pushState.subscribed ? 'Web push enabled' : 'Web push disabled'}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {pushState.subscribed
                        ? pushState.synced
                          ? 'This device is subscribed and synced with the server.'
                          : 'This device is subscribed, but the server sync is pending.'
                        : 'Subscribe this device to receive browser notifications.'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Browser permission: {pushState.permission}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant={pushState.subscribed ? 'outline' : 'default'}
                    onClick={pushState.subscribed ? unsubscribeFromPush : subscribeToPush}
                    disabled={pushState.loading}
                  >
                    {pushState.loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                    {pushState.subscribed ? 'Disable' : 'Enable'}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-dashed border-primary/30 bg-primary/5">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Download className="w-4 h-4 text-primary" /> Install App
              </CardTitle>
              <CardDescription>Install Nexus for a faster app-like experience</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-muted-foreground">
                {installState.installed
                  ? 'Nexus is already installed on this device.'
                  : installState.iosInstall
                    ? 'On iPhone and iPad, install Nexus from Safari using Add to Home Screen.'
                    : installState.available
                      ? 'The browser install prompt is ready.'
                      : supportsNativeInstallPrompt()
                        ? 'Install prompt is currently unavailable. Keep browsing for a moment and try again.'
                        : 'Use your browser menu to install this app on your device.'}
              </div>

              {installState.iosInstall && !installState.installed ? (
                <ol className="space-y-2 pl-4 text-sm text-muted-foreground list-decimal">
                  {IOS_INSTALL_STEPS.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              ) : null}

              {!installState.iosInstall ? (
                <Button
                  type="button"
                  onClick={installApp}
                  disabled={!installState.available || installState.installed || installState.loading}
                >
                  {installState.loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                  {installState.installed ? 'Installed' : 'Install App'}
                </Button>
              ) : null}
            </CardContent>
          </Card>

          <Button onClick={save} className="w-full sm:w-auto">
            Save Settings
          </Button>
        </TabsContent>

        {isAdmin ? (
          <TabsContent value="admin">
            <AdminSettings embedded />
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  );
}