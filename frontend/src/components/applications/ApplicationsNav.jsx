import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';

export default function ApplicationsNav({ showUsage }) {
  const location = useLocation();

  const tabs = [
    { path: '/applications', label: 'Browse', match: (path) => path === '/applications' },
    ...(showUsage
      ? [{ path: '/applications/usage', label: 'Active Users', match: (path) => path.startsWith('/applications/usage') }]
      : []),
  ];

  return (
    <div className="flex items-center gap-1 rounded-xl border border-border bg-muted/30 p-1 w-fit">
      {tabs.map((tab) => {
        const isActive = tab.match(location.pathname);
        return (
          <Link
            key={tab.path}
            to={tab.path}
            className={cn(
              'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
              isActive
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
