import db from '@/api/base44Client';
import React, { useState, useEffect } from 'react';

import { Settings as SettingsIcon, Bell, Mail, MessageSquare, Smartphone, Volume2, VolumeX } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

export default function Settings() {
  const [user, setUser] = useState(null);
  const [settings, setSettings] = useState({
    in_app: true,
    email: true,
    sound: false,
    priority_filter: 'all',
  });

  useEffect(() => {
    db.auth.me().then(u => {
      setUser(u);
      if (u.notification_settings) {
        if (typeof u.notification_settings === 'string') {
          setSettings(prev => ({ ...prev, ...JSON.parse(u.notification_settings || '{}') }));
        } else {
          setSettings(prev => ({ ...prev, ...(u.notification_settings || {}) }));
        }
      }
    }).catch(() => {});
  }, []);

  const save = async () => {
    await db.auth.updateMe({ notification_settings: settings });
    toast.success('Settings saved');
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <SettingsIcon className="w-6 h-6 text-primary" /> Settings
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Configure notification preferences</p>
      </motion.div>

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
            <Switch checked={settings.in_app} onCheckedChange={v => setSettings(p => ({ ...p, in_app: v }))} />
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
            <Switch checked={settings.email} onCheckedChange={v => setSettings(p => ({ ...p, email: v }))} />
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
            <Switch checked={settings.sound} onCheckedChange={v => setSettings(p => ({ ...p, sound: v }))} />
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">Priority Filter</CardTitle>
          <CardDescription>Only show notifications above this priority</CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={settings.priority_filter} onValueChange={v => setSettings(p => ({ ...p, priority_filter: v }))}>
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
    </div>
  );
}