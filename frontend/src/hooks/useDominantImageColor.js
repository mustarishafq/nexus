import { useEffect, useState } from 'react';
import { DEFAULT_BRAND_COLOR, extractBackgroundColorFromImage } from '@/lib/imageColor';
import { toAbsoluteUrl } from '@/lib/media';

export default function useDominantImageColor(imageUrl, fallbackColor = DEFAULT_BRAND_COLOR) {
  const [color, setColor] = useState(fallbackColor || DEFAULT_BRAND_COLOR);

  useEffect(() => {
    if (!imageUrl) {
      setColor(fallbackColor || DEFAULT_BRAND_COLOR);
      return undefined;
    }

    let cancelled = false;

    extractBackgroundColorFromImage(toAbsoluteUrl(imageUrl))
      .then((extractedColor) => {
        if (!cancelled) {
          setColor(extractedColor);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setColor(fallbackColor || DEFAULT_BRAND_COLOR);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [imageUrl, fallbackColor]);

  return color;
}
