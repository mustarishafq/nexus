import React from 'react';
import { Monitor } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EmptyState } from '@/components/ui/empty-state';
import { ApplicationStatusBadge } from '@/components/ui/application-status-badge';
import { getApplicationStatus } from '@/lib/applicationStatus';

export default function SystemHealthWidget({ systems }) {
  return (
    <div className="rounded-2xl border border-border bg-card">
      <div className="flex items-center gap-2 p-5 pb-3">
        <Monitor className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">System Health</h3>
      </div>
      <div className="px-5 pb-5">
        {systems.length === 0 ? (
          <EmptyState
            variant="compact"
            icon={Monitor}
            title="No applications yet"
            description="Connected systems will appear here once added."
          />
        ) : (
          <div className="-mr-5 max-h-64 space-y-3 overflow-y-auto pr-5 scrollbar-on-hover">
            {systems.map((system) => {
              const config = getApplicationStatus(system.status);
              const StatusIcon = config.icon;

              return (
                <div key={system.id} className="group flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', config.bg)}>
                      <StatusIcon className={cn('h-4 w-4', config.color)} />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{system.name}</p>
                      <p className="text-[10px] text-muted-foreground">{system.slug}</p>
                    </div>
                  </div>
                  <ApplicationStatusBadge status={system.status} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
