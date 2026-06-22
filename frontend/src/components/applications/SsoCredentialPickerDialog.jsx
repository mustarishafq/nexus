import React, { useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { KeyRound, UserCircle2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from '@/components/ui/dialog';
import { glassDialogMutedText, glassDialogPanelStyles } from '@/components/layout/glassStyles';
import { cn } from '@/lib/utils';

export default function SsoCredentialPickerDialog({
  open,
  application,
  options = [],
  onCancel,
  onConfirm,
}) {
  const [selectedEmail, setSelectedEmail] = useState(null);

  const resolvedSelection = selectedEmail ?? options[0]?.email ?? null;

  const handleOpenChange = (nextOpen) => {
    if (!nextOpen) {
      setSelectedEmail(null);
      onCancel?.();
    }
  };

  const handleConfirm = () => {
    if (!resolvedSelection) return;
    onConfirm?.(resolvedSelection);
    setSelectedEmail(null);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogPortal>
        <DialogOverlay className="z-[130] bg-black/25 backdrop-blur-sm" />
        <DialogPrimitive.Content
          className={cn(
            'fixed left-[50%] top-[50%] z-[130] grid w-[calc(100vw-1.5rem)] max-w-md translate-x-[-50%] translate-y-[-50%] gap-4 p-6 duration-200',
            'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
            'data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]',
            'data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]',
            'rounded-2xl border',
            glassDialogPanelStyles,
          )}
        >
          <DialogHeader>
            <DialogTitle className="text-foreground">Choose SSO account</DialogTitle>
            <DialogDescription className={glassDialogMutedText}>
              {application?.name
                ? `Select which account to use when signing in to ${application.name}.`
                : 'Select which account to use for this application.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            {options.map((option) => {
              const isSelected = resolvedSelection === option.email;

              return (
                <button
                  key={`${option.id}-${option.email}`}
                  type="button"
                  onClick={() => setSelectedEmail(option.email)}
                  className={cn(
                    'flex w-full items-start gap-3 rounded-xl border px-3 py-3 text-left transition-colors',
                    isSelected
                      ? 'border-primary bg-primary/10 ring-1 ring-primary/25'
                      : 'border-border bg-card hover:border-primary/30 hover:bg-muted/50 dark:border-border/50 dark:bg-white/5 dark:hover:bg-foreground/5',
                  )}
                >
                  <span
                    className={cn(
                      'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border',
                      isSelected
                        ? 'border-primary/30 bg-primary/15'
                        : 'border-border bg-muted dark:bg-background/30',
                    )}
                  >
                    {option.primary ? (
                      <UserCircle2 className="h-4 w-4 text-primary" />
                    ) : (
                      <KeyRound className="h-4 w-4 text-muted-foreground" />
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-foreground">{option.label}</span>
                    <span className={cn('block truncate text-xs', glassDialogMutedText)}>{option.email}</span>
                  </span>
                </button>
              );
            })}
          </div>

          <DialogFooter className="flex-row justify-end gap-2 sm:justify-end sm:space-x-0">
            <Button
              type="button"
              variant="outline"
              className="h-10 flex-1 sm:flex-none"
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="h-10 flex-1 sm:flex-none"
              onClick={handleConfirm}
              disabled={!resolvedSelection}
            >
              Continue
            </Button>
          </DialogFooter>

          <DialogPrimitive.Close
            className="absolute right-4 top-4 rounded-sm text-foreground opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            onClick={() => handleOpenChange(false)}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
