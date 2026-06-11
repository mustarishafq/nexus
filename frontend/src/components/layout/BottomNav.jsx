import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import db from '@/api/base44Client';
import { LayoutDashboard, BarChart3, Monitor, Bell, User } from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { path: '/', icon: LayoutDashboard, label: 'Home', match: (path) => path === '/' },
  { path: '/analytics', icon: BarChart3, label: 'Analytics', match: (path) => path === '/analytics' || path.startsWith('/analytics/') },
  {
    path: '/applications',
    icon: Monitor,
    label: 'Apps',
    match: (path) => path === '/applications' || path.startsWith('/applications/'),
  },
  { path: '/notifications', icon: Bell, label: 'Notifications', match: (path) => path === '/notifications', showBadge: true },
  { path: '/profile', icon: User, label: 'Profile', match: (path) => path === '/profile' },
];

export default function BottomNav() {
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const loadUnreadCount = async () => {
      try {
        const notifs = await db.entities.Notification.filter(
          { is_read: false, exclude_broadcasts: true },
          '-created_date',
          100
        );
        setUnreadCount(Array.isArray(notifs) ? notifs.length : 0);
      } catch {
        setUnreadCount(0);
      }
    };

    loadUnreadCount();
    const interval = setInterval(loadUnreadCount, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card/95 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]"
      aria-label="Main navigation"
    >
      <div className="flex h-16 items-stretch">
        {NAV_ITEMS.map((item) => {
          const isActive = item.match(location.pathname);
          const badgeCount = item.showBadge ? unreadCount : 0;

          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                'relative flex flex-1 flex-col items-center justify-center gap-0.5 px-1 transition-colors',
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
        })}
      </div>
    </nav>
  );
}
