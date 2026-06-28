import { AlertTriangle, CircleDashed, Wifi, WifiOff, Wrench } from 'lucide-react';

export const APPLICATION_STATUS = {
  online: {
    icon: Wifi,
    color: 'text-success',
    bg: 'bg-success/10',
    border: 'border-success/30',
    label: 'Online',
  },
  offline: {
    icon: WifiOff,
    color: 'text-destructive',
    bg: 'bg-destructive/10',
    border: 'border-destructive/30',
    label: 'Offline',
  },
  maintenance: {
    icon: Wrench,
    color: 'text-warning',
    bg: 'bg-warning/10',
    border: 'border-warning/30',
    label: 'Maintenance',
  },
  degraded: {
    icon: AlertTriangle,
    color: 'text-warning',
    bg: 'bg-warning/10',
    border: 'border-warning/30',
    label: 'Degraded',
  },
};

export const PROBE_PENDING_DISPLAY = {
  icon: CircleDashed,
  color: 'text-muted-foreground',
  bg: 'bg-muted',
  border: 'border-border',
  label: 'Pending',
};

export function getApplicationStatus(status) {
  return APPLICATION_STATUS[status] || APPLICATION_STATUS.online;
}

export function isAwaitingHealthProbe(system) {
  return system?.health_check_enabled !== false && !system?.last_heartbeat;
}

export function getSystemHealthDisplay(system) {
  if (isAwaitingHealthProbe(system)) {
    return PROBE_PENDING_DISPLAY;
  }

  return getApplicationStatus(system.status);
}
