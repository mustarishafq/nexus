import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLightboxStack } from '@/components/media/LightboxStackContext';
import { cn } from '@/lib/utils';

/**
 * Shared photo / media lightbox shell.
 * Portals above Dialog/Sheet (z-[110]) and registers with LightboxStackContext
 * so parent overlays stay open. See docs/LIGHTBOX_DESIGN.md.
 *
 * @param {React.ReactNode} [controls] - Optional chrome (e.g. gallery arrows) rendered
 *   on the full overlay, outside the content click-stop region.
 */
export default function MediaLightbox({
  open,
  onClose,
  ariaLabel = 'Photo preview',
  closeLabel = 'Close photo preview',
  className,
  contentClassName,
  controls = null,
  children,
  onKeyDown,
}) {
  const { registerLightbox, unregisterLightbox } = useLightboxStack();

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    registerLightbox();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        onClose?.();
        return;
      }
      onKeyDown?.(event);
    };

    window.addEventListener('keydown', handleKeyDown, true);

    return () => {
      unregisterLightbox();
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [open, onClose, onKeyDown, registerLightbox, unregisterLightbox]);

  if (!open) {
    return null;
  }

  return createPortal(
    <div
      className={cn(
        'fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-8',
        'bg-black/80 backdrop-blur-md',
        'animate-in fade-in-0 duration-200',
        className
      )}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      onClick={onClose}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn(
          'absolute right-3 top-3 z-20 h-10 w-10 rounded-full',
          'text-white/90 hover:bg-white/10 hover:text-white',
          'sm:right-5 sm:top-5'
        )}
        aria-label={closeLabel}
        onClick={(event) => {
          event.stopPropagation();
          onClose?.();
        }}
      >
        <X className="h-5 w-5" />
      </Button>

      {controls}

      <div
        className={cn('relative flex max-h-full max-w-full items-center justify-center', contentClassName)}
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}
