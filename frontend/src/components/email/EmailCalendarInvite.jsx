import React, { useState } from 'react';
import { Calendar, Loader2, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import db from '@/api/apiClient';
import { cn } from '@/lib/utils';

const RESPONSES = [
  { id: 'accepted', label: 'Accept' },
  { id: 'tentative', label: 'Maybe' },
  { id: 'declined', label: 'Decline' },
];

const SENT_LABEL = {
  accepted: 'You accepted this invitation. The organizer has been emailed.',
  tentative: 'You replied maybe. The organizer has been emailed.',
  declined: 'You declined this invitation. The organizer has been emailed.',
};

export default function EmailCalendarInvite({
  invite,
  uid,
  accountId,
  folder,
}) {
  const [pending, setPending] = useState(null);
  const [sent, setSent] = useState(null);

  if (!invite) {
    return null;
  }

  const respond = async (response) => {
    setPending(response);
    try {
      await db.mail.replyToInvite(uid, response, { accountId, folder });
      setSent(response);
      toast.success(SENT_LABEL[response]);
    } catch (error) {
      toast.error(error?.message || 'Unable to send the calendar response.');
    } finally {
      setPending(null);
    }
  };

  const method = String(invite.method || '').toUpperCase();
  const cancelled = method === 'CANCEL';

  return (
    <div className="mb-4 rounded-lg border border-border/70 bg-muted/30 p-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary">
          <Calendar className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {cancelled ? 'Cancelled meeting' : 'Meeting invitation'}
          </p>
          <h3 className="mt-0.5 text-base font-semibold leading-snug">{invite.summary}</h3>
          {invite.when_label ? (
            <p className="mt-1 text-sm text-foreground/90">{invite.when_label}</p>
          ) : null}
          {invite.location ? (
            <p className="mt-1 flex items-start gap-1.5 text-sm text-muted-foreground">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{invite.location}</span>
            </p>
          ) : null}
          {invite.organizer_name || invite.organizer_email ? (
            <p className="mt-1 text-sm text-muted-foreground">
              From {invite.organizer_name || invite.organizer_email}
              {invite.organizer_name && invite.organizer_email ? ` <${invite.organizer_email}>` : ''}
            </p>
          ) : null}
          {invite.description ? (
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
              {invite.description}
            </p>
          ) : null}
        </div>
      </div>

      {invite.can_reply ? (
        <div className="mt-4">
          <div className="flex flex-wrap gap-2">
            {RESPONSES.map((response) => (
              <Button
                key={response.id}
                type="button"
                size="sm"
                variant={sent === response.id ? 'default' : 'outline'}
                className={cn(sent && sent !== response.id && 'opacity-60')}
                disabled={Boolean(pending)}
                onClick={() => respond(response.id)}
              >
                {pending === response.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                {response.label}
              </Button>
            ))}
          </div>
          {sent ? (
            <p className="mt-2 text-xs text-muted-foreground">{SENT_LABEL[sent]}</p>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">
              Your reply is emailed to the organizer.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
