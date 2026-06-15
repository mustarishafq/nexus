import { cn } from '@/lib/utils';
import { getApplicationStatus } from '@/lib/applicationStatus';

export function ApplicationStatusBadge({ status, className, showIcon = true }) {
  const config = getApplicationStatus(status);
  const StatusIcon = config.icon;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium',
        config.bg,
        config.color,
        className
      )}
    >
      {showIcon ? <StatusIcon className="h-2.5 w-2.5" /> : null}
      {config.label}
    </span>
  );
}
