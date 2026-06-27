import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import db from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { useUnreadNotifications, MESSAGE_INBOX_POLL_INTERVAL_MS } from '@/hooks/useNotifications';
import { cn } from '@/lib/utils';
import { MOBILE_BOTTOM_NAV_ITEMS, buildDesktopNavItems } from './navItems';
import { glassDockStyles } from './glassStyles';
import AppsOrbNavItem from './AppsOrbNavItem';
import MobileMoreMenu from './MobileMoreMenu';

export default function BottomNav() {
  const location = useLocation();
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const [badgeCounts, setBadgeCounts] = useState({ notifications: 0, messages: 0 });

  const { data: metabaseDashboards = [] } = useQuery({
    queryKey: ['metabase-dashboards'],
    queryFn: () => db.entities.MetabaseDashboard.list('sort_order', 50),
    staleTime: 60_000,
    enabled: !isMobile,
  });

  const { data: unreadNotifications = [] } = useUnreadNotifications();

  const { data: messageInbox } = useQuery({
    queryKey: ['messages', 'inbox-badge'],
    queryFn: () => db.messages.listConversations(),
    staleTime: 15_000,
    refetchInterval: MESSAGE_INBOX_POLL_INTERVAL_MS,
  });

  const navItems = useMemo(() => {
    if (isMobile) return MOBILE_BOTTOM_NAV_ITEMS;

    const showAnalytics = user?.role === 'admin' || metabaseDashboards.length > 0;
    return buildDesktopNavItems({
      showAnalytics,
      isAdmin: user?.role === 'admin',
    });
  }, [isMobile, user?.role, metabaseDashboards.length]);

  useEffect(() => {
    setBadgeCounts((prev) => ({
      ...prev,
      messages: Number(messageInbox?.unread_total) || 0,
    }));
  }, [messageInbox?.unread_total]);

  useEffect(() => {
    setBadgeCounts((prev) => ({
      ...prev,
      notifications: unreadNotifications.length,
    }));
  }, [unreadNotifications.length]);

  const renderNavItem = (item) => {
    if (item.type === 'apps-orb') {
      return (
        <AppsOrbNavItem
          key={item.path}
          to={item.path}
          label={item.label}
          isActive={item.match(location.pathname)}
        />
      );
    }

    if (item.type === 'more') {
      return (
        <MobileMoreMenu
          key="more"
          badgeCounts={badgeCounts}
          triggerIcon={item.icon}
          label={item.label}
        />
      );
    }

    const isActive = item.match(location.pathname);
    const badgeCount = item.badge ? badgeCounts[item.badge] ?? 0 : 0;

    return (
      <Link
        key={item.path}
        to={item.path}
        className={cn(
          'relative flex flex-col items-center justify-center gap-0.5 px-1 transition-colors',
          isMobile ? 'flex-1' : 'min-w-[4.5rem] shrink-0 px-2',
          isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
        )}
      >
        {isActive && (
          <span className="absolute top-0 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-primary" />
        )}
        <span className="relative">
          <item.icon className={cn('h-5 w-5', isActive && 'text-primary')} />
          {badgeCount > 0 && (
            <span className="absolute -right-2 -top-1.5 min-w-[16px] h-4 rounded-full bg-destructive px-1 text-[9px] font-bold leading-4 text-destructive-foreground text-center">
              {badgeCount > 99 ? '99+' : badgeCount}
            </span>
          )}
        </span>
        <span className={cn('text-[10px] font-medium leading-none', isActive && 'text-primary')}>
          {item.label}
        </span>
      </Link>
    );
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 pb-[calc(0.75rem+env(safe-area-inset-bottom))]"
      aria-label="Main navigation"
    >
      <div className="flex justify-center px-3 sm:px-4">
        <div
          className={cn(
            'flex items-stretch px-1',
            glassDockStyles,
            isMobile
              ? 'h-[4.25rem] w-full max-w-lg overflow-visible'
              : 'h-16 w-fit max-w-full overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden'
          )}
        >
          {navItems.map(renderNavItem)}
        </div>
      </div>
    </nav>
  );
}
