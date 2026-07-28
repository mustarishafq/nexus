import React from 'react';
import { Loader2, MapPin } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export default function LocationPromptModal({
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
            <MapPin className="w-6 h-6 text-primary" />
          </div>
          <DialogTitle>Allow precise location</DialogTitle>
          <DialogDescription>
            Nexus needs your exact location for attendance and clock-in. When your browser or phone
            offers Approximate or Precise, choose Precise.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button type="button" className="w-full" onClick={handleEnable} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Allow precise location
          </Button>
          <Button type="button" variant="ghost" className="w-full" onClick={handleDismiss} disabled={loading}>
            Not now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
