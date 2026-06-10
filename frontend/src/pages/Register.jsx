import db from '@/api/base44Client';
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/lib/AuthContext';

export default function Register() {
  const navigate = useNavigate();
  const { appPublicSettings } = useAuth();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const appName = appPublicSettings?.system_name || 'EMZI Nexus Brain';

  const handleSubmit = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    const password = String(form.get('password') || '');
    const passwordConfirmation = String(form.get('password_confirmation') || '');

    if (password !== passwordConfirmation) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await db.auth.register({
        full_name: form.get('full_name'),
        email: form.get('email'),
        password,
      });
      setSuccess('Registration submitted. Waiting for admin approval…');
      setTimeout(() => navigate('/login?status=pending_approval', { replace: true }), 1200);
    } catch (err) {
      setError(err?.data?.message || err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const EyeIcon = ({ open }) => open ? (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  ) : (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );

  return (
    <div className="flex h-dvh min-h-dvh overflow-hidden">
      {/* Desktop: Left branding panel */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-[hsl(206,92%,15%)] flex-col justify-between p-12">
        <div className="absolute inset-0 bg-gradient-to-br from-[hsl(206,92%,25%)] via-[hsl(206,92%,20%)] to-[hsl(206,92%,10%)]" />
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full border border-white/5" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full border border-white/5" />

        {/* Logo */}
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <img src="/icons/logo.png" alt="Logo" className="w-9 h-9 rounded-xl" />
            <span className="text-white font-semibold text-lg tracking-tight">{appName}</span>
          </div>
        </div>

        {/* Center content */}
        <div className="relative z-10 space-y-6">
          <div className="space-y-3">
            <h1 className="text-4xl font-bold leading-tight">
              <span className="text-white">Get started </span>
              <br />
              <span className="bg-gradient-to-r from-white to-white bg-clip-text text-transparent">in </span>
              <span className="bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">minutes.</span>
            </h1>
            <p className="text-white/60 text-base leading-relaxed max-w-xs">
              Create your account and request access. An admin will review and approve your registration.
            </p>
          </div>
          <div className="space-y-3">
            {[
              { icon: '✓', text: 'Secure, role-based access control' },
              { icon: '✓', text: 'Connect to multiple systems' },
              { icon: '✓', text: 'Full audit trail & activity logs' },
            ].map(({ icon, text }) => (
              <div key={text} className="flex items-center gap-3">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/30 flex items-center justify-center text-white text-xs">{icon}</span>
                <span className="text-white/70 text-sm">{text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom */}
        <div className="relative z-10">
          <p className="text-white/30 text-xs">© 2026 {appName}. All rights reserved.</p>
        </div>
      </div>

      {/* Desktop: Right form panel | Mobile/Tablet: Full screen with blue background */}
      <div className="flex-1 flex flex-col items-center justify-between lg:justify-center lg:bg-background bg-[hsl(206,92%,15%)] px-6 py-8 lg:py-12 relative overflow-y-auto">
        {/* Mobile/Tablet: Gradient overlay for depth */}
        <div className="absolute inset-0 lg:hidden bg-gradient-to-br from-[hsl(206,92%,20%)] via-[hsl(206,92%,15%)] to-[hsl(206,92%,10%)]" />

        {/* Mobile/Tablet: Logo at top */}
        <div className="relative z-10 flex flex-col items-center gap-2 lg:hidden mb-8">
          <img src="/icons/banner.png" alt="Logo" className="w-full" />
        </div>

        {/* Card container for mobile/tablet */}
        <div className="relative z-10 w-full max-w-sm lg:space-y-8 lg:bg-background flex-1 lg:flex-none flex flex-col justify-center">

          {/* Desktop: Logo */}
          <div className="hidden lg:flex items-center gap-3">
            <img src="/icons/logo.png" alt="Logo" className="w-8 h-8 rounded-xl" />
            <span className="font-semibold text-foreground text-lg">{appName}</span>
          </div>

          {/* Mobile/Tablet: White card container */}
          <div className="lg:hidden bg-white rounded-3xl p-8 space-y-6 shadow-2xl">

            {/* Header */}
            <div className="space-y-2 text-center">
              <h2 className="text-3xl font-bold tracking-tight">
                <span className="bg-gradient-to-r from-foreground to-foreground bg-clip-text text-transparent">Create account</span>
              </h2>
              <p className="text-muted-foreground text-sm">Join your workspace</p>
            </div>

            {/* Banners */}
            {error && (
              <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3">
                <svg className="w-4 h-4 text-destructive mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                </svg>
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}
            {success && (
              <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-800/40 dark:bg-emerald-900/20">
                <svg className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                </svg>
                <p className="text-sm text-emerald-700 dark:text-emerald-400">{success}</p>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="full_name" className="text-sm font-medium">Full name</Label>
                <Input
                  id="full_name"
                  name="full_name"
                  autoComplete="name"
                  placeholder="Jane Smith"
                  required
                  className="h-12 bg-background border-border/80 text-foreground placeholder:text-muted-foreground/50 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">Email address</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  required
                  className="h-12 bg-background border-border/80 text-foreground placeholder:text-muted-foreground/50 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="Min. 8 characters"
                    minLength={8}
                    required
                    className="h-12 pr-10 bg-background border-border/80 text-foreground placeholder:text-muted-foreground/50 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                  />
                  <button type="button" onClick={() => setShowPassword(v => !v)} tabIndex={-1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}>
                    <EyeIcon open={showPassword} />
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password_confirmation" className="text-sm font-medium">Confirm password</Label>
                <div className="relative">
                  <Input
                    id="password_confirmation"
                    name="password_confirmation"
                    type={showConfirm ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="Repeat your password"
                    minLength={8}
                    required
                    className="h-12 pr-10 bg-background border-border/80 text-foreground placeholder:text-muted-foreground/50 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                  />
                  <button type="button" onClick={() => setShowConfirm(v => !v)} tabIndex={-1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={showConfirm ? 'Hide password' : 'Show password'}>
                    <EyeIcon open={showConfirm} />
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-12 font-semibold text-base shadow-md shadow-primary/20 bg-primary text-white hover:bg-primary/90 hover:shadow-primary/30 transition-all"
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                    </svg>
                    Creating…
                  </span>
                ) : 'Create Account'}
              </Button>
            </form>

            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link to="/login" className="text-primary font-medium hover:text-primary/80 transition-colors">Sign in</Link>
            </p>
          </div>

          {/* Desktop layout continues below */}
          <div className="hidden lg:block space-y-8">
            {/* Header */}
            <div className="space-y-1">
              <h2 className="text-2xl font-bold tracking-tight">
                <span className="text-foreground">Create an </span>
                <span className="bg-gradient-to-r from-amber-600 to-orange-500 bg-clip-text text-transparent">account</span>
              </h2>
              <p className="text-muted-foreground text-sm">Fill in your details to request access</p>
            </div>

            {/* Banners */}
            {error && (
              <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3">
                <svg className="w-4 h-4 text-destructive mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                </svg>
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}
            {success && (
              <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-800/40 dark:bg-emerald-900/20">
                <svg className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                </svg>
                <p className="text-sm text-emerald-700 dark:text-emerald-400">{success}</p>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="full_name" className="text-sm font-medium">Full name</Label>
                <Input
                  id="full_name"
                  name="full_name"
                  autoComplete="name"
                  placeholder="Jane Smith"
                  required
                  className="h-11 bg-background border-border/80 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors placeholder:text-muted-foreground/50"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-sm font-medium">Email address</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  required
                  className="h-11 bg-background border-border/80 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors placeholder:text-muted-foreground/50"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="Min. 8 characters"
                    minLength={8}
                    required
                    className="h-11 pr-10 bg-background border-border/80 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors placeholder:text-muted-foreground/50"
                  />
                  <button type="button" onClick={() => setShowPassword(v => !v)} tabIndex={-1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}>
                    <EyeIcon open={showPassword} />
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password_confirmation" className="text-sm font-medium">Confirm password</Label>
                <div className="relative">
                  <Input
                    id="password_confirmation"
                    name="password_confirmation"
                    type={showConfirm ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="Repeat your password"
                    minLength={8}
                    required
                    className="h-11 pr-10 bg-background border-border/80 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors placeholder:text-muted-foreground/50"
                  />
                  <button type="button" onClick={() => setShowConfirm(v => !v)} tabIndex={-1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={showConfirm ? 'Hide password' : 'Show password'}>
                    <EyeIcon open={showConfirm} />
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-11 font-semibold text-sm shadow-md shadow-primary/20 hover:shadow-primary/30 transition-all"
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                    </svg>
                    Creating account…
                  </span>
                ) : 'Create account'}
              </Button>
            </form>

            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link to="/login" className="text-primary font-medium hover:text-primary/80 transition-colors">Sign in</Link>
            </p>
          </div>
        </div>

        {/* Mobile/Tablet: Bottom text */}
        <div className="relative z-10 text-center lg:hidden mt-8">
          <p className="text-white/50 text-xs">A Member of EMZI Group</p>
        </div>
      </div>
    </div>
  );
}
