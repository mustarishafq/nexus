import React, { useCallback, useState } from 'react';
import { Loader2 } from 'lucide-react';
import MediaLightbox from '@/components/media/MediaLightbox';
import LightboxZoomableImage from '@/components/media/LightboxZoomableImage';
import { cn } from '@/lib/utils';

/** Photo or GIF shown under a comment's text. Photos open in the shared lightbox. */
export default function CommentAttachment({ attachment, className }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const close = useCallback(() => {
    setOpen(false);
    setLoading(true);
  }, []);

  if (!attachment?.url) return null;

  const isGif = attachment.type === 'gif';
  const hasSize = attachment.width > 0 && attachment.height > 0;

  const image = (
    <img
      src={attachment.url}
      alt={isGif ? 'GIF' : 'Comment photo'}
      loading="lazy"
      width={hasSize ? attachment.width : undefined}
      height={hasSize ? attachment.height : undefined}
      className="block max-h-60 w-auto max-w-full rounded-xl bg-muted object-contain"
      style={hasSize ? { aspectRatio: `${attachment.width} / ${attachment.height}` } : undefined}
    />
  );

  return (
    <div className={cn('mt-1.5 max-w-[16rem]', className)}>
      {isGif ? (
        image
      ) : (
        <>
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="View comment photo"
            className="block w-fit rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            {image}
          </button>

          <MediaLightbox
            open={open}
            onClose={close}
            ariaLabel="Comment photo preview"
            contentClassName="absolute inset-0 max-h-none max-w-none"
          >
            {loading ? (
              <div className="pointer-events-none absolute inset-0 z-[1] flex flex-col items-center justify-center gap-3 text-white/80">
                <Loader2 className="h-8 w-8 animate-spin" />
                <span className="text-sm">Loading photo…</span>
              </div>
            ) : null}

            <LightboxZoomableImage
              src={attachment.url}
              alt="Comment photo"
              className={cn(loading && 'invisible')}
              imgClassName="max-h-[min(82vh,720px)] max-w-[min(94vw,920px)] rounded-none"
              onDismiss={close}
              onLoad={() => setLoading(false)}
              onError={() => setLoading(false)}
            />
          </MediaLightbox>
        </>
      )}
    </div>
  );
}
