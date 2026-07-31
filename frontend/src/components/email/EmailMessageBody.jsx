import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AlertTriangle, ImageOff, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const LIGHT_TEXT = '#f3f4f6';
const DARK_TEXT = '#1f2937';

function parseCssRgb(color) {
  if (!color || color === 'transparent') return null;
  const match = color.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)/i);
  if (!match) return null;
  const alpha = match[4] === undefined ? 1 : Number(match[4]);
  if (Number.isNaN(alpha) || alpha < 0.5) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function relativeLuminance([r, g, b]) {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/**
 * Theme-colored email text is forced via CSS for dark-mode readability, but
 * many HTML emails paint their own light (or dark) surfaces. Re-tint text on
 * those surfaces so contrast stays readable.
 */
function applySurfaceContrast(root) {
  const nodes = [root, ...root.querySelectorAll('*')];

  nodes.forEach((el) => {
    if (el.tagName === 'A' || el.closest?.('a')) return;

    const bg = parseCssRgb(getComputedStyle(el).backgroundColor);
    if (!bg) return;

    const luminance = relativeLuminance(bg);
    if (luminance >= 0.55) {
      el.style.setProperty('color', DARK_TEXT, 'important');
    } else if (luminance <= 0.35) {
      el.style.setProperty('color', LIGHT_TEXT, 'important');
    }
  });
}

export default function EmailMessageBody({ html, text }) {
  const containerRef = useRef(null);
  const [imageStatus, setImageStatus] = useState({
    total: 0,
    loaded: 0,
    failed: 0,
    pending: 0,
  });

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container || !html) return;
    applySurfaceContrast(container);
  }, [html]);

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
            'email-message-body max-w-none break-words text-sm leading-relaxed',
            '[&_img]:my-3 [&_img]:max-h-[480px] [&_img]:max-w-full [&_img]:rounded-lg [&_img]:border [&_img]:border-border/60',
            '[&_img.email-image-failed]:border-dashed [&_img.email-image-failed]:opacity-50',
            '[&_a]:underline [&_p]:my-2'
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
