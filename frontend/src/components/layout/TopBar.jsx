import db from '@/api/apiClient';
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { toAbsoluteUrl } from '@/lib/media';
import { useUnreadNotifications } from '@/hooks/useNotifications';
import { usePlatformReleaseNoteUnreadCount } from '@/hooks/usePlatformReleaseNotes';
import { isAdmin } from '@/lib/roles';

import { Bell, LogOut, Sparkles, User, ChevronDown } from 'lucide-react';
import GlobalSearch, { GlobalSearchTrigger, useGlobalSearchShortcut } from './GlobalSearch';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import NotificationPanel from '@/components/notifications/NotificationPanel';
import PlatformWhatsNewSheet from '@/components/platform/PlatformWhatsNewSheet';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { getDisplayName } from '@/lib/profile';
import { cn } from '@/lib/utils';
import { glassDialogIconButton, glassDialogMutedText, glassDialogTitleText, glassTopBarStyles } from './glassStyles';

export default function TopBar({ sidebarWidth, isMobile, embedded = false }) {
  const navigate = useNavigate();
  const { user: authUser, logout } = useAuth();
  const [user, setUser] = useState(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [whatsNewOpen, setWhatsNewOpen] = useState(false);
  const { data: unreadNotifications = [] } = useUnreadNotifications({
    enabled: !isMobile,
  });
  const unreadCount = unreadNotifications.length;
  const { data: platformUnreadCount = 0 } = usePlatformReleaseNoteUnreadCount({
    enabled: !isMobile,
  });

  useGlobalSearchShortcut(setSearchOpen);

  useEffect(() => {
    setUser(authUser);
  }, [authUser]);

  useEffect(() => {
    if (authUser) return;
    db.auth.me().then(setUser).catch(() => {});
  }, [authUser]);

  return (
    <>
      <header
        className={cn(
          glassTopBarStyles,
          'h-16 border-b flex items-center justify-between gap-3 px-6 transition-all duration-200',
          embedded ? 'w-full' : 'fixed top-0 right-0 z-30'
        )}
        style={embedded ? undefined : { left: sidebarWidth }}
      >
        {/* Search */}
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="relative min-w-0 flex-1">
            <GlobalSearchTrigger onClick={() => setSearchOpen(true)} />
          </div>
        </div>

        {!isMobile && (
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setWhatsNewOpen(true)}
              className={cn(
                'relative rounded-lg p-2 text-foreground/65 transition-colors hover:text-foreground dark:text-muted-foreground',
                platformUnreadCount > 0 && !whatsNewOpen && 'whats-new-trigger--unread',
              )}
              title="What's New"
              aria-label={
                platformUnreadCount > 0
                  ? `What's New, ${platformUnreadCount} unread`
                  : "What's New"
              }
            >
              <Sparkles className="whats-new-trigger__icon h-5 w-5" />
              {platformUnreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center px-1">
                  {platformUnreadCount > 9 ? '9+' : platformUnreadCount}
                </span>
              )}
            </button>

            <ThemeToggle />
            <button
              onClick={() => setPanelOpen(!panelOpen)}
              className={cn('relative rounded-lg p-2', glassDialogIconButton)}
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center px-1 animate-pulse">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-muted transition-colors">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage
                    src={toAbsoluteUrl(user?.profile_picture)}
                    alt={getDisplayName(user)}
                    className="rounded-lg"
                  />
                  <AvatarFallback className="rounded-lg bg-primary/10 text-sm font-semibold text-primary">
                    {getDisplayName(user, 'U')[0]?.toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden text-left md:block">
                  <p className={cn('text-sm font-medium leading-none', glassDialogTitleText)}>
                    {getDisplayName(user)}
                  </p>
                </div>
                <ChevronDown className={cn('hidden h-3 w-3 md:block', glassDialogMutedText)} />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => navigate('/profile')}>
                  <User className="w-4 h-4 mr-2" /> Profile
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => logout()} className="text-destructive">
                  <LogOut className="w-4 h-4 mr-2" /> Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </header>

      {!isMobile ? (
        <NotificationPanel
          open={panelOpen}
          onClose={() => setPanelOpen(false)}
        />
      ) : null}
      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
      {!isMobile ? (
        <PlatformWhatsNewSheet
          open={whatsNewOpen}
          onOpenChange={setWhatsNewOpen}
          canManage={isAdmin(user)}
        />
      ) : null}
    </>
  );
}
