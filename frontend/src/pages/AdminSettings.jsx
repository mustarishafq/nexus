import db from '@/api/base44Client';
import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PenLine, Save, Server, Sparkles, Rocket, Shield } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import SettingsSectionNav from '@/components/settings/SettingsSectionNav';
import SplashSettingsPanel from '@/components/admin/SplashSettingsPanel';
import LaunchSettingsPanel from '@/components/admin/LaunchSettingsPanel';
import { useAuth } from '@/lib/AuthContext';
import { toast } from 'sonner';
import { normalizeSplashAnimation } from '@/lib/splashAnimations';
import { resetSplashFormState, splashConfigToFormState } from '@/lib/splashConfig';
import { launchConfigToFormState, resetLaunchFormState } from '@/lib/launchConfig';

const ADMIN_SECTIONS = [
  { id: 'branding', label: 'Branding', icon: PenLine },
  { id: 'splash', label: 'Splash', icon: Sparkles },
  { id: 'launch', label: 'App Launch', icon: Rocket },
  { id: 'email', label: 'Email', icon: Server },
];

const ADMIN_SECTION_IDS = new Set(ADMIN_SECTIONS.map((item) => item.id));

function mergeSettingsFromPayload(payload, fallback = {}) {
  const splashDefaults = resetSplashFormState();
  const launchDefaults = resetLaunchFormState();

  return {
    system_name: payload?.system_name || fallback.system_name || 'EMZI Nexus Brain',
    smtp_host: payload?.smtp_host || '',
    smtp_port: payload?.smtp_port || 587,
    smtp_username: payload?.smtp_username || '',
    smtp_password: payload?.smtp_password || '',
    smtp_encryption: payload?.smtp_encryption || 'tls',
    smtp_from_email: payload?.smtp_from_email || '',
    smtp_from_name: payload?.smtp_from_name || payload?.system_name || fallback.system_name || 'EMZI Nexus Brain',
    splash_animations: payload?.splash_animations || fallback.splash_animations || [],
    splash_system_name_animations: payload?.splash_system_name_animations || fallback.splash_system_name_animations || [],
    launch_animations: payload?.launch_animations || fallback.launch_animations || [],
    launch_overlay_modes: payload?.launch_overlay_modes || fallback.launch_overlay_modes || [],
    launch_progress_styles: payload?.launch_progress_styles || fallback.launch_progress_styles || [],
    launch_durations: payload?.launch_durations || fallback.launch_durations || [],
    ...splashDefaults,
    ...launchDefaults,
    ...splashConfigToFormState(payload?.splash || payload),
    ...launchConfigToFormState(payload?.launch || payload),
    splash_animation_style: normalizeSplashAnimation(payload?.splash_animation_style ?? payload?.splash?.animation_style),
  };
}

