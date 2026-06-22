import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import db from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Moon } from 'lucide-react';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { cn } from '@/lib/utils';
import { glassDialogMutedText, glassDialogPanelStyles } from './glassStyles';
import { buildMobileMoreItems, matchMobileMorePath } from './navItems';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from '@/components/ui/sheet';

export default function MobileMoreMenu({ badgeCounts = {}, triggerIcon: TriggerIcon, label = 'More' }) {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const { user, appPublicSettings } = useAuth();

  const { data: metabaseDashboards = [] } = useQuery({
    queryKey: ['metabase-dashboards'],
    queryFn: () => db.entities.MetabaseDashboard.list('sort_order', 50),
    staleTime: 60_000,
  });

  const showAnalytics = user?.role === 'admin' || metabaseDashboards.length > 0;
  const isAdmin = user?.role === 'admin';
  const moreItems = buildMobileMoreItems({ showAnalytics, isAdmin });
  const adminItems = moreItems.filter((item) => item.path.startsWith('/admin/'));
  const regularItems = moreItems.filter((item) => !item.path.startsWith('/admin/'));
  const isActive = matchMobileMorePath(location.pathname, moreItems);

  const renderLink = (item) => {
    const isItemActive = item.match(location.pathname);
    const badgeCount = item.badge ? badgeCounts[item.badge] ?? 0 : 0;

    return (
      <Link
        key={item.path}
        to={item.path}
        onClick={() => setOpen(false)}
        className={cn(
          'relative flex flex-col items-center gap-2 rounded-xl px-2 py-3 transition-colors',
          isItemActive
            ? 'bg-primary/15 text-primary'
            : 'text-foreground hover:bg-foreground/5'
        )}
      >
        <span className="relative">
          <item.icon className="h-5 w-5 shrink-0" />
          {badgeCount > 0 && (
            <span className="absolute -right-2 -top-1.5 min-w-[16px] h-4 rounded-full bg-destructive px-1 text-[9px] font-bold leading-4 text-destructive-foreground text-center">
              {badgeCount > 99 ? '99+' : badgeCount}
            </span>
          )}
        </span>
        <span className="text-center text-[11px] font-medium leading-tight">{item.label}</span>
      </Link>
    );
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          className={cn(
            'relative flex flex-1 flex-col items-center justify-center gap-0.5 px-1 transition-colors',
            isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
          )}
          aria-label="Open more menu"
        >
          {isActive && (
            <span className="absolute top-0 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-primary" />
          )}
          {TriggerIcon ? <TriggerIcon className={cn('h-5 w-5', isActive && 'text-primary')} /> : null}
          <span className={cn('text-[10px] font-medium leading-none', isActive && 'text-primary')}>
            {label}
          </span>
        </button>
      </SheetTrigger>
      <SheetContent
        side="bottom"
        overlayClassName="bg-black/25 backdrop-blur-sm"
        className={cn(
          'flex max-h-[85dvh] flex-col rounded-t-2xl border-t p-0 pb-[env(safe-area-inset-bottom)]',
          glassDialogPanelStyles
        )}
      >
        <SheetHeader className="border-b border-border/50 px-4 py-4 text-left">
          <div className="flex items-center gap-3">
            <img src="/icons/logo.png" alt="Logo" className="h-9 w-9 shrink-0 rounded-xl" />
            <SheetTitle className="text-base font-bold tracking-tight">
              {appPublicSettings?.system_name || 'EMZI Nexus Brain'}
            </SheetTitle>
          </div>
        </SheetHeader>
        <nav className="flex-1 overflow-y-auto p-3">
          <div className="grid grid-cols-4 gap-1 sm:grid-cols-5">
            {regularItems.map(renderLink)}
          </div>
          {isAdmin && adminItems.length > 0 && (
            <>
              <p className={cn('px-1 pt-4 pb-2 text-xs font-semibold uppercase tracking-wide', glassDialogMutedText)}>
                Admin
              </p>
              <div className="grid grid-cols-4 gap-1 sm:grid-cols-5">
                {adminItems.map(renderLink)}
              </div>
            </>
          )}
        </nav>
        <div className="border-t border-border/50 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <Moon className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">Dark Mode</p>
                <p className={cn('text-xs', glassDialogMutedText)}>Light or dark theme</p>
              </div>
            </div>
            <ThemeToggle variant="switch" />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
