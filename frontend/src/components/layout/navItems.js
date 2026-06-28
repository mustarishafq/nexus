import {
  LayoutDashboard, BarChart3, Monitor, Bell, User, Activity, Wifi, Calendar,
  Settings, Megaphone, Shield, Users, Newspaper, Mail, GitBranch, Grip, Clock, MessageSquare,
} from 'lucide-react';

export const MOBILE_BOTTOM_NAV_ITEMS = [
  { path: '/', icon: LayoutDashboard, label: 'Home', match: (path) => path === '/' },
  { path: '/feed', icon: Newspaper, label: 'Feed', match: (path) => path === '/feed' },
  {
    type: 'apps-orb',
    path: '/applications',
    icon: Monitor,
    label: 'Apps',
    match: (path) => path === '/applications' || path.startsWith('/applications/'),
  },
  { path: '/notifications', icon: Bell, label: 'Notifications', match: (path) => path === '/notifications', badge: 'notifications' },
  { type: 'more', icon: Grip, label: 'More' },
];

export function buildMobileMoreItems({ showAnalytics, isAdmin }) {
  return [
    { path: '/people', icon: Users, label: 'People', match: (path) => path === '/people' || /^\/people\/\d+$/.test(path) },
    {
      path: '/organization',
      icon: GitBranch,
      label: 'Organization',
      match: (path) => path === '/organization' || path.startsWith('/organization/'),
    },
    { path: '/messages', icon: MessageSquare, label: 'Messages', match: (path) => path === '/messages' || path.startsWith('/messages/'), badge: 'messages' },
    { path: '/email', icon: Mail, label: 'Email', match: (path) => path === '/email' || path.startsWith('/email/'), badge: 'email' },
    ...(showAnalytics ? [{
      path: '/analytics',
      icon: BarChart3,
      label: 'Analytics',
      match: (path) => path === '/analytics' || path.startsWith('/analytics/'),
    }] : []),
    { path: '/activity', icon: Activity, label: 'Activity', match: (path) => path === '/activity' },
    { path: '/network-health', icon: Wifi, label: 'Network', match: (path) => path === '/network-health' },
    { path: '/attendance', icon: Clock, label: 'Attendance', match: (path) => path === '/attendance' || path.startsWith('/attendance/') },
    { path: '/calendar', icon: Calendar, label: 'Calendar', match: (path) => path === '/calendar' },
    { path: '/profile', icon: User, label: 'Profile', match: (path) => path === '/profile' },
    { path: '/settings', icon: Settings, label: 'Settings', match: (path) => path === '/settings' },
    ...(isAdmin ? [
      { path: '/admin/broadcast', icon: Megaphone, label: 'Broadcast', match: (path) => path === '/admin/broadcast' },
      { path: '/admin/events', icon: Shield, label: 'Events', match: (path) => path === '/admin/events' },
      { path: '/admin/users', icon: Users, label: 'Users', match: (path) => path === '/admin/users' },
    ] : []),
  ];
}

export function matchMobileMorePath(pathname, moreItems) {
  return moreItems.some((item) => item.match(pathname));
}

export function buildDesktopNavItems({ showAnalytics, isAdmin }) {
  return [
    { path: '/', icon: LayoutDashboard, label: 'Dashboard', match: (path) => path === '/' },
    { path: '/people', icon: Users, label: 'People', match: (path) => path === '/people' || /^\/people\/\d+$/.test(path) },
    {
      path: '/organization',
      icon: GitBranch,
      label: 'Organization',
      match: (path) => path === '/organization' || path.startsWith('/organization/'),
    },
    { path: '/feed', icon: Newspaper, label: 'Feed', match: (path) => path === '/feed' },
    { path: '/messages', icon: MessageSquare, label: 'Messages', match: (path) => path === '/messages' || path.startsWith('/messages/'), badge: 'messages' },
    { path: '/email', icon: Mail, label: 'Email', match: (path) => path === '/email' || path.startsWith('/email/'), badge: 'email' },
    ...(showAnalytics ? [{
      path: '/analytics',
      icon: BarChart3,
      label: 'Analytics',
      match: (path) => path === '/analytics' || path.startsWith('/analytics/'),
    }] : []),
    {
      path: '/applications',
      icon: Monitor,
      label: 'Application',
      match: (path) => path === '/applications' || path.startsWith('/applications/'),
    },
    { path: '/notifications', icon: Bell, label: 'Notifications', match: (path) => path === '/notifications', badge: 'notifications' },
    { path: '/activity', icon: Activity, label: 'Activity', match: (path) => path === '/activity' },
    { path: '/network-health', icon: Wifi, label: 'Network', match: (path) => path === '/network-health' },
    { path: '/attendance', icon: Clock, label: 'Attendance', match: (path) => path === '/attendance' || path.startsWith('/attendance/') },
    { path: '/calendar', icon: Calendar, label: 'Calendar', match: (path) => path === '/calendar' },
    ...(isAdmin ? [
      { path: '/admin/broadcast', icon: Megaphone, label: 'Broadcast', match: (path) => path === '/admin/broadcast' },
      { path: '/admin/events', icon: Shield, label: 'Events', match: (path) => path === '/admin/events' },
      { path: '/admin/users', icon: Users, label: 'Users', match: (path) => path === '/admin/users' },
    ] : []),
    { path: '/settings', icon: Settings, label: 'Settings', match: (path) => path === '/settings' },
  ];
}
