import { AlertTriangle, Wifi, WifiOff, Wrench } from 'lucide-react';

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

export function getApplicationStatus(status) {
  return APPLICATION_STATUS[status] || APPLICATION_STATUS.online;
}
