// @ts-nocheck
import db from '@/api/base44Client';
import React, { useState } from 'react';
import { Lock, Loader2, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { useAuth } from '@/lib/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function ForcedPasswordChange() {
  const { user, checkUserAuth, logout } = useAuth();
  const navigate = useNavigate();
  
  const [passwordForm, setPasswordForm] = useState({
    new_password: '',
    new_password_confirmation: '',
  });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

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
        new_password: passwordForm.new_password,
        new_password_confirmation: passwordForm.new_password_confirmation,
      });
      setPasswordForm({ new_password: '', new_password_confirmation: '' });
      toast.success('Password changed successfully! Redirecting...');
      
      // Refresh user auth to clear the force_password_change flag
      await checkUserAuth();
      
      // Navigate to dashboard immediately after auth is refreshed
      navigate('/', { replace: true });
    } catch (err) {
      const msg = err?.message || 'Failed to change password.';
      toast.error(msg);
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleLogout = () => {
    logout(true);
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-md"
      >
        <Card className="border-primary/20 shadow-lg">
          <CardHeader className="text-center pb-3">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Lock className="w-6 h-6 text-primary" />
            </div>
            <CardTitle className="text-2xl">Set Your Password</CardTitle>
            <CardDescription className="text-base mt-2">
              This is your first login. Please create a strong password to secure your account.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Alert */}
            <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950 dark:border-amber-900">
              <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <AlertDescription className="text-amber-900 dark:text-amber-200 ml-2">
                You must set a password before continuing to the application.
              </AlertDescription>
            </Alert>

            {/* User Info */}
            <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-3">
              <p className="text-xs text-muted-foreground mb-1">Account Email</p>
              <p className="font-medium">{user?.email}</p>
            </div>

            {/* Password Form */}
            <form onSubmit={handlePasswordSave} className="space-y-4">
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
                    autoFocus
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Use a combination of uppercase, lowercase, numbers, and symbols for better security.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="new_password_confirmation">Confirm Password</Label>
                <div className="relative">
                  <Input
                    id="new_password_confirmation"
                    type={showConfirm ? 'text' : 'password'}
                    value={passwordForm.new_password_confirmation}
                    onChange={(e) => setPasswordForm((p) => ({ ...p, new_password_confirmation: e.target.value }))}
                    placeholder="Repeat new password"
                    required
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Separator className="my-4" />

              <Button type="submit" disabled={passwordSaving} className="w-full" size="lg">
                {passwordSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Setting Password...
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4 mr-2" />
                    Continue to Dashboard
                  </>
                )}
              </Button>

              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleLogout}
                disabled={passwordSaving}
              >
                Logout
              </Button>
            </form>

            <p className="text-xs text-center text-muted-foreground">
              Your password must be at least 8 characters long.
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
