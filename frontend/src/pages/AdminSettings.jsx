import db from '@/api/base44Client';
import React, { useEffect, useState } from 'react';

import { Shield, PenLine, Save, Server } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/lib/AuthContext';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

export default function AdminSettings() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    system_name: 'Nexus',
    smtp_host: '',
    smtp_port: 587,
    smtp_username: '',
    smtp_password: '',
    smtp_encryption: 'tls',
    smtp_from_email: '',
    smtp_from_name: '',
  });

  useEffect(() => {
    if (user?.role !== 'admin') {
      setLoading(false);
      return;
    }

    db.appSettings.admin()
      .then((payload) => {
        setSettings({
          system_name: payload?.system_name || 'Nexus',
          smtp_host: payload?.smtp_host || '',
          smtp_port: payload?.smtp_port || 587,
          smtp_username: payload?.smtp_username || '',
          smtp_password: payload?.smtp_password || '',
          smtp_encryption: payload?.smtp_encryption || 'tls',
          smtp_from_email: payload?.smtp_from_email || '',
          smtp_from_name: payload?.smtp_from_name || payload?.system_name || 'Nexus',
        });
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
      setSettings({
        system_name: payload?.system_name || settings.system_name,
        smtp_host: payload?.smtp_host || '',
        smtp_port: payload?.smtp_port || 587,
        smtp_username: payload?.smtp_username || '',
        smtp_password: payload?.smtp_password || '',
        smtp_encryption: payload?.smtp_encryption || 'tls',
        smtp_from_email: payload?.smtp_from_email || '',
        smtp_from_name: payload?.smtp_from_name || payload?.system_name || settings.system_name,
      });
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
      <Card className="rounded-2xl max-w-2xl">
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
    <div className="space-y-6 max-w-3xl">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Shield className="w-6 h-6 text-primary" /> Admin Settings
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Manage the system name and default email sender.</p>
      </motion.div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-muted border-t-primary rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <PenLine className="w-4 h-4 text-primary" /> System Branding
              </CardTitle>
              <CardDescription>Controls the application name shown in the UI and browser title.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Label htmlFor="system_name">System name</Label>
              <Input
                id="system_name"
                value={settings.system_name}
                onChange={(event) => setSettings((current) => ({ ...current, system_name: event.target.value }))}
                placeholder="Nexus"
              />
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Server className="w-4 h-4 text-primary" /> SMTP Connection
              </CardTitle>
              <CardDescription>Configure the SMTP server that sends application mail.</CardDescription>
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
                  placeholder="Nexus"
                />
              </div>
            </CardContent>
          </Card>

          <Button onClick={save} disabled={saving} className="w-full sm:w-auto gap-2">
            <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Admin Settings'}
          </Button>
        </div>
      )}
    </div>
  );
}