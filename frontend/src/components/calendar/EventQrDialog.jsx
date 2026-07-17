// @ts-nocheck
import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Check, Copy, QrCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

export default function EventQrDialog({ open, onOpenChange, event }) {
  const [copied, setCopied] = useState(false);
  const checkInUrl = event?.check_in_url;

  const handleCopy = async () => {
    if (!checkInUrl) {
      return;
    }

    try {
      await navigator.clipboard.writeText(checkInUrl);
      setCopied(true);
      toast.success('Check-in link copied');
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy link');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-primary" />
            Event attendance QR
          </DialogTitle>
          <DialogDescription>
            {event?.title
              ? `Share this QR for “${event.title}”. Scans count as attendance.`
              : 'Share this QR so people can check in.'}
          </DialogDescription>
        </DialogHeader>

        {checkInUrl ? (
          <div className="flex flex-col items-center gap-4 py-2">
            <div className="rounded-2xl border bg-white p-4">
              <QRCodeSVG value={checkInUrl} size={220} level="M" includeMargin />
            </div>
            <p className="text-xs text-muted-foreground text-center break-all max-w-full px-2">
              {checkInUrl}
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-6">
            Check-in QR is not available for this event.
          </p>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleCopy} disabled={!checkInUrl} className="gap-2">
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied' : 'Copy link'}
          </Button>
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
