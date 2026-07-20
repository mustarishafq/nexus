// @ts-nocheck
import React, { useCallback, useState } from 'react';
import { Eye, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import MediaLightbox from '@/components/media/MediaLightbox';
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

  if (!photoUrl) {
    return <span className="text-muted-foreground">—</span>;
  }

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

      <MediaLightbox
        open={open}
        onClose={close}
        ariaLabel="Attendance photo preview"
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
      </MediaLightbox>
    </>
  );
}
