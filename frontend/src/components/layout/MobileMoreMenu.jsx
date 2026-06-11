import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import {
  Activity, Calendar, Wifi, Settings, Megaphone, Shield, Users, Menu,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from '@/components/ui/sheet';

const MORE_ITEMS = [
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
            ? 'bg-primary/10 text-primary'
            : 'text-foreground hover:bg-muted'
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
      <SheetContent side="left" className="w-[280px] p-0">
        <SheetHeader className="border-b border-border px-4 py-4 text-left">
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
      </SheetContent>
    </Sheet>
  );
}
