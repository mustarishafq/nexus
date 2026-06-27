// @ts-nocheck
import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Eye, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toAbsoluteUrl } from '@/lib/media';
import { cn } from '@/lib/utils';

export default function AttendancePhotoViewer({ record, className, buttonClassName }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const photoUrl = toAbsoluteUrl(record?.photo_url);

  const close = useCallback(() => {
    setOpen(false);
    setLoading(true);
    setError('');
  }, []);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        close();
      }
    };

    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [close, open]);

  if (!photoUrl) {
    return <span className="text-muted-foreground">—</span>;
  }

  const lightbox = open ? createPortal(
    <div
      className={cn(
        'fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8',
        'bg-black/80 backdrop-blur-md',
        'animate-in fade-in-0 duration-200',
      )}
      role="dialog"
      aria-modal="true"
      aria-label="Attendance photo preview"
      onClick={close}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn(
          'absolute right-3 top-3 z-10 h-10 w-10 rounded-full',
          'text-white/90 hover:bg-white/10 hover:text-white',
          'sm:right-5 sm:top-5',
        )}
        aria-label="Close photo preview"
        onClick={(event) => {
          event.stopPropagation();
          close();
        }}
      >
        <X className="h-5 w-5" />
      </Button>

      <div
        className="relative flex max-h-full max-w-full items-center justify-center"
        onClick={(event) => event.stopPropagation()}
      >
        {loading && !error ? (
          <div className="flex flex-col items-center gap-3 py-20 text-white/80">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="text-sm">Loading photo…</span>
          </div>
        ) : null}

        {error ? (
          <div className="rounded-2xl bg-white/10 px-6 py-16 text-center text-sm text-white/80">
            {error}
          </div>
        ) : null}

        <img
          src={photoUrl}
          alt="Attendance photo"
          className={cn(
            'max-h-[min(72vh,540px)] max-w-[min(90vw,440px)] sm:max-w-[min(78vw,520px)] rounded-2xl object-contain shadow-2xl',
            (loading || error) && 'hidden',
          )}
          onLoad={() => setLoading(false)}
          onError={() => {
            setLoading(false);
            setError('Unable to load attendance photo.');
          }}
        />
      </div>
    </div>,
    document.body,
  ) : null;

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn('h-8 w-8 shrink-0', buttonClassName, className)}
        aria-label="View attendance photo"
        onClick={() => {
          setLoading(true);
          setError('');
          setOpen(true);
        }}
      >
        <Eye className="h-4 w-4" />
      </Button>

      {lightbox}
    </>
  );
}
