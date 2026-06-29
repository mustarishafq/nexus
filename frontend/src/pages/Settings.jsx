import db from '@/api/apiClient';
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

import { Settings as SettingsIcon, Bell, Mail, Inbox, Volume2, VolumeX, Shield, ShieldCheck, BellRing, BellOff, Loader2, Download, Moon, Sun, Smartphone } from 'lucide-react';
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
import { usePwaInstall } from '@/hooks/usePwaInstall';
import { syncNotificationSettingsCache } from '@/lib/notificationSettings';
import { playNotificationSound, unlockNotificationAudio } from '@/lib/notificationSound';
import {
  CHROMIUM_INSTALL_STEPS,
  getInstallStatusMessage,
  getManualInstallSteps,
} from '@/lib/pwa';
import AdminSettings from '@/pages/AdminSettings';
import SettingsSectionNav from '@/components/settings/SettingsSectionNav';

const USER_SECTIONS = [
  { id: 'general', label: 'General', icon: Moon },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'app', label: 'App & Install', icon: Smartphone },
];

const USER_SECTION_IDS = new Set(USER_SECTIONS.map((item) => item.id));

export default function Settings() {
  const { appPublicSettings, user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const isAdmin = user?.role === 'admin';
  const [settings, setSettings] = useState({
    in_app: true,
    email: true,
    mail_inbox: true,
    sound: true,
  });
  const [activeTab, setActiveTab] = useState('user');
  const { pushState, subscribe, unsubscribe } = useWebPush(appPublicSettings?.web_push_public_key);
  const pwaInstall = usePwaInstall();
  const [installLoading, setInstallLoading] = useState(false);

  useEffect(() => {
    db.auth.me().then((u) => {
      if (!u.notification_settings) return;

      const loaded = typeof u.notification_settings === 'string'
        ? JSON.parse(u.notification_settings || '{}')
        : (u.notification_settings || {});

      const next = { in_app: true, email: true, mail_inbox: true, sound: true, ...loaded };
      setSettings(next);
      syncNotificationSettingsCache(next);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const tabFromUrl = searchParams.get('tab');
    const nextTab = isAdmin && tabFromUrl === 'admin' ? 'admin' : 'user';
    setActiveTab(nextTab);
  }, [isAdmin, searchParams]);

  const userSectionParam = searchParams.get('section');
  const userSection = activeTab === 'user' && USER_SECTION_IDS.has(userSectionParam)
    ? userSectionParam
    : 'general';

  const setUserSection = (section) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete('tab');
      next.set('section', section);
      return next;
    });
  };

  const installApp = async () => {
    if (pwaInstall.manualInstall || pwaInstall.chromiumFallback) {
      return;
    }

    if (!pwaInstall.hasNativePrompt) {
      toast.info('Install prompt is not available yet on this browser session.');
      return;
    }

    setInstallLoading(true);

    try {
      const choice = await pwaInstall.install();
      if (choice?.outcome === 'unavailable') {
        toast.info('Install prompt is not available yet on this browser session.');
      }
    } catch {
      toast.error('Unable to open install prompt right now.');
    } finally {
      setInstallLoading(false);
    }
  };

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

  const handleTabChange = (value) => {
    setActiveTab(value);

    if (value === 'admin' && isAdmin) {
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        next.set('tab', 'admin');
        if (!next.get('section') || !['branding', 'splash', 'launch', 'attendance', 'email'].includes(next.get('section'))) {
          next.set('section', 'branding');
        }
        return next;
      });
      return;
    }

    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete('tab');
      if (!next.get('section') || !USER_SECTION_IDS.has(next.get('section'))) {
        next.set('section', 'general');
      }
      return next;
    });
  };

  return (
    <div className="space-y-4 sm:space-y-6 w-full max-w-full min-w-0">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
          <SettingsIcon className="w-5 h-5 sm:w-6 sm:h-6 text-primary shrink-0" /> Settings
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Manage account preferences and system settings</p>
      </motion.div>

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:inline-flex sm:h-10 sm:w-auto">
          <TabsTrigger value="user" className="gap-2 min-h-[40px] sm:min-h-0">
            <SettingsIcon className="w-4 h-4 shrink-0" /> Settings
          </TabsTrigger>
          {isAdmin ? (
            <TabsTrigger value="admin" className="gap-2 min-h-[40px] sm:min-h-0">
              <Shield className="w-4 h-4 shrink-0" /> Admin
            </TabsTrigger>
          ) : null}
        </TabsList>

        <TabsContent value="user" className="mt-4 min-w-0">
          <div className="flex flex-col gap-4 md:flex-row md:items-start">
            <SettingsSectionNav
              items={USER_SECTIONS}
              value={userSection}
              onChange={setUserSection}
              className="md:w-48 lg:w-52 shrink-0"
            />

            <div className="min-w-0 flex-1 space-y-4">
              {userSection === 'general' ? (
                <Card className="rounded-2xl">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Moon className="w-4 h-4 text-primary" /> Appearance
                    </CardTitle>
                    <CardDescription>Choose light or dark mode for the interface.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-muted/10 p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:border-0 sm:bg-transparent sm:p-0">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <Sun className="w-4 h-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <Label className="text-sm font-medium">Dark mode</Label>
                          <p className="text-xs text-muted-foreground">Switch between light and dark themes</p>
                        </div>
                      </div>
                      <ThemeToggle variant="switch" className="self-end sm:self-auto" />
                    </div>
                  </CardContent>
                </Card>
              ) : null}

              {userSection === 'notifications' ? (
                <div className="space-y-4 pb-[calc(10rem+env(safe-area-inset-bottom))] sm:pb-0">
                  <Card className="rounded-2xl">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Bell className="w-4 h-4 text-primary" /> Notification channels
                      </CardTitle>
                      <CardDescription>Choose how you receive notifications.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-5">
                      <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-muted/10 p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:border-0 sm:bg-transparent sm:p-0">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <Bell className="w-4 h-4 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <Label className="text-sm font-medium">In-app notifications</Label>
                            <p className="text-xs text-muted-foreground">Show notifications in the app</p>
                          </div>
                        </div>
                        <Switch
                          className="shrink-0 self-end sm:self-auto"
                          checked={settings.in_app}
                          onCheckedChange={(v) => setSettings((p) => {
                            const next = { ...p, in_app: v };
                            syncNotificationSettingsCache(next);
                            return next;
                          })}
                        />
                      </div>

                      <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-muted/10 p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:border-0 sm:bg-transparent sm:p-0">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-lg bg-sky-500/10 flex items-center justify-center shrink-0">
                            <Inbox className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                          </div>
                          <div className="min-w-0">
                            <Label className="text-sm font-medium">New inbox alerts</Label>
                            <p className="text-xs text-muted-foreground">Notify when new mail arrives. With Web Push enabled, alerts work even when Nexus is closed.</p>
                          </div>
                        </div>
                        <Switch
                          className="shrink-0 self-end sm:self-auto"
                          checked={settings.mail_inbox}
                          onCheckedChange={(enabled) => {
                            setSettings((current) => {
                              const next = { ...current, mail_inbox: enabled };
                              syncNotificationSettingsCache(next);
                              return next;
                            });

                            if (enabled && typeof Notification !== 'undefined' && Notification.permission === 'default') {
                              void Notification.requestPermission();
                            }
                          }}
                        />
                      </div>

                      <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-muted/10 p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:border-0 sm:bg-transparent sm:p-0">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-lg bg-info/10 flex items-center justify-center shrink-0">
                            <Mail className="w-4 h-4 text-info" />
                          </div>
                          <div className="min-w-0">
                            <Label className="text-sm font-medium">Email notifications</Label>
                            <p className="text-xs text-muted-foreground">Receive email for important alerts</p>
                          </div>
                        </div>
                        <Switch
                          className="shrink-0 self-end sm:self-auto"
                          checked={settings.email}
                          onCheckedChange={(v) => setSettings((p) => {
                            const next = { ...p, email: v };
                            syncNotificationSettingsCache(next);
                            return next;
                          })}
                        />
                      </div>

                      <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-muted/10 p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:border-0 sm:bg-transparent sm:p-0">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-lg bg-warning/10 flex items-center justify-center shrink-0">
                            {settings.sound ? <Volume2 className="w-4 h-4 text-warning" /> : <VolumeX className="w-4 h-4 text-warning" />}
                          </div>
                          <div className="min-w-0">
                            <Label className="text-sm font-medium">Sound alerts</Label>
                            <p className="text-xs text-muted-foreground">Play sound for new notifications</p>
                          </div>
                        </div>
                        <Switch
                          className="shrink-0 self-end sm:self-auto"
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
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-primary" /> Web push
                      </CardTitle>
                      <CardDescription>Notifications when the browser is closed, including new inbox mail.</CardDescription>
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

                  <div className="sticky bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-30 -mx-1 rounded-2xl border bg-background/95 p-3 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none sm:backdrop-blur-none sm:z-auto">
                    <Button onClick={save} className="w-full sm:w-auto">
                      Save notification settings
                    </Button>
                  </div>
                </div>
              ) : null}

              {userSection === 'app' ? (
                <Card className="rounded-2xl border-dashed border-primary/30 bg-primary/5">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Download className="w-4 h-4 text-primary" /> Install app
                    </CardTitle>
                    <CardDescription>Install Nexus for a faster app-like experience.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="text-sm text-muted-foreground">
                      {getInstallStatusMessage(pwaInstall)}
                    </div>

                    {pwaInstall.manualInstall && !pwaInstall.installed ? (
                      <ol className="space-y-2 pl-4 text-sm text-muted-foreground list-decimal">
                        {getManualInstallSteps().map((step) => (
                          <li key={step}>{step}</li>
                        ))}
                      </ol>
                    ) : null}

                    {pwaInstall.chromiumFallback && !pwaInstall.installed ? (
                      <ol className="space-y-2 pl-4 text-sm text-muted-foreground list-decimal">
                        {CHROMIUM_INSTALL_STEPS.map((step) => (
                          <li key={step}>{step}</li>
                        ))}
                      </ol>
                    ) : null}

                    {!pwaInstall.manualInstall && !pwaInstall.chromiumFallback && !pwaInstall.installed ? (
                      <Button
                        type="button"
                        onClick={installApp}
                        disabled={!pwaInstall.hasNativePrompt || pwaInstall.installed || installLoading}
                      >
                        {installLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                        {pwaInstall.installed ? 'Installed' : 'Install App'}
                      </Button>
                    ) : null}
                  </CardContent>
                </Card>
              ) : null}
            </div>
          </div>
        </TabsContent>

        {isAdmin ? (
          <TabsContent value="admin" className="mt-4 min-w-0">
            <AdminSettings embedded />
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  );
}