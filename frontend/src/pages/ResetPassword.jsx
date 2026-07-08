import db from '@/api/apiClient';
import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/lib/AuthContext';

export default function ResetPassword() {
  const { appPublicSettings } = useAuth();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const appName = appPublicSettings?.system_name || 'EMZI Nexus Brain';

  const token = searchParams.get('token') || '';
  const email = searchParams.get('email') || '';

  const handleSubmit = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    if (!token || !email) {
      setError('This reset link is invalid or incomplete. Request a new link from the forgot password page.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const payload = await db.auth.resetPassword({
        token,
        email,
        password: form.get('password'),
        password_confirmation: form.get('password_confirmation'),
      });
      setSuccess(payload?.message || 'Password has been reset. You can sign in now.');
    } catch (err) {
      setError(err?.data?.message || err.message || 'Unable to reset password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-[hsl(206,92%,15%)] flex-col justify-between p-12">
        <div className="absolute inset-0 bg-gradient-to-br from-[hsl(206,92%,25%)] via-[hsl(206,92%,20%)] to-[hsl(206,92%,10%)]" />
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-primary/10 blur-3xl" />

        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <img src="/icons/logo.png" alt="Logo" className="w-9 h-9 rounded-xl" />
            <span className="text-white font-semibold text-lg tracking-tight">{appName}</span>
          </div>
        </div>

        <div className="relative z-10 space-y-6">
          <div className="space-y-3">
            <h1 className="text-4xl font-bold leading-tight text-white">
              Choose a new password
            </h1>
            <p className="text-white/60 text-base leading-relaxed max-w-xs">
              Enter a strong password to finish resetting your account.
            </p>
          </div>
        </div>

        <div className="relative z-10">
          <p className="text-white/30 text-xs">© 2026 {appName}. All rights reserved.</p>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-between lg:justify-center lg:bg-background bg-[hsl(206,92%,15%)] px-6 py-8 lg:py-12 relative">
        <div className="absolute inset-0 lg:hidden bg-gradient-to-br from-[hsl(206,92%,20%)] via-[hsl(206,92%,15%)] to-[hsl(206,92%,10%)]" />

        <div className="relative z-10 w-full max-w-sm lg:space-y-8 lg:bg-background flex-1 lg:flex-none flex flex-col justify-center">
          <div className="hidden lg:flex items-center gap-3">
            <img src="/icons/logo.png" alt="Logo" className="w-8 h-8 rounded-xl" />
            <span className="font-semibold text-foreground text-lg">{appName}</span>
          </div>

          <div className="lg:hidden bg-white rounded-3xl p-8 space-y-6 shadow-2xl">
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors"
            >
              Back to sign in
            </Link>

            <div className="space-y-2 text-center">
              <h2 className="text-3xl font-bold tracking-tight">Set new password</h2>
              <p className="text-muted-foreground text-sm">Choose a password with at least 8 characters</p>
            </div>

            {error && (
              <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}
            {success && (
              <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                <p className="text-sm text-emerald-700">{success}</p>
              </div>
            )}

            {!success && (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="password">New password</Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    required
                    className="h-12"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password_confirmation">Confirm password</Label>
                  <Input
                    id="password_confirmation"
                    name="password_confirmation"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    required
                    className="h-12"
                  />
                </div>
                <Button type="submit" className="w-full h-12" disabled={loading || !token || !email}>
                  {loading ? 'Saving…' : 'Reset password'}
                </Button>
              </form>
            )}

            {success && (
              <Link to="/login" className="block text-center text-sm text-primary font-medium">
                Continue to sign in
              </Link>
            )}
          </div>

          <div className="hidden lg:block space-y-8">
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Back to sign in
            </Link>

            <div className="space-y-1">
              <h2 className="text-2xl font-bold tracking-tight">Set new password</h2>
              <p className="text-muted-foreground text-sm">Choose a password with at least 8 characters</p>
            </div>

            {error && (
              <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}
            {success && (
              <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-800/40 dark:bg-emerald-900/20">
                <p className="text-sm text-emerald-700 dark:text-emerald-400">{success}</p>
              </div>
            )}

            {!success && (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-1.5">
                  <Label htmlFor="password-desktop">New password</Label>
                  <Input
                    id="password-desktop"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    required
                    className="h-11"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password_confirmation-desktop">Confirm password</Label>
                  <Input
                    id="password_confirmation-desktop"
                    name="password_confirmation"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    required
                    className="h-11"
                  />
                </div>
                <Button type="submit" className="w-full h-11" disabled={loading || !token || !email}>
                  {loading ? 'Saving…' : 'Reset password'}
                </Button>
              </form>
            )}

            {success && (
              <Link to="/login" className="block text-center text-sm text-primary font-medium">
                Continue to sign in
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
