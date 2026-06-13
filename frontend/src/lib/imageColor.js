import { toCorsSafeUrl } from '@/lib/media';

export const DEFAULT_BRAND_COLOR = '#6366f1';

const colorCache = new Map();

function rgbToHex(r, g, b) {
  return `#${[r, g, b].map((value) => value.toString(16).padStart(2, '0')).join('')}`;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', () => reject(new Error('Failed to load image')));
    image.crossOrigin = 'anonymous';
    image.src = src;
  });
}

function readBackgroundColorFromImage(image) {
  const canvas = document.createElement('canvas');
  const size = 64;
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(image, 0, 0, size, size);

  const { data } = ctx.getImageData(0, 0, size, size);
  const buckets = new Map();

  for (let i = 0; i < data.length; i += 4) {
    const red = data[i];
    const green = data[i + 1];
    const blue = data[i + 2];
    const alpha = data[i + 3];

    if (alpha < 128) continue;

    const quantizedRed = Math.round(red / 16) * 16;
    const quantizedGreen = Math.round(green / 16) * 16;
    const quantizedBlue = Math.round(blue / 16) * 16;
    const key = `${quantizedRed},${quantizedGreen},${quantizedBlue}`;

    buckets.set(key, (buckets.get(key) || 0) + 1);
  }

  const ranked = [...buckets.entries()].sort((a, b) => b[1] - a[1]);

  for (const [key] of ranked) {
    const [red, green, blue] = key.split(',').map(Number);
    const brightness = Math.max(red, green, blue) / 255;

    if (brightness > 0.96) continue;

    return rgbToHex(red, green, blue);
  }

  if (ranked.length > 0) {
    const [red, green, blue] = ranked[0][0].split(',').map(Number);
    return rgbToHex(red, green, blue);
  }

  return DEFAULT_BRAND_COLOR;
}

export async function extractBackgroundColorFromImage(source) {
  const absoluteSource = typeof source === 'string' ? toCorsSafeUrl(source) : source;
  const cacheKey = typeof absoluteSource === 'string' ? `${absoluteSource}:bg-v2` : null;

  if (cacheKey && colorCache.has(cacheKey)) {
    return colorCache.get(cacheKey);
  }

  const image = typeof absoluteSource === 'string'
    ? await loadImage(absoluteSource)
    : absoluteSource;

  const color = readBackgroundColorFromImage(image);

  if (cacheKey) {
    colorCache.set(cacheKey, color);
  }

  return color;
}

export async function extractBackgroundColorFromFile(file) {
  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await loadImage(objectUrl);
    return readBackgroundColorFromImage(image);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function extractDominantColorFromImage(source) {
  return extractBackgroundColorFromImage(source);
}

export async function extractDominantColorFromFile(file) {
  return extractBackgroundColorFromFile(file);
}
