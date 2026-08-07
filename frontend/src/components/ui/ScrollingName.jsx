import React, { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * Single-line name that scrolls horizontally when it overflows the container.
 * Short names stay static; long names gently ping-pong so layout never breaks.
 */
export default function ScrollingName({
  name,
  className,
  textClassName,
  as: Tag = 'p',
  children = null,
}) {
  const containerRef = useRef(null);
  const textRef = useRef(null);
  const [overflowPx, setOverflowPx] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    const text = textRef.current;
    if (!container || !text) return undefined;

    const measure = () => {
      setOverflowPx(Math.max(0, Math.ceil(text.scrollWidth - container.clientWidth)));
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    observer.observe(text);
    return () => observer.disconnect();
  }, [name, children]);

  const shouldScroll = overflowPx > 4;
  const durationSec = Math.min(22, Math.max(10, overflowPx / 8));

  return (
    <div
      ref={containerRef}
      className={cn(
        'min-w-0 max-w-full overflow-hidden',
        shouldScroll && 'celebration-name-viewport',
        className
      )}
      title={typeof name === 'string' ? name : undefined}
    >
      <Tag
        ref={textRef}
        className={cn(
          'inline-block max-w-none whitespace-nowrap leading-tight',
          shouldScroll && 'celebration-name-track',
          textClassName
        )}
        style={
          shouldScroll
            ? {
                '--celebration-name-shift': `-${overflowPx}px`,
                animationDuration: `${durationSec}s`,
              }
            : undefined
        }
      >
        {children ?? name}
      </Tag>
    </div>
  );
}
