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
        'rounded-xl border bg-card/80 p-4 shadow-sm',
        priority === 'critical' && 'ring-1 ring-critical/30',
        priority === 'high' && 'ring-1 ring-warning/30'
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', visual.bg)}>
          <Icon className={cn('h-5 w-5', visual.color)} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold leading-snug">{broadcast.title}</h3>
            <Badge variant="outline" className="h-5 text-[10px] capitalize">
              {priority}
            </Badge>
          </div>
          {broadcast.message ? (
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{broadcast.message}</p>
          ) : null}
          <p className="mt-2 text-[11px] text-muted-foreground">
            Posted {formatDistanceToNow(new Date(broadcast.created_date), { addSuffix: true })}
          </p>
        </div>
      </div>
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
      <DialogContent className="max-h-[85vh] overflow-hidden border-primary/25 p-0 sm:max-w-2xl">
        <div
          className={cn(
            'border-b bg-gradient-to-b px-6 pb-5 pt-6',
            priorityAccent[topPriority] || priorityAccent.medium
          )}
        >
          <DialogHeader className="space-y-3 text-left">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 ring-4 ring-primary/10">
                <Megaphone className="h-6 w-6 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-2xl tracking-tight">
                  {broadcasts.length === 1 ? 'Important Announcement' : `${broadcasts.length} Active Announcements`}
                </DialogTitle>
                <DialogDescription className="text-sm">
                  Please review before continuing — these updates are live across Nexus.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="max-h-[50vh] space-y-3 overflow-y-auto px-6 py-4">
          {broadcasts.map((broadcast) => (
            <BroadcastAnnouncementCard key={broadcast.id} broadcast={broadcast} />
          ))}
        </div>

        <DialogFooter className="border-t border-border/60 px-6 py-4 sm:justify-between">
          <p className="text-xs text-muted-foreground">
            You can review announcements again from your dashboard.
          </p>
          <Button size="lg" className="min-w-[10rem]" onClick={handleAcknowledge}>
            Got it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
