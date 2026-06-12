// @ts-nocheck
import db from '@/api/base44Client';
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import {
  User,
  Lock,
  Mail,
  Save,
  Loader2,
  Eye,
  EyeOff,
  Cake,
  Calendar,
  Bell,
  ArrowRight,
  Settings,
  LogOut,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { formatDateForInput } from '@/lib/utils';
import { useMetaTags } from '@/hooks/useMetaTags';
import { formatBirthdayLabel, formatTenure } from '@/lib/profile';
import ProfileDashboardHero from '@/components/dashboard/ProfileDashboardHero';
import ProfileAboutCard from '@/components/dashboard/ProfileAboutCard';

function buildProfileForm(user) {
  return {
    name: user?.name || '',
    full_name: user?.full_name || '',
    email: user?.email || '',
    date_of_birth: formatDateForInput(user?.date_of_birth),
    joined_at: formatDateForInput(user?.joined_at),
  };
}

function profileFormIsDirty(form, user) {
  if (!user) return false;

  return (
    form.full_name !== (user.full_name || '') ||
    form.date_of_birth !== formatDateForInput(user.date_of_birth) ||
    form.joined_at !== formatDateForInput(user.joined_at)
  );
}

export default function Profile() {
  const { user: authUser, checkUserAuth, logout } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const activeTab = searchParams.get('tab') === 'security' ? 'security' : 'profile';

  const { data: user } = useQuery({
    queryKey: ['current-user'],
    queryFn: () => db.auth.me(),
    initialData: authUser ?? undefined,
    staleTime: 0,
    refetchOnMount: 'always',
    retry: false,
  });

  const [profileForm, setProfileForm] = useState(() => buildProfileForm(authUser));
  const [profileSaving, setProfileSaving] = useState(false);

  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    new_password_confirmation: '',
  });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    if (user) {
      setProfileForm(buildProfileForm(user));
    }
  }, [user?.id, user?.full_name, user?.date_of_birth, user?.joined_at]);

  useMetaTags({
    title: `${user?.full_name || 'Profile'} - EMZI Nexus Brain`,
    description: 'Manage your personal information and account security',
  });

  const today = formatDateForInput(new Date());
  const isDirty = useMemo(() => profileFormIsDirty(profileForm, user), [profileForm, user]);
  const birthdayPreview = formatBirthdayLabel(profileForm.date_of_birth);
  const tenurePreview = formatTenure(profileForm.joined_at);

  const refreshUser = () => {
    queryClient.invalidateQueries({ queryKey: ['current-user'] });
    checkUserAuth();
  };

  const handleTabChange = (value) => {
    if (value === 'security') {
      setSearchParams({ tab: 'security' });
      return;
    }
    setSearchParams({});
  };

  const handleProfileSave = async (e) => {
    e.preventDefault();
    setProfileSaving(true);
    try {
      await db.auth.updateMe({
        name: profileForm.name,
        full_name: profileForm.full_name,
        date_of_birth: profileForm.date_of_birth || null,
        joined_at: profileForm.joined_at || null,
      });
      await refreshUser();
      toast.success('Profile updated successfully.');
    } catch (err) {
      toast.error(err?.message || 'Failed to update profile.');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleProfileReset = () => {
    setProfileForm(buildProfileForm(user));
  };

  const handlePasswordSave = async (e) => {
    e.preventDefault();
    if (passwordForm.new_password !== passwordForm.new_password_confirmation) {
      toast.error('New passwords do not match.');
      return;
    }
    if (passwordForm.new_password.length < 8) {
      toast.error('Password must be at least 8 characters.');
      return;
    }
    setPasswordSaving(true);
    try {
      await db.auth.updateMe({
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password,
        new_password_confirmation: passwordForm.new_password_confirmation,
      });
      setPasswordForm({ current_password: '', new_password: '', new_password_confirmation: '' });
      toast.success('Password changed successfully.');
    } catch (err) {
      const msg = err?.data?.errors?.current_password?.[0] || err?.message || 'Failed to change password.';
      toast.error(msg);
    } finally {
      setPasswordSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <ProfileDashboardHero user={user} onUserUpdated={refreshUser} />

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="max-xl:contents xl:col-span-4 xl:flex xl:flex-col xl:gap-6">
          <div className="order-2 xl:order-none">
            <ProfileAboutCard user={user} showCompleteLink={false} showChecklist />
          </div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className="order-3 xl:order-none"
          >
            <Card className="rounded-2xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Settings className="w-4 h-4 text-primary" />
                  More settings
                </CardTitle>
                <CardDescription className="text-xs">
                  Notification preferences and app settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Link to="/settings" className="block">
                  <Button variant="outline" size="sm" className="w-full justify-between h-9 text-xs">
                    <span className="flex items-center gap-2">
                      <Bell className="w-3.5 h-3.5" />
                      Notifications & preferences
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="order-4 xl:order-none"
          >
            <Card className="rounded-2xl border-destructive/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2 text-destructive">
                  <LogOut className="w-4 h-4" />
                  Sign out
                </CardTitle>
                <CardDescription className="text-xs">
                  End your session on this device
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full h-9 text-xs text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => logout()}
                >
                  <LogOut className="w-3.5 h-3.5 mr-2" />
                  Sign out
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        <div className="max-xl:contents xl:col-span-8">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="order-1 xl:order-none"
          >
            <Tabs value={activeTab} onValueChange={handleTabChange}>
              <TabsList className="h-10 w-full sm:w-auto">
                <TabsTrigger value="profile" className="gap-2 flex-1 sm:flex-none">
                  <User className="w-4 h-4" />
                  Profile
                </TabsTrigger>
                <TabsTrigger value="security" className="gap-2 flex-1 sm:flex-none">
                  <Lock className="w-4 h-4" />
                  Security
                </TabsTrigger>
              </TabsList>

              <TabsContent value="profile" className="mt-4 space-y-4">
                <Card className="rounded-2xl">
                  <CardHeader>
                    <CardTitle className="text-base">Personal Information</CardTitle>
                    <CardDescription>
                      Update your name and dates used for celebrations on the dashboard. Photos can be changed in the banner above.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleProfileSave} className="space-y-5">
                      <div className="space-y-1.5">
                        <Label htmlFor="full_name">Full Name</Label>
                        <Input
                          id="full_name"
                          value={profileForm.full_name}
                          onChange={(e) =>
                            setProfileForm((p) => ({ ...p, full_name: e.target.value, name: e.target.value }))
                          }
                          placeholder="Your full name"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="email" className="flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                          Email Address
                        </Label>
                        <Input
                          id="email"
                          value={profileForm.email}
                          readOnly
                          disabled
                          className="bg-muted/50 cursor-not-allowed"
                        />
                        <p className="text-xs text-muted-foreground">
                          Contact an administrator to change your email address.
                        </p>
                      </div>

                      <Separator />

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label htmlFor="date_of_birth" className="flex items-center gap-1.5">
                            <Cake className="w-3.5 h-3.5 text-muted-foreground" />
                            Date of Birth
                          </Label>
                          <Input
                            id="date_of_birth"
                            type="date"
                            max={today}
                            value={profileForm.date_of_birth}
                            onChange={(e) => setProfileForm((p) => ({ ...p, date_of_birth: e.target.value }))}
                          />
                          {birthdayPreview ? (
                            <p className="text-xs text-muted-foreground">
                              Shown as {birthdayPreview} on the dashboard
                            </p>
                          ) : (
                            <p className="text-xs text-muted-foreground">Used for birthday celebrations</p>
                          )}
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor="joined_at" className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                            Joined Date
                          </Label>
                          <Input
                            id="joined_at"
                            type="date"
                            max={today}
                            value={profileForm.joined_at}
                            onChange={(e) => setProfileForm((p) => ({ ...p, joined_at: e.target.value }))}
                          />
                          {tenurePreview ? (
                            <p className="text-xs text-muted-foreground">
                              {tenurePreview} with the team
                            </p>
                          ) : (
                            <p className="text-xs text-muted-foreground">Used for service anniversaries</p>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
                        {isDirty ? (
                          <Button type="button" variant="ghost" onClick={handleProfileReset} disabled={profileSaving}>
                            Discard changes
                          </Button>
                        ) : null}
                        <Button type="submit" disabled={profileSaving || !isDirty}>
                          {profileSaving ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <Save className="w-4 h-4 mr-2" />
                          )}
                          {isDirty ? 'Save Changes' : 'Saved'}
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="security" className="mt-4 space-y-4">
                <Card className="rounded-2xl">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Lock className="w-4 h-4" />
                      Change Password
                    </CardTitle>
                    <CardDescription>Enter your current password, then choose a new one.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handlePasswordSave} className="space-y-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="current_password">Current Password</Label>
                        <div className="relative">
                          <Input
                            id="current_password"
                            type={showCurrent ? 'text' : 'password'}
                            value={passwordForm.current_password}
                            onChange={(e) => setPasswordForm((p) => ({ ...p, current_password: e.target.value }))}
                            placeholder="Enter current password"
                            required
                            className="pr-10"
                            autoComplete="current-password"
                          />
                          <button
                            type="button"
                            onClick={() => setShowCurrent((v) => !v)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            aria-label={showCurrent ? 'Hide password' : 'Show password'}
                          >
                            {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      <Separator />

                      <div className="space-y-1.5">
                        <Label htmlFor="new_password">New Password</Label>
                        <div className="relative">
                          <Input
                            id="new_password"
                            type={showNew ? 'text' : 'password'}
                            value={passwordForm.new_password}
                            onChange={(e) => setPasswordForm((p) => ({ ...p, new_password: e.target.value }))}
                            placeholder="At least 8 characters"
                            required
                            minLength={8}
                            className="pr-10"
                            autoComplete="new-password"
                          />
                          <button
                            type="button"
                            onClick={() => setShowNew((v) => !v)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            aria-label={showNew ? 'Hide password' : 'Show password'}
                          >
                            {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="new_password_confirmation">Confirm New Password</Label>
                        <div className="relative">
                          <Input
                            id="new_password_confirmation"
                            type={showConfirm ? 'text' : 'password'}
                            value={passwordForm.new_password_confirmation}
                            onChange={(e) =>
                              setPasswordForm((p) => ({ ...p, new_password_confirmation: e.target.value }))
                            }
                            placeholder="Repeat new password"
                            required
                            minLength={8}
                            className="pr-10"
                            autoComplete="new-password"
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirm((v) => !v)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            aria-label={showConfirm ? 'Hide password' : 'Show password'}
                          >
                            {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      <div className="flex justify-end pt-2">
                        <Button type="submit" disabled={passwordSaving}>
                          {passwordSaving ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <Lock className="w-4 h-4 mr-2" />
                          )}
                          Change Password
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
