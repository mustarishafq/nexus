import db from '@/api/base44Client';
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { Bell, Search, LogOut, User, ChevronDown, Menu } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import NotificationPanel from '@/components/notifications/NotificationPanel';

export default function TopBar({ sidebarWidth, isMobile, onMenuToggle }) {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [panelOpen, setPanelOpen] = useState(false);

  useEffect(() => {
    db.auth.me().then(setUser).catch(() => {});
    loadUnreadCount();
    const interval = setInterval(loadUnreadCount, 15000);
    return () => clearInterval(interval);
  }, []);

  const loadUnreadCount = async () => {
    try {
      const notifs = await db.entities.Notification.filter({ is_read: false, exclude_broadcasts: true }, '-created_date', 100);
      setUnreadCount(Array.isArray(notifs) ? notifs.length : 0);
    } catch {
      setUnreadCount(0);
    }
  };

  return (
    <>
      <header
        className="fixed top-0 right-0 z-30 h-16 bg-card/80 backdrop-blur-xl border-b border-border flex items-center justify-between px-6 transition-all duration-200"
        style={{ left: sidebarWidth }}
      >
        {/* Search */}
        <div className="flex items-center gap-3 w-full max-w-[65%] md:max-w-[40%]">
          {isMobile && (
            <button
              onClick={onMenuToggle}
              className="p-2 rounded-lg hover:bg-muted transition-colors"
              aria-label="Open sidebar"
            >
              <Menu className="w-5 h-5 text-muted-foreground" />
            </button>
          )}
          <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search notifications, activity..."
            className="pl-9 bg-muted/50 border-0 h-9 text-sm focus-visible:ring-1"
          />
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3">
          {/* Notification Bell */}
          <button
            onClick={() => setPanelOpen(!panelOpen)}
            className="relative p-2 rounded-lg hover:bg-muted transition-colors"
          >
            <Bell className="w-5 h-5 text-muted-foreground" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center px-1 animate-pulse">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-muted transition-colors">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <span className="text-sm font-semibold text-primary">
                  {user?.full_name?.[0] || 'U'}
                </span>
              </div>
              <div className="hidden md:block text-left">
                <p className="text-sm font-medium leading-none">{user?.full_name || 'User'}</p>
                <p className="text-xs text-muted-foreground">{user?.role || 'user'}</p>
              </div>
              <ChevronDown className="w-3 h-3 text-muted-foreground hidden md:block" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => navigate('/profile')}>
                <User className="w-4 h-4 mr-2" /> Profile
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => db.auth.logout()} className="text-destructive">
                <LogOut className="w-4 h-4 mr-2" /> Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Notification Panel Overlay */}
      <NotificationPanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        onCountChange={setUnreadCount}
      />
    </>
  );
}