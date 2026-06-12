import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { AlertOctagon, AlertTriangle, Info, Megaphone } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getNotificationPriorityVisual } from '@/lib/notificationVisuals';
import { cn } from '@/lib/utils';

const priorityIcons = {
  critical: AlertOctagon,
  high: AlertTriangle,
  medium: Megaphone,
  low: Info,
};

const priorityAccent = {
  critical: 'from-critical/25 via-critical/10 to-transparent border-critical/30',
  high: 'from-warning/25 via-warning/10 to-transparent border-warning/30',
  medium: 'from-info/25 via-info/10 to-transparent border-info/30',
  low: 'from-muted/60 via-muted/20 to-transparent border-border',
};

function BroadcastAnnouncementCard({ broadcast }) {
  const priority = broadcast.priority || 'medium';
  const visual = getNotificationPriorityVisual(priority);
  const Icon = priorityIcons[priority] || Megaphone;

  return (
    <article
      className={cn(
        'rounded-lg border bg-card/80 p-3',
        priority === 'critical' && 'ring-1 ring-critical/30',
        priority === 'high' && 'ring-1 ring-warning/30'
      )}
    >
      <div className="flex items-start gap-2.5">
        <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', visual.bg)}>
          <Icon className={cn('h-4 w-4', visual.color)} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="text-sm font-semibold leading-snug">{broadcast.title}</h3>
            <Badge variant="outline" className="h-4 px-1.5 text-[10px] capitalize">
              {priority}
            </Badge>
          </div>
        </div>
      </div>
      {broadcast.message ? (
        <div className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground">
          {broadcast.message}
        </div>
      ) : null}
      <p className="mt-2 text-[10px] text-muted-foreground">
        Posted {formatDistanceToNow(new Date(broadcast.created_date), { addSuffix: true })}
      </p>
    </article>
  );
}

export default function BroadcastAnnouncementModal({ open, onOpenChange, broadcasts = [], onAcknowledge }) {
  const topPriority = broadcasts[0]?.priority || 'medium';

  const handleAcknowledge = () => {
    onAcknowledge?.(broadcasts.map((broadcast) => broadcast.id));
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="grid max-h-[min(36rem,85vh)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden border-primary/20 p-0 sm:max-w-md">
        <div
          className={cn(
            'border-b bg-gradient-to-b px-4 py-3',
            priorityAccent[topPriority] || priorityAccent.medium
          )}
        >
          <DialogHeader className="space-y-1 text-left">
            <div className="flex items-center gap-2.5 pr-6">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/15">
                <Megaphone className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-base">
                  {broadcasts.length === 1 ? 'Important Announcement' : `${broadcasts.length} Active Announcements`}
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Review before continuing — live across Nexus.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="min-h-0 space-y-2 overflow-y-auto px-4 py-3">
          {broadcasts.map((broadcast) => (
            <BroadcastAnnouncementCard key={broadcast.id} broadcast={broadcast} />
          ))}
        </div>

        <DialogFooter className="gap-2 border-t border-border/60 px-4 py-3 sm:items-center sm:justify-between">
          <p className="hidden text-[11px] text-muted-foreground sm:block">
            Review again from your dashboard.
          </p>
          <Button size="sm" className="w-full sm:w-auto sm:min-w-[7rem]" onClick={handleAcknowledge}>
            Got it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