export default function AdminSettings({ embedded = false }) {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState(() => mergeSettingsFromPayload({}));

  const sectionParam = searchParams.get('section');
  const activeSection = ADMIN_SECTION_IDS.has(sectionParam) ? sectionParam : 'branding';

  const setActiveSection = (section) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set('tab', 'admin');
      next.set('section', section);
      return next;
    });
  };

  useEffect(() => {
    if (user?.role !== 'admin') {
      setLoading(false);
      return;
    }

    db.appSettings.admin()
      .then((payload) => {
        setSettings(mergeSettingsFromPayload(payload));
      })
      .catch((error) => {
        toast.error(error?.data?.message || error.message || 'Failed to load settings');
      })
      .finally(() => setLoading(false));
  }, [user?.role]);

  const save = async () => {
    setSaving(true);
    try {
      const payload = await db.appSettings.update(settings);
      setSettings((current) => mergeSettingsFromPayload(payload, current));
      toast.success('Admin settings saved');
      window.dispatchEvent(new Event('app-settings-updated'));
    } catch (error) {
      toast.error(error?.data?.message || error.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (user?.role !== 'admin') {
    return (
      <Card className="rounded-2xl w-full">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" /> Admin access required
          </CardTitle>
          <CardDescription>This section is only available to administrators.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="w-full space-y-4">
      {!embedded ? (
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary" /> Admin Settings
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Branding, splash screen, application launch, and email delivery.
          </p>
        </div>
      ) : null}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-muted border-t-primary rounded-full animate-spin" />
        </div>
      ) : (
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
          <SettingsSectionNav
            items={ADMIN_SECTIONS}
            value={activeSection}
            onChange={setActiveSection}
            className="lg:w-52 shrink-0"
          />

          <div className="min-w-0 flex-1 space-y-4">
            {activeSection === 'branding' ? (
              <Card className="rounded-2xl">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">System branding</CardTitle>
                  <CardDescription>Application name shown in the UI and browser title.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Label htmlFor="system_name">System name</Label>
                  <Input
                    id="system_name"
                    value={settings.system_name}
                    onChange={(event) => setSettings((current) => ({ ...current, system_name: event.target.value }))}
                    placeholder="EMZI Nexus Brain"
                  />
                </CardContent>
              </Card>
            ) : null}

            {activeSection === 'splash' ? (
              <Card className="overflow-visible rounded-2xl">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Splash screen</CardTitle>
                  <CardDescription>PWA splash animation, colors, timing, and media.</CardDescription>
                </CardHeader>
                <CardContent className="overflow-visible">
                  <SplashSettingsPanel settings={settings} onChange={setSettings} />
                </CardContent>
              </Card>
            ) : null}

            {activeSection === 'launch' ? (
              <Card className="overflow-visible rounded-2xl">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Application launch</CardTitle>
                  <CardDescription>Launch animation, layout, progress, and timing.</CardDescription>
                </CardHeader>
                <CardContent className="overflow-visible">
                  <LaunchSettingsPanel settings={settings} onChange={setSettings} />
                </CardContent>
              </Card>
            ) : null}

            {activeSection === 'email' ? (
              <Card className="rounded-2xl">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">SMTP connection</CardTitle>
                  <CardDescription>Outgoing mail server for application email.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="smtp_host">SMTP host</Label>
                    <Input
                      id="smtp_host"
                      value={settings.smtp_host}
                      onChange={(event) => setSettings((current) => ({ ...current, smtp_host: event.target.value }))}
                      placeholder="smtp.mailgun.org"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="smtp_port">SMTP port</Label>
                    <Input
                      id="smtp_port"
                      type="number"
                      value={settings.smtp_port}
                      onChange={(event) => setSettings((current) => ({ ...current, smtp_port: event.target.value }))}
                      placeholder="587"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="smtp_encryption">Encryption</Label>
                    <Select value={settings.smtp_encryption} onValueChange={(value) => setSettings((current) => ({ ...current, smtp_encryption: value }))}>
                      <SelectTrigger id="smtp_encryption">
                        <SelectValue placeholder="tls" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="tls">TLS</SelectItem>
                        <SelectItem value="ssl">SSL</SelectItem>
                        <SelectItem value="null">None</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="smtp_username">SMTP username</Label>
                    <Input
                      id="smtp_username"
                      value={settings.smtp_username}
                      onChange={(event) => setSettings((current) => ({ ...current, smtp_username: event.target.value }))}
                      placeholder="smtp-user"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="smtp_password">SMTP password</Label>
                    <Input
                      id="smtp_password"
                      type="password"
                      value={settings.smtp_password}
                      onChange={(event) => setSettings((current) => ({ ...current, smtp_password: event.target.value }))}
                      placeholder="••••••••"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="smtp_from_email">From email</Label>
                    <Input
                      id="smtp_from_email"
                      type="email"
                      value={settings.smtp_from_email}
                      onChange={(event) => setSettings((current) => ({ ...current, smtp_from_email: event.target.value }))}
                      placeholder="no-reply@example.com"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="smtp_from_name">From name</Label>
                    <Input
                      id="smtp_from_name"
                      value={settings.smtp_from_name}
                      onChange={(event) => setSettings((current) => ({ ...current, smtp_from_name: event.target.value }))}
                      placeholder="EMZI Nexus Brain"
                    />
                  </div>
                </CardContent>
              </Card>
            ) : null}

            <div className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-20 flex justify-end rounded-2xl border bg-background/95 p-3 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:bottom-4">
              <Button onClick={save} disabled={saving} className="gap-2">
                <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save admin settings'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
