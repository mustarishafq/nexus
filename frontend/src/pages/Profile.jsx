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
  Briefcase,
  Sparkles,
  Phone,
  GraduationCap,
  HeartPulse,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { formatDateForInput } from '@/lib/utils';
import { useMetaTags } from '@/hooks/useMetaTags';
import {
  formatBirthdayLabel,
  formatTenure,
  getDisplayName,
  normalizeSkills,
  skillsAreEqual,
  normalizeEducationHistory,
  normalizeWorkHistory,
  educationHistoryIsEqual,
  workHistoryIsEqual,
  buildHrProfileForm,
  buildHrProfilePayload,
  hrProfileFormIsDirty,
} from '@/lib/profile';
import ProfileDashboardHero from '@/components/dashboard/ProfileDashboardHero';
import ProfileAboutCard from '@/components/dashboard/ProfileAboutCard';
import DepartmentCombobox from '@/components/profile/DepartmentCombobox';
import TagInput from '@/components/profile/TagInput';
import ProfileHistoryEditor from '@/components/profile/ProfileHistoryEditor';
import ProfileHrDetailsForm from '@/components/profile/ProfileHrDetailsForm';
import PhoneInput from '@/components/profile/PhoneInput';
import { normalizePhoneNumber } from '@/lib/phone';

const EDUCATION_FIELDS = [
  { key: 'institution', label: 'Institution', placeholder: 'e.g. University of Malaya' },
  { key: 'qualification', label: 'Qualification', placeholder: 'e.g. Bachelor of Business' },
  { key: 'field_of_study', label: 'Field of study', placeholder: 'e.g. Finance' },
  { key: 'year_from', label: 'From', placeholder: 'e.g. 2016' },
  { key: 'year_to', label: 'To', placeholder: 'e.g. 2020' },
];

const WORK_HISTORY_FIELDS = [
  { key: 'company', label: 'Company', placeholder: 'e.g. ABC Holdings' },
  { key: 'job_title', label: 'Role', placeholder: 'e.g. Accounts Executive' },
  { key: 'date_from', label: 'From', placeholder: 'e.g. 2020-03' },
  { key: 'date_to', label: 'To', placeholder: 'e.g. 2023-12' },
  { key: 'description', label: 'Description', placeholder: 'Optional summary', type: 'textarea', fullWidth: true },
];

const PROFILE_SECTIONS = ['about', 'contact', 'background', 'private'];

function buildProfileForm(user) {
  return {
    name: user?.name || '',
    full_name: user?.full_name || '',
    email: user?.email || '',
    bio: user?.bio || '',
    department_id: user?.department_id ?? null,
    department_name: user?.department || '',
    skills: normalizeSkills(user?.skills),
    ask_me_about: user?.ask_me_about || '',
    date_of_birth: formatDateForInput(user?.date_of_birth),
    joined_at: formatDateForInput(user?.joined_at),
    work_phone: user?.work_phone || '',
    personal_phone: user?.personal_phone || '',
    personal_phone_visible: Boolean(user?.personal_phone_visible),
    education_history: normalizeEducationHistory(user?.education_history),
    work_history: normalizeWorkHistory(user?.work_history),
    ...buildHrProfileForm(user),
  };
}

function profileFormIsDirty(form, user) {
  if (!user) return false;

  return (
    form.name !== (user.name || '') ||
    form.full_name !== (user.full_name || '') ||
    form.bio !== (user.bio || '') ||
    form.department_id !== (user.department_id ?? null) ||
    !skillsAreEqual(form.skills, user.skills) ||
    form.ask_me_about !== (user.ask_me_about || '') ||
    form.date_of_birth !== formatDateForInput(user.date_of_birth) ||
    form.joined_at !== formatDateForInput(user.joined_at) ||
    form.work_phone !== (user.work_phone || '') ||
    form.personal_phone !== (user.personal_phone || '') ||
    form.personal_phone_visible !== Boolean(user.personal_phone_visible) ||
    !educationHistoryIsEqual(form.education_history, user.education_history) ||
    !workHistoryIsEqual(form.work_history, user.work_history) ||
    hrProfileFormIsDirty(form, user)
  );
}

