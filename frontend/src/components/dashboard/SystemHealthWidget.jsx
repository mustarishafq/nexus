import React from 'react';
import { Monitor, Wifi, WifiOff, AlertTriangle, Wrench } from 'lucide-react';
import { cn } from '@/lib/utils';

const statusConfig = {
  online: { icon: Wifi, color: 'text-success', bg: 'bg-success/10', label: 'Online' },
  offline: { icon: WifiOff, color: 'text-destructive', bg: 'bg-destructive/10', label: 'Offline' },
  maintenance: { icon: Wrench, color: 'text-warning', bg: 'bg-warning/10', label: 'Maintenance' },
  degraded: { icon: AlertTriangle, color: 'text-warning', bg: 'bg-warning/10', label: 'Degraded' },
};

export default function SystemHealthWidget({ systems }) {
  return (
    <div className="bg-card rounded-2xl border border-border">
      <div className="flex items-center gap-2 p-5 pb-3">
        <Monitor className="w-4 h-4 text-primary" />
        <h3 className="font-semibold text-sm">System Health</h3>
      </div>
      <div className="px-5 pb-5 space-y-3">
        {systems.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No connected systems</p>
        ) : (
          systems.map(system => {
            const config = statusConfig[system.status] || statusConfig.online;
            const StatusIcon = config.icon;
            return (
              <div key={system.id} className="flex items-center justify-between group">
                <div className="flex items-center gap-3">
                  <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", config.bg)}>
                    <StatusIcon className={cn("w-4 h-4", config.color)} />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{system.name}</p>
                    <p className="text-[10px] text-muted-foreground">{system.slug}</p>
                  </div>
                </div>
                <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full", config.bg, config.color)}>
                  {config.label}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}