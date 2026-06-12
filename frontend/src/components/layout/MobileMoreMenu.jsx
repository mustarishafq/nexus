import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import {
  Activity, Calendar, Wifi, Settings, Megaphone, Shield, Users, Menu, Moon, Newspaper, Mail,
} from 'lucide-react';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { cn } from '@/lib/utils';
import { glassPanelStyles } from './glassStyles';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from '@/components/ui/sheet';

const MORE_ITEMS = [
  { path: '/people', icon: Users, label: 'People' },
  { path: '/feed', icon: Newspaper, label: 'Company Feed' },
  { path: '/messages', icon: Mail, label: 'Messages' },
  { path: '/activity', icon: Activity, label: 'Activity Feed' },
  { path: '/calendar', icon: Calendar, label: 'Calendar' },
  { path: '/network-health', icon: Wifi, label: 'Network Health' },
  { path: '/settings', icon: Settings, label: 'Settings' },
];

const ADMIN_ITEMS = [
  { path: '/admin/broadcast', icon: Megaphone, label: 'Broadcast' },
  { path: '/admin/events', icon: Shield, label: 'System Events' },
  { path: '/admin/users', icon: Users, label: 'User Management' },
];

export default function MobileMoreMenu() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const { user, appPublicSettings } = useAuth();
  const isAdmin = user?.role === 'admin';

  const renderLink = (item) => {
    const isActive = location.pathname === item.path;
    return (
      <Link
        key={item.path}
        to={item.path}
        onClick={() => setOpen(false)}
        className={cn(
          'flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors',
          isActive
            ? 'bg-primary/15 text-primary'
            : 'text-foreground hover:bg-foreground/5'
        )}
      >
        <item.icon className="h-5 w-5 shrink-0" />
        <span className="text-sm font-medium">{item.label}</span>
      </Link>
    );
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          className="p-2 rounded-lg hover:bg-muted transition-colors"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5 text-muted-foreground" />
        </button>
      </SheetTrigger>
      <SheetContent
        side="left"
        hideCloseButton
        overlayClassName="bg-black/25 backdrop-blur-sm"
        className={cn(
          'flex w-[280px] flex-col border-r p-0 shadow-2xl',
          glassPanelStyles
        )}
      >
        <SheetHeader className="border-b border-border/50 px-4 py-4 text-left">
          <div className="flex items-center gap-3">
            <img src="/icons/logo.png" alt="Logo" className="h-9 w-9 rounded-xl shrink-0" />
            <SheetTitle className="text-base font-bold tracking-tight">
              {appPublicSettings?.system_name || 'EMZI Nexus Brain'}
            </SheetTitle>
          </div>
        </SheetHeader>
        <nav className="flex flex-col gap-1 p-3">
          {MORE_ITEMS.map(renderLink)}
          {isAdmin && (
            <>
              <p className="px-3 pt-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Admin
              </p>
              {ADMIN_ITEMS.map(renderLink)}
            </>
          )}
        </nav>
        <div className="mt-auto border-t border-border/50 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <Moon className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">Dark Mode</p>
                <p className="text-xs text-muted-foreground">Light or dark theme</p>
              </div>
            </div>
            <ThemeToggle variant="switch" />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
