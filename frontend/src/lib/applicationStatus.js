import { AlertTriangle, CircleDashed, Minus, Wifi, WifiOff, Wrench } from 'lucide-react';

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

export const MANUAL_STATUS_DISPLAY = {
  icon: Minus,
  color: 'text-muted-foreground',
  bg: 'bg-muted',
  border: 'border-border',
  label: 'Manual',
};

export function getApplicationStatus(status) {
  return APPLICATION_STATUS[status] || APPLICATION_STATUS.online;
}

export function isHealthMonitoringEnabled(system) {
  return system?.health_check_enabled !== false;
}

export function isAwaitingHealthProbe(system) {
  return isHealthMonitoringEnabled(system) && !system?.last_heartbeat;
}

export function usesManualHealthDisplay(system) {
  return !isHealthMonitoringEnabled(system) && system?.status === 'offline';
}

export function getSystemHealthDisplay(system) {
  if (isAwaitingHealthProbe(system)) {
    return PROBE_PENDING_DISPLAY;
  }

  if (usesManualHealthDisplay(system)) {
    return MANUAL_STATUS_DISPLAY;
  }

  return getApplicationStatus(system.status);
}
