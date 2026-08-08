// @ts-nocheck
import React, { useCallback, useState } from 'react';
import { Eye, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import MediaLightbox from '@/components/media/MediaLightbox';
import LightboxZoomableImage from '@/components/media/LightboxZoomableImage';
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
        contentClassName="absolute inset-0 max-h-none max-w-none"
      >
        {loading && !error ? (
          <div className="pointer-events-none absolute inset-0 z-[1] flex flex-col items-center justify-center gap-3 text-white/80">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="text-sm">Loading photo…</span>
          </div>
        ) : null}

        {error ? (
          <div className="absolute inset-0 z-[1] flex items-center justify-center p-6">
            <div className="rounded-2xl bg-white/10 px-6 py-16 text-center text-sm text-white/80">
              {error}
            </div>
          </div>
        ) : null}

        <LightboxZoomableImage
          src={photoUrl}
          alt="Attendance photo"
          className={cn((loading || error) && 'invisible')}
          imgClassName="max-h-[min(72vh,540px)] max-w-[min(90vw,440px)] rounded-2xl shadow-2xl sm:max-w-[min(78vw,520px)]"
          onDismiss={close}
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
