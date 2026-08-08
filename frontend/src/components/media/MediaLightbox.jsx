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
 * While open, cancels Safari gesture* events so pinch zooms the image
 * (via LightboxZoomableImage) instead of the browser page.
 *
 * Close control sits in a reserved top chrome row (below the iOS status bar)
 * so it never collides with the content panel / image card.
 *
 * @param {React.ReactNode} [controls] - Optional chrome (e.g. gallery arrows) rendered
 *   on the full overlay, outside the content click-stop region.
 * @param {boolean} [hideCloseButton] - Hide the built-in close (caller renders its own).
 */
export default function MediaLightbox({
  open,
  onClose,
  ariaLabel = 'Photo preview',
  closeLabel = 'Close photo preview',
  className,
  contentClassName,
  hideCloseButton = false,
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

    // iOS Safari can still page-zoom on pinch despite maximum-scale=1.
    // Cancel legacy gesture events while any lightbox is open.
    const preventGesture = (event) => {
      event.preventDefault();
    };

    window.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('gesturestart', preventGesture, { passive: false });
    document.addEventListener('gesturechange', preventGesture, { passive: false });
    document.addEventListener('gestureend', preventGesture, { passive: false });

    return () => {
      unregisterLightbox();
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('gesturestart', preventGesture);
      document.removeEventListener('gesturechange', preventGesture);
      document.removeEventListener('gestureend', preventGesture);
    };
  }, [open, onClose, onKeyDown, registerLightbox, unregisterLightbox]);

  if (!open) {
    return null;
  }

  return createPortal(
    <div
      className={cn(
        'fixed inset-0 z-[110] flex items-center justify-center overflow-hidden',
        'bg-black/80 backdrop-blur-md',
        'animate-in fade-in-0 duration-200',
        // Consumer padding (e.g. p-0 / p-3) applied first…
        className,
        // …then safe-area chrome wins so iOS status bar / home indicator stay clear.
        // When the built-in close is shown, reserve a top row so it never overlaps the panel.
        hideCloseButton
          ? 'pt-[max(1rem,var(--nexus-safe-top))]'
          : 'pt-[calc(var(--nexus-safe-top)+3rem)]',
        'pb-[max(1rem,var(--nexus-safe-bottom))]',
        'pl-[max(1rem,env(safe-area-inset-left,0px))]',
        'pr-[max(1rem,env(safe-area-inset-right,0px))]',
        hideCloseButton
          ? 'sm:pt-[max(1.5rem,var(--nexus-safe-top))]'
          : 'sm:pt-[calc(var(--nexus-safe-top)+3.5rem)]',
        'sm:pb-[max(2rem,var(--nexus-safe-bottom))]',
        'sm:pl-[max(2rem,env(safe-area-inset-left,0px))]',
        'sm:pr-[max(2rem,env(safe-area-inset-right,0px))]',
      )}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      onClick={onClose}
    >
      {!hideCloseButton ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            'absolute z-20 h-10 w-10 rounded-full',
            'right-[max(0.75rem,env(safe-area-inset-right,0px))]',
            'top-[calc(var(--nexus-safe-top)+0.5rem)]',
            'bg-black/55 text-white shadow-md backdrop-blur-md',
            'hover:bg-black/70 hover:text-white',
            'sm:right-[max(1.25rem,env(safe-area-inset-right,0px))]',
            'sm:top-[calc(var(--nexus-safe-top)+0.75rem)]',
          )}
          aria-label={closeLabel}
          onClick={(event) => {
            event.stopPropagation();
            onClose?.();
          }}
        >
          <X className="h-5 w-5" />
        </Button>
      ) : null}

      {controls}

      <div
        className={cn(
          'relative flex max-h-full max-w-full items-center justify-center',
          // Full-viewport stage for zoomable images (absolute inset-0 children).
          contentClassName
        )}
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}
