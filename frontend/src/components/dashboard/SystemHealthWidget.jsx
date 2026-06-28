import React from 'react';
import { Monitor, RefreshCw } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import db from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ApplicationStatusBadge } from '@/components/ui/application-status-badge';
import { getSystemHealthDisplay, isAwaitingHealthProbe } from '@/lib/applicationStatus';

function formatHeartbeat(value) {
  if (!value) return 'No probe yet';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'No probe yet';

  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);

  if (minutes < 1) return 'Checked just now';
  if (minutes < 60) return `Checked ${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Checked ${hours}h ago`;

  return date.toLocaleDateString();
}

function getSystemHealthSubtitle(system) {
  if (system.health_check_enabled === false) {
    return 'Manual status';
  }

  if (isAwaitingHealthProbe(system)) {
    return 'Waiting for first health check';
  }

  return formatHeartbeat(system.last_heartbeat);
}

export default function SystemHealthWidget({ systems }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === 'admin';

  const probeAllMut = useMutation({
    mutationFn: () => db.runApplicationHealthChecks(),
    onSuccess: (payload) => {
      if (payload?.status === 'running') {
        toast.info('Probing systems in background…');
        [2000, 5000, 10000].forEach((delay) => {
          window.setTimeout(() => {
            queryClient.invalidateQueries({ queryKey: ['applications'] });
          }, delay);
        });
        return;
      }

      queryClient.invalidateQueries({ queryKey: ['applications'] });
      const checked = payload?.checked ?? 0;
      const healthy = payload?.healthy ?? 0;
      const unhealthy = payload?.unhealthy ?? 0;

      if (unhealthy > 0) {
        toast.warning(`Health check complete: ${healthy}/${checked} healthy, ${unhealthy} unhealthy`);
      } else if (checked > 0) {
        toast.success(`All ${healthy} systems are healthy`);
      } else {
        toast.info('No systems were probed (disabled, in maintenance, or missing base URL)');
      }
    },
    onError: (error) => {
      toast.error(error?.data?.message || error.message || 'Health check failed');
    },
  });

  return (
    <div className="rounded-2xl border border-border bg-card">
      <div className="flex items-center justify-between gap-2 p-5 pb-3">
        <div className="flex items-center gap-2 min-w-0">
          <Monitor className="h-4 w-4 text-primary shrink-0" />
          <h3 className="text-sm font-semibold">System Health</h3>
        </div>
        {isAdmin && systems.length > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
            title="Probe all"
            disabled={probeAllMut.isPending}
            onClick={() => probeAllMut.mutate()}
          >
            <RefreshCw className={cn('h-3.5 w-3.5', probeAllMut.isPending && 'animate-spin')} />
          </Button>
        ) : null}
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
              const awaitingProbe = isAwaitingHealthProbe(system);
              const config = getSystemHealthDisplay(system);
              const StatusIcon = config.icon;

              return (
                <div key={system.id} className="group flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', config.bg)}>
                      <StatusIcon className={cn('h-4 w-4', config.color)} />
                    </div>
                    <div>
                      <p className={cn('text-sm font-medium', awaitingProbe && 'text-muted-foreground')}>
                        {system.name}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {getSystemHealthSubtitle(system)}
                      </p>
                    </div>
                  </div>
                  {awaitingProbe ? (
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium',
                        config.bg,
                        config.color,
                        config.border
                      )}
                    >
                      <StatusIcon className="h-2.5 w-2.5" />
                      {config.label}
                    </span>
                  ) : (
                    <ApplicationStatusBadge status={system.status} />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
