import React, { useCallback, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import MediaLightbox from '@/components/media/MediaLightbox';
import { cn } from '@/lib/utils';
import { toAbsoluteUrl } from '@/lib/media';

function resolveImageUrls(item) {
  if (Array.isArray(item?.image_urls) && item.image_urls.length > 0) {
    return item.image_urls.filter(Boolean);
  }
  if (item?.image_url) {
    return [item.image_url];
  }
  return [];
}

function GridCell({ src, alt, className, onClick, overlayLabel = null }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'relative block h-full w-full overflow-hidden bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
        className
      )}
    >
      <img
        src={toAbsoluteUrl(src)}
        alt={alt}
        className="h-full w-full object-cover"
        loading="lazy"
      />
      {overlayLabel ? (
        <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-2xl font-semibold text-white sm:text-3xl">
          {overlayLabel}
        </span>
      ) : null}
    </button>
  );
}

function SquareFrame({ children, className }) {
  return (
    <div className={cn('relative w-full', className)} style={{ paddingBottom: '100%' }}>
      <div className="absolute inset-0">{children}</div>
    </div>
  );
}

export default function PostImageGrid({ item, className }) {
  const images = resolveImageUrls(item);
  const [viewerIndex, setViewerIndex] = useState(null);
  const [loading, setLoading] = useState(true);
  const count = images.length;
  const isOpen = viewerIndex !== null;

  const close = useCallback(() => {
    setViewerIndex(null);
    setLoading(true);
  }, []);

  const showPrevious = useCallback(() => {
    setViewerIndex((current) => (current === null ? current : (current - 1 + count) % count));
    setLoading(true);
  }, [count]);

  const showNext = useCallback(() => {
    setViewerIndex((current) => (current === null ? current : (current + 1) % count));
    setLoading(true);
  }, [count]);

  const onKeyDown = useCallback(
    (event) => {
      if (event.key === 'ArrowRight' && count > 1) {
        event.preventDefault();
        showNext();
      } else if (event.key === 'ArrowLeft' && count > 1) {
        event.preventDefault();
        showPrevious();
      }
    },
    [count, showNext, showPrevious]
  );

  if (count === 0) {
    return null;
  }

  const openAt = (index) => {
    setLoading(true);
    setViewerIndex(index);
  };

  const visibleCount = Math.min(count, 4);
  const overflow = count > 4 ? count - 4 : 0;

  return (
    <>
      <div
        className={cn(
          'w-full overflow-hidden rounded-xl border border-border/50 bg-muted/20',
          className
        )}
      >
        {count === 1 ? (
          <SquareFrame>
            <GridCell
              src={images[0]}
              alt="Post attachment"
              className="h-full"
              onClick={() => openAt(0)}
            />
          </SquareFrame>
        ) : null}

        {count === 2 ? (
          <div className="grid w-full grid-cols-2 gap-0.5">
            {images.map((src, index) => (
              <SquareFrame key={`${src}-${index}`}>
                <GridCell
                  src={src}
                  alt={`Post attachment ${index + 1}`}
                  className="h-full"
                  onClick={() => openAt(index)}
                />
              </SquareFrame>
            ))}
          </div>
        ) : null}

        {count === 3 ? (
          <div className="grid w-full grid-cols-2 gap-0.5">
            <div className="relative row-span-2 w-full" style={{ paddingBottom: '200%' }}>
              <div className="absolute inset-0">
                <GridCell
                  src={images[0]}
                  alt="Post attachment 1"
                  className="h-full"
                  onClick={() => openAt(0)}
                />
              </div>
            </div>
            <SquareFrame>
              <GridCell src={images[1]} alt="Post attachment 2" className="h-full" onClick={() => openAt(1)} />
            </SquareFrame>
            <SquareFrame>
              <GridCell src={images[2]} alt="Post attachment 3" className="h-full" onClick={() => openAt(2)} />
            </SquareFrame>
          </div>
        ) : null}

        {count >= 4 ? (
          <div className="grid w-full grid-cols-2 gap-0.5">
            {images.slice(0, visibleCount).map((src, index) => (
              <SquareFrame key={`${src}-${index}`}>
                <GridCell
                  src={src}
                  alt={`Post attachment ${index + 1}`}
                  className="h-full"
                  onClick={() => openAt(index)}
                  overlayLabel={index === 3 && overflow > 0 ? `+${overflow}` : null}
                />
              </SquareFrame>
            ))}
          </div>
        ) : null}
      </div>

      <MediaLightbox
        open={isOpen}
        onClose={close}
        ariaLabel="Post photo preview"
        onKeyDown={onKeyDown}
        contentClassName="flex-col"
        controls={
          count > 1 ? (
            <>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={cn(
                  'absolute left-3 top-1/2 z-10 h-10 w-10 -translate-y-1/2 rounded-full sm:left-5',
                  'text-white/90 hover:bg-white/10 hover:text-white'
                )}
                aria-label="Previous photo"
                onClick={(event) => {
                  event.stopPropagation();
                  showPrevious();
                }}
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={cn(
                  'absolute right-3 top-1/2 z-10 h-10 w-10 -translate-y-1/2 rounded-full sm:right-5',
                  'text-white/90 hover:bg-white/10 hover:text-white'
                )}
                aria-label="Next photo"
                onClick={(event) => {
                  event.stopPropagation();
                  showNext();
                }}
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </>
          ) : null
        }
      >
        {loading ? (
          <div className="flex flex-col items-center gap-3 py-20 text-white/80">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="text-sm">Loading photo…</span>
          </div>
        ) : null}

        <img
          key={images[viewerIndex]}
          src={toAbsoluteUrl(images[viewerIndex])}
          alt={`Post attachment ${viewerIndex + 1}`}
          className={cn(
            'max-h-[min(82vh,720px)] max-w-[min(94vw,920px)] rounded-2xl object-contain shadow-2xl',
            loading && 'hidden'
          )}
          onLoad={() => setLoading(false)}
          onError={() => setLoading(false)}
        />

        {count > 1 && !loading ? (
          <p className="mt-4 rounded-full bg-black/50 px-3 py-1 text-xs text-white/90">
            {viewerIndex + 1} / {count}
          </p>
        ) : null}
      </MediaLightbox>
    </>
  );
}
