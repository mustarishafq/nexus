import React from 'react';
import { BellRing, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export default function WebPushPromptModal({
  open,
  onOpenChange,
  onEnable,
  onDismiss,
  loading = false,
}) {
  const handleEnable = async () => {
    const enabled = await onEnable?.();
    if (enabled) {
      onOpenChange(false);
    }
  };

  const handleDismiss = () => {
    onDismiss?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md border-primary/20">
        <DialogHeader className="space-y-3">
          <div className="w-12 h-12 rounded-full bg-primary/10 ring-4 ring-primary/10 flex items-center justify-center">
            <BellRing className="w-6 h-6 text-primary" />
          </div>
          <DialogTitle>Enable notifications</DialogTitle>
          <DialogDescription>
            Get alerts for messages, mentions, and important updates — even when Nexus is in the background.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button type="button" className="w-full" onClick={handleEnable} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Enable notifications
          </Button>
          <Button type="button" variant="ghost" className="w-full" onClick={handleDismiss} disabled={loading}>
            Not now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
