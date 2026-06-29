import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import db from '@/api/apiClient';
import { 
  LayoutDashboard, Bell, Activity, Shield, Settings, 
  Monitor, Megaphone, ChevronLeft, ChevronRight, Users, Calendar, Wifi, BarChart3, Newspaper, Mail, MessageSquare, GitBranch,
} from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

export default function Sidebar({
  collapsed,
  onToggle,
}) {
  const location = useLocation();
  const { user, appPublicSettings } = useAuth();

  const { data: metabaseDashboards = [] } = useQuery({
    queryKey: ['metabase-dashboards'],
    queryFn: () => db.entities.MetabaseDashboard.list('sort_order', 50),
    staleTime: 60_000,
  });

  const showAnalytics = user?.role === 'admin' || metabaseDashboards.length > 0;

  const navItems = [
    { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/people', icon: Users, label: 'People' },
    { path: '/organization', icon: GitBranch, label: 'Organization' },
    { path: '/feed', icon: Newspaper, label: 'Feed' },
    { path: '/messages', icon: MessageSquare, label: 'Messages' },
    { path: '/email', icon: Mail, label: 'Email' },
    ...(showAnalytics ? [{ path: '/analytics', icon: BarChart3, label: 'Analytics' }] : []),
    { path: '/applications', icon: Monitor, label: 'Application' },
    { path: '/notifications', icon: Bell, label: 'Notifications' },
    { path: '/activity', icon: Activity, label: 'Activity Feed' },
    { path: '/network-health', icon: Wifi, label: 'Network Health' },
    { path: '/calendar', icon: Calendar, label: 'Calendar' },
    ...(user?.role === 'admin' ? [
      { path: '/admin/broadcast', icon: Megaphone, label: 'Broadcast' },
      { path: '/admin/events', icon: Shield, label: 'System Events' },
      { path: '/admin/users', icon: Users, label: 'User Management' },
    ] : []),
    { path: '/settings', icon: Settings, label: 'Settings' },
  ];

  const showCompact = collapsed;

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="flex items-center h-16 px-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <img src="/icons/logo.png" alt="Logo" className="w-9 h-9 rounded-xl shrink-0" />
          <AnimatePresence>
            {!showCompact && (
              <motion.div
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                className="overflow-hidden whitespace-nowrap"
              >
                <span className="text-sidebar-foreground font-bold text-lg tracking-tight">
                  {appPublicSettings?.system_name || 'EMZI Nexus Brain'}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = item.path === '/applications'
            ? location.pathname === '/applications' || location.pathname.startsWith('/applications/')
            : item.path === '/people'
              ? location.pathname === '/people' || /^\/people\/\d+$/.test(location.pathname)
              : item.path === '/organization'
                ? location.pathname === '/organization' || location.pathname.startsWith('/organization/')
              : item.path === '/messages'
                ? location.pathname === '/messages' || location.pathname.startsWith('/messages/')
              : item.path === '/email'
                ? location.pathname === '/email' || location.pathname.startsWith('/email/')
                : location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 group relative",
                isActive
                  ? "bg-sidebar-accent text-primary"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="sidebar-active"
                  className="absolute left-0 top-0 bottom-0 flex items-center justify-center w-1 bg-primary rounded-r-full"
                />
              )}
              <item.icon className={cn("w-5 h-5 shrink-0", isActive && "text-primary")} />
              <AnimatePresence>
                {!showCompact && (
                  <motion.span
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: 'auto' }}
                    exit={{ opacity: 0, width: 0 }}
                    className="text-sm font-medium overflow-hidden whitespace-nowrap"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
            </Link>
          );
        })}
      </nav>

      {/* Collapse Toggle */}
      <div className="p-3 border-t border-sidebar-border">
        <button
          onClick={onToggle}
          className="w-full flex items-center justify-center p-2 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>
    </>
  );

  return (
    <motion.aside
      animate={{ width: collapsed ? 72 : 260 }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
      className="fixed left-0 top-0 bottom-0 z-40 flex flex-col bg-sidebar border-r border-sidebar-border"
    >
      {sidebarContent}
    </motion.aside>
  );
}