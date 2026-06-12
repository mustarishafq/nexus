import React from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { Megaphone } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

function BroadcastFeedPost({ broadcast }) {
  return (
    <article className="px-5 py-4 border-b border-border/50 last:border-b-0 bg-primary/[0.03]">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <Megaphone className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold">{broadcast.title}</p>
            <Badge variant="outline" className="text-[10px] h-5">
              {broadcast.priority || 'announcement'}
            </Badge>
          </div>
          {broadcast.message ? (
            <div className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground">
              {broadcast.message}
            </div>
          ) : null}
          <p className="text-[11px] text-muted-foreground mt-2">
            Posted {formatDistanceToNow(new Date(broadcast.created_date), { addSuffix: true })}
          </p>
        </div>
      </div>
    </article>
  );
}

export default function ProfileAnnouncementsWidget({ broadcasts = [], isAdmin = false }) {
  const recentBroadcasts = broadcasts.slice(0, 3);

  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden">
      <div className="flex items-center justify-between p-5 pb-3">
        <div className="flex items-center gap-2">
          <Megaphone className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-sm">Announcements</h3>
        </div>
        {isAdmin ? (
          <Link to="/admin/broadcast">
            <Button variant="ghost" size="sm" className="h-7 text-xs">
              Manage
            </Button>
          </Link>
        ) : null}
      </div>
      {recentBroadcasts.length === 0 ? (
        <div className="px-5 pb-5 text-sm text-muted-foreground">
          No active announcements right now.
          {isAdmin ? (
            <span>
              {' '}
              <Link to="/admin/broadcast" className="text-primary hover:underline">
                Send one from Broadcast Center
              </Link>
              .
            </span>
          ) : null}
        </div>
      ) : (
        <div>
          {recentBroadcasts.map((broadcast) => (
            <BroadcastFeedPost key={broadcast.id} broadcast={broadcast} />
          ))}
        </div>
      )}
    </div>
  );
}
