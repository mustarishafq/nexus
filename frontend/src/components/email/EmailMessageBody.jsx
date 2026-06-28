import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, ImageOff, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function EmailMessageBody({ html, text }) {
  const containerRef = useRef(null);
  const [imageStatus, setImageStatus] = useState({
    total: 0,
    loaded: 0,
    failed: 0,
    pending: 0,
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !html) {
      setImageStatus({ total: 0, loaded: 0, failed: 0, pending: 0 });
      return undefined;
    }

    const images = Array.from(container.querySelectorAll('img'));
    if (images.length === 0) {
      setImageStatus({ total: 0, loaded: 0, failed: 0, pending: 0 });
      return undefined;
    }

    let loaded = 0;
    let failed = 0;
    let pending = images.length;

    const update = () => {
      setImageStatus({
        total: images.length,
        loaded,
        failed,
        pending,
      });
    };

    const markLoaded = () => {
      loaded += 1;
      pending = Math.max(0, pending - 1);
      update();
    };

    const markFailed = (img) => {
      failed += 1;
      pending = Math.max(0, pending - 1);
      img.alt = img.alt || 'Image failed to load';
      img.classList.add('email-image-failed');
      update();
    };

    const listeners = images.map((img) => {
      if (img.complete) {
        if (img.naturalWidth > 0) {
          markLoaded();
        } else {
          markFailed(img);
        }
        return null;
      }

      const onLoad = () => markLoaded();
      const onError = () => markFailed(img);
      img.addEventListener('load', onLoad);
      img.addEventListener('error', onError);

      return () => {
        img.removeEventListener('load', onLoad);
        img.removeEventListener('error', onError);
      };
    });

    update();

    return () => {
      listeners.forEach((cleanup) => cleanup?.());
    };
  }, [html]);

  if (html) {
    const allLoaded = imageStatus.total > 0 && imageStatus.pending === 0 && imageStatus.failed === 0;
    const hasFailures = imageStatus.failed > 0;

    return (
      <div className="space-y-3">
        {imageStatus.total > 0 ? (
          <div
            className={cn(
              'flex items-center gap-2 rounded-lg border px-3 py-2 text-xs',
              hasFailures
                ? 'border-warning/40 bg-warning/10 text-warning'
                : allLoaded
                  ? 'border-border/60 bg-muted/30 text-muted-foreground'
                  : 'border-border/60 bg-muted/20 text-muted-foreground'
            )}
          >
            {imageStatus.pending > 0 ? (
              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
            ) : hasFailures ? (
              <ImageOff className="h-3.5 w-3.5 shrink-0" />
            ) : (
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 opacity-0" aria-hidden />
            )}
            <span>
              {imageStatus.pending > 0
                ? `Loading images (${imageStatus.loaded}/${imageStatus.total})...`
                : hasFailures
                  ? `${imageStatus.loaded} of ${imageStatus.total} images loaded (${imageStatus.failed} failed)`
                  : `${imageStatus.total} image${imageStatus.total === 1 ? '' : 's'} loaded`}
            </span>
          </div>
        ) : null}

        <div
          ref={containerRef}
          className={cn(
            'email-message-body max-w-none break-words text-sm leading-relaxed text-foreground',
            '[&_img]:my-3 [&_img]:max-h-[480px] [&_img]:max-w-full [&_img]:rounded-lg [&_img]:border [&_img]:border-border/60',
            '[&_img.email-image-failed]:border-dashed [&_img.email-image-failed]:opacity-50',
            '[&_a]:text-primary [&_a]:underline [&_p]:my-2'
          )}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    );
  }

  return (
    <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-foreground">
      {text || ''}
    </pre>
  );
}
