import db from '@/api/base44Client';
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

import { Settings as SettingsIcon, Bell, Mail, Volume2, VolumeX, Shield, ShieldCheck, BellRing, BellOff, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { useAuth } from '@/lib/AuthContext';
import { isWebPushSupported, urlBase64ToUint8Array } from '@/lib/webPush';
import AdminSettings from '@/pages/AdminSettings';

export default function Settings() {
  const { appPublicSettings, user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const isAdmin = user?.role === 'admin';
  const [settings, setSettings] = useState({
    in_app: true,
    email: true,
    sound: false,
    priority_filter: 'all',
  });
  const [activeTab, setActiveTab] = useState('user');
  const [pushState, setPushState] = useState({
    loading: false,
    subscribed: false,
    supported: false,
    permission: 'default',
    synced: false,
  });

  useEffect(() => {
    db.auth.me().then((u) => {
      if (u.notification_settings) {
        if (typeof u.notification_settings === 'string') {
          setSettings((prev) => ({ ...prev, ...JSON.parse(u.notification_settings || '{}') }));
        } else {
          setSettings((prev) => ({ ...prev, ...(u.notification_settings || {}) }));
        }
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    refreshPushState();
  }, [appPublicSettings]);

  useEffect(() => {
    const tabFromUrl = searchParams.get('tab');
    const nextTab = isAdmin && tabFromUrl === 'admin' ? 'admin' : 'user';
    setActiveTab(nextTab);
  }, [isAdmin, searchParams]);

  const refreshPushState = async () => {
    const supported = isWebPushSupported();

    if (!supported) {
      setPushState({
        loading: false,
        subscribed: false,
        supported: false,
        permission: 'unsupported',
        synced: false,
      });
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const browserSubscription = await registration.pushManager.getSubscription();
      const storedSubscriptions = await db.pushSubscriptions.list();
      const synced = Boolean(browserSubscription && Array.isArray(storedSubscriptions)
        && storedSubscriptions.some((item) => item.endpoint === browserSubscription.endpoint));

      setPushState({
        loading: false,
        subscribed: Boolean(browserSubscription),
        supported: true,
        permission: Notification.permission,
        synced,
      });
    } catch {
      setPushState((current) => ({
        ...current,
        loading: false,
        supported: true,
        permission: Notification.permission,
      }));
    }
  };

  const subscribeToPush = async () => {
    if (!isWebPushSupported()) {
      toast.error('Web push is not supported in this browser');
      return;
    }

    const publicKey = appPublicSettings?.web_push_public_key;
    if (!publicKey) {
      toast.error('Web push is not configured by the administrator');
      return;
    }

    setPushState((current) => ({ ...current, loading: true }));

    try {
      const permission = Notification.permission === 'granted'
        ? 'granted'
        : await Notification.requestPermission();

      if (permission !== 'granted') {
        throw new Error('Notification permission was not granted');
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      await db.pushSubscriptions.upsert({
        ...subscription.toJSON(),
        userAgent: navigator.userAgent,
      });

      toast.success('Web push enabled');
      await refreshPushState();
    } catch (error) {
      toast.error(error?.message || 'Unable to enable web push');
      await refreshPushState();
    }
  };

  const unsubscribeFromPush = async () => {
    if (!isWebPushSupported()) {
      return;
    }

    setPushState((current) => ({ ...current, loading: true }));

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await db.pushSubscriptions.remove({ endpoint: subscription.endpoint });
        await subscription.unsubscribe();
      }

      toast.success('Web push disabled');
      await refreshPushState();
    } catch (error) {
      toast.error(error?.message || 'Unable to disable web push');
      await refreshPushState();
    }
  };

  const save = async () => {
    await db.auth.updateMe({ notification_settings: settings });
    toast.success('Settings saved');
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
    <div className="space-y-6 max-w-2xl">
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
                <Switch checked={settings.in_app} onCheckedChange={(v) => setSettings((p) => ({ ...p, in_app: v }))} />
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
                <Switch checked={settings.email} onCheckedChange={(v) => setSettings((p) => ({ ...p, email: v }))} />
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
                <Switch checked={settings.sound} onCheckedChange={(v) => setSettings((p) => ({ ...p, sound: v }))} />
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

          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="text-base">Priority Filter</CardTitle>
              <CardDescription>Only show notifications above this priority</CardDescription>
            </CardHeader>
            <CardContent>
              <Select value={settings.priority_filter} onValueChange={(v) => setSettings((p) => ({ ...p, priority_filter: v }))}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  <SelectItem value="medium">Medium & Above</SelectItem>
                  <SelectItem value="high">High & Above</SelectItem>
                  <SelectItem value="critical">Critical Only</SelectItem>
                </SelectContent>
              </Select>
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