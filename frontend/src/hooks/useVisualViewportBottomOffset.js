import { useEffect, useState } from 'react';

/**
 * Pins `position: fixed` bottom UI to the *visual* viewport.
 * iOS Safari's collapsing URL/toolbars change the visual viewport while the
 * layout viewport stays tall — without this offset the dock floats mid-screen
 * or leaves a large gap above the browser chrome.
 */
export function useVisualViewportBottomOffset() {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return undefined;

    let frame = 0;

    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const next = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
        setOffset((prev) => (prev === next ? prev : next));
      });
    };

    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    window.addEventListener('resize', update);

    return () => {
      cancelAnimationFrame(frame);
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  return offset;
}
