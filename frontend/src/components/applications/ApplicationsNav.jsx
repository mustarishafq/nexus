import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutGrid, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ApplicationsNav({ showUsage }) {
  const location = useLocation();

  const tabs = [
    {
      path: '/applications',
      label: 'Browse',
      icon: LayoutGrid,
      match: (path) => path === '/applications',
    },
    ...(showUsage
      ? [{
          path: '/applications/usage',
          label: 'Active Users',
          icon: Users,
          match: (path) => path.startsWith('/applications/usage'),
        }]
      : []),
  ];

  return (
    <div className="flex w-fit items-center gap-1 rounded-xl border border-border bg-muted/30 p-1">
      {tabs.map((tab) => {
        const isActive = tab.match(location.pathname);
        const Icon = tab.icon;
        return (
          <Link
            key={tab.path}
            to={tab.path}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all',
              isActive
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-background/60 hover:text-foreground'
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
