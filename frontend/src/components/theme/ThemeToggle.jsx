import React, { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

export function ThemeToggle({ variant = 'icon', className }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    if (variant === 'switch') {
      return <Switch disabled className={className} />;
    }

    return (
      <Button
        variant="ghost"
        size="icon"
        disabled
        className={cn('h-9 w-9', className)}
        aria-hidden
      />
    );
  }

  const isDark = resolvedTheme === 'dark';

  if (variant === 'switch') {
    return (
      <Switch
        checked={isDark}
        onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
        className={className}
        aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      />
    );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className={cn('h-9 w-9', className)}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </Button>
  );
}