export default function Profile() {
  const { user: authUser, checkUserAuth, logout } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const activeTab = searchParams.get('tab') === 'security' ? 'security' : 'profile';
  const sectionParam = searchParams.get('section');
  const profileSection = PROFILE_SECTIONS.includes(sectionParam) ? sectionParam : 'about';

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
  }, [user]);

  useMetaTags({
    title: `${getDisplayName(user, 'Profile')} - EMZI Nexus Brain`,
    description: 'Manage your personal information and account security',
  });

  const today = formatDateForInput(new Date());
  const isDirty = useMemo(() => profileFormIsDirty(profileForm, user), [profileForm, user]);
  const birthdayPreview = formatBirthdayLabel(profileForm.date_of_birth);
  const tenurePreview = formatTenure(profileForm.joined_at);

  const refreshUser = async (updatedUser) => {
    if (updatedUser) {
      queryClient.setQueryData(['current-user'], updatedUser);
    }
    await checkUserAuth();
    await queryClient.refetchQueries({ queryKey: ['current-user'] });
    queryClient.invalidateQueries({ queryKey: ['people-directory'] });
    queryClient.invalidateQueries({ queryKey: ['org-chart'] });
  };

  const handleTabChange = (value) => {
    const next = new URLSearchParams(searchParams);
    if (value === 'security') {
      next.set('tab', 'security');
    } else {
      next.delete('tab');
    }
    setSearchParams(next, { replace: true });
  };

  const handleProfileSectionChange = (value) => {
    const next = new URLSearchParams(searchParams);
    next.delete('tab');
    if (value === 'about') {
      next.delete('section');
    } else {
      next.set('section', value);
    }
    setSearchParams(next, { replace: true });
  };

  const handleProfileSave = async (e) => {
    e.preventDefault();
    setProfileSaving(true);
    try {
      const updatedUser = await db.auth.updateMe({
        name: profileForm.name,
        full_name: profileForm.full_name,
        bio: profileForm.bio.trim() || null,
        department_id: profileForm.department_id,
        skills: profileForm.skills,
        ask_me_about: profileForm.ask_me_about.trim() || null,
        date_of_birth: profileForm.date_of_birth || null,
        joined_at: profileForm.joined_at || null,
        work_phone: normalizePhoneNumber(profileForm.work_phone) || null,
        personal_phone: normalizePhoneNumber(profileForm.personal_phone) || null,
        personal_phone_visible: profileForm.personal_phone_visible,
        education_history: normalizeEducationHistory(profileForm.education_history),
        work_history: normalizeWorkHistory(profileForm.work_history),
        ...buildHrProfilePayload(profileForm),
      });
      await refreshUser(updatedUser);
      setProfileForm(buildProfileForm(updatedUser));
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
            <ProfileAboutCard user={user} showCompleteLink={false} showChecklist isOwnProfile />
          </div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.06 }}
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
            transition={{ delay: 0.08 }}
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
                    <CardTitle className="text-base">Edit profile</CardTitle>
                    <CardDescription>
                      Switch sections below to focus on one area at a time. One save applies to all sections. Photos can be changed in the banner above.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Tabs value={profileSection} onValueChange={handleProfileSectionChange}>
                      <TabsList className="mb-5 h-auto w-full flex flex-wrap gap-1 bg-muted/40 p-1">
                        <TabsTrigger value="about" className="flex-1 min-w-[5.5rem] gap-1.5 text-xs sm:text-sm">
                          <User className="w-3.5 h-3.5" />
                          About
                        </TabsTrigger>
                        <TabsTrigger value="contact" className="flex-1 min-w-[5.5rem] gap-1.5 text-xs sm:text-sm">
                          <Phone className="w-3.5 h-3.5" />
                          Contact
                        </TabsTrigger>
                        <TabsTrigger value="background" className="flex-1 min-w-[5.5rem] gap-1.5 text-xs sm:text-sm">
                          <GraduationCap className="w-3.5 h-3.5" />
                          Background
                        </TabsTrigger>
                        <TabsTrigger value="private" className="flex-1 min-w-[5.5rem] gap-1.5 text-xs sm:text-sm">
                          <HeartPulse className="w-3.5 h-3.5" />
                          HR & private
                        </TabsTrigger>
                      </TabsList>

                      <form onSubmit={handleProfileSave} className="space-y-5">
                        <TabsContent value="about" className="mt-0 space-y-5">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                              <Label htmlFor="full_name">Full Name</Label>
                              <Input
                                id="full_name"
                                value={profileForm.full_name}
                                onChange={(e) => setProfileForm((p) => ({ ...p, full_name: e.target.value }))}
                                placeholder="Your full name"
                              />
                              <p className="text-xs text-muted-foreground">Legal name. Visible to admins in user management.</p>
                            </div>

                            <div className="space-y-1.5">
                              <Label htmlFor="name">Display Name</Label>
                              <Input
                                id="name"
                                value={profileForm.name}
                                onChange={(e) => setProfileForm((p) => ({ ...p, name: e.target.value }))}
                                placeholder="e.g. Alex"
                              />
                              <p className="text-xs text-muted-foreground">Shown in Nexus and sent to connected apps via SSO.</p>
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <Label htmlFor="bio">Bio</Label>
                            <Textarea
                              id="bio"
                              value={profileForm.bio}
                              onChange={(e) => setProfileForm((p) => ({ ...p, bio: e.target.value }))}
                              placeholder="Tell colleagues a little about yourself..."
                              rows={4}
                              maxLength={500}
                            />
                            <p className="text-xs text-muted-foreground">{profileForm.bio.length}/500 characters</p>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="department" className="flex items-center gap-1.5">
                              <Briefcase className="w-3.5 h-3.5 text-muted-foreground" />
                              Department
                            </Label>
                            <DepartmentCombobox
                              id="department"
                              value={profileForm.department_id}
                              label={profileForm.department_name}
                              onChange={(departmentId, departmentName = '') =>
                                setProfileForm((p) => ({
                                  ...p,
                                  department_id: departmentId,
                                  department_name: departmentName,
                                }))
                              }
                            />
                          </div>

                          <div className="space-y-1.5">
                            <Label htmlFor="skills" className="flex items-center gap-1.5">
                              <Sparkles className="w-3.5 h-3.5 text-muted-foreground" />
                              Skills & interests
                            </Label>
                            <TagInput
                              id="skills"
                              value={profileForm.skills}
                              onChange={(skills) => setProfileForm((p) => ({ ...p, skills }))}
                              placeholder="Add a skill or interest"
                              maxTags={10}
                              maxLength={50}
                            />
                            <p className="text-xs text-muted-foreground">Press Enter to add each tag (up to 10).</p>
                          </div>

                          <div className="space-y-1.5">
                            <Label htmlFor="ask_me_about">Ask me about</Label>
                            <Input
                              id="ask_me_about"
                              value={profileForm.ask_me_about}
                              onChange={(e) => setProfileForm((p) => ({ ...p, ask_me_about: e.target.value }))}
                              placeholder="e.g. onboarding, CRM workflows, team events"
                              maxLength={200}
                            />
                          </div>

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
                        </TabsContent>

                        <TabsContent value="contact" className="mt-0 space-y-5">
                          <div>
                            <h3 className="text-sm font-medium flex items-center gap-2">
                              <Phone className="w-4 h-4 text-primary" />
                              Phone numbers
                            </h3>
                            <p className="text-xs text-muted-foreground mt-1">
                              Add work and personal numbers for colleagues to reach you.
                            </p>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                              <Label htmlFor="work_phone">Work phone</Label>
                              <PhoneInput
                                id="work_phone"
                                value={profileForm.work_phone}
                                onChange={(value) => setProfileForm((p) => ({ ...p, work_phone: value }))}
                                placeholder="e.g. +60 19-270 4323"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label htmlFor="personal_phone">Personal phone</Label>
                              <PhoneInput
                                id="personal_phone"
                                value={profileForm.personal_phone}
                                onChange={(value) => setProfileForm((p) => ({ ...p, personal_phone: value }))}
                                placeholder="e.g. +60 12-345 6789"
                              />
                            </div>
                          </div>

                          <div className="flex items-center justify-between gap-3 rounded-xl border border-border/80 bg-muted/20 px-4 py-3">
                            <div>
                              <p className="text-sm font-medium">Show personal phone on profile</p>
                              <p className="text-xs text-muted-foreground">
                                Colleagues can only see your personal number when this is enabled.
                              </p>
                            </div>
                            <Switch
                              checked={profileForm.personal_phone_visible}
                              onCheckedChange={(checked) =>
                                setProfileForm((p) => ({ ...p, personal_phone_visible: checked }))
                              }
                            />
                          </div>

                          {user?.job_title || user?.manager || user?.employee_id || user?.employment_type ? (
                            <div className="rounded-xl border border-border/80 bg-muted/20 p-4 space-y-3">
                              <p className="text-sm font-medium">Work details (managed by admin)</p>
                              {user?.job_title ? (
                                <div>
                                  <p className="text-xs text-muted-foreground">Job title</p>
                                  <p className="text-sm font-medium">{user.job_title}</p>
                                </div>
                              ) : null}
                              {user?.manager ? (
                                <div>
                                  <p className="text-xs text-muted-foreground">Reports to</p>
                                  <p className="text-sm font-medium">{user.manager.name}</p>
                                </div>
                              ) : null}
                              {user?.employee_id ? (
                                <div>
                                  <p className="text-xs text-muted-foreground">Employee ID</p>
                                  <p className="text-sm font-medium">{user.employee_id}</p>
                                </div>
                              ) : null}
                              {user?.employment_type ? (
                                <div>
                                  <p className="text-xs text-muted-foreground">Employment type</p>
                                  <p className="text-sm font-medium capitalize">{user.employment_type.replace('_', ' ')}</p>
                                </div>
                              ) : null}
                            </div>
                          ) : null}

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
                        </TabsContent>

                        <TabsContent value="background" className="mt-0 space-y-5">
                          <ProfileHistoryEditor
                            label="Education history"
                            description="List schools, certifications, or qualifications."
                            value={profileForm.education_history}
                            onChange={(education_history) => setProfileForm((p) => ({ ...p, education_history }))}
                            fields={EDUCATION_FIELDS}
                            addLabel="Add education"
                          />

                          <ProfileHistoryEditor
                            label="Work history"
                            description="Add past companies and roles."
                            value={profileForm.work_history}
                            onChange={(work_history) => setProfileForm((p) => ({ ...p, work_history }))}
                            fields={WORK_HISTORY_FIELDS}
                            maxItems={15}
                            addLabel="Add experience"
                          />
                        </TabsContent>

                        <TabsContent value="private" className="mt-0 space-y-5">
                          <ProfileHrDetailsForm
                            value={profileForm}
                            onChange={(next) => setProfileForm((prev) => ({ ...prev, ...next }))}
                          />
                        </TabsContent>

                        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 border-t border-border/80 pt-4">
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
                    </Tabs>
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
