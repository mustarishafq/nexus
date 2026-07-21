const API_ORIGIN = `${import.meta.env.VITE_API_BASE_URL || ''}`.replace(/\/$/, '');

// Crop target for uploads (wide desktop banner).
export const COVER_PHOTO_ASPECT = 4 / 1;

// Mobile dashboard cover display ratio.
export const COVER_PHOTO_MOBILE_ASPECT = 3 / 2;

// Center strip of the desktop crop visible on mobile (object-cover, object-center).
export const COVER_PHOTO_MOBILE_VISIBLE_WIDTH_RATIO = 3 / 8;

// Taller display on narrow screens so the cover dominates the hero.
export const COVER_PHOTO_DISPLAY_ASPECT = 'aspect-[3/2] sm:aspect-[5/2] lg:aspect-[4/1]';

export const IMAGE_EXPORT_QUALITY = 0.97;
export const COVER_PHOTO_MAX_WIDTH = 3200;
export const PROFILE_PHOTO_MAX_SIZE = 1200;

export function toAbsoluteUrl(url) {
  if (!url) return '';
  if (/^https?:\/\//i.test(url) || url.startsWith('data:') || url.startsWith('blob:')) {
    return url;
  }

  if (!API_ORIGIN) return url;

  return url.startsWith('/') ? `${API_ORIGIN}${url}` : `${API_ORIGIN}/${url}`;
}

function createImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.src = url;
  });
}

/**
 * Default centered percentage crop for a given aspect ratio inside an image.
 * @returns {{ x: number, y: number, width: number, height: number }}
 */
export function getCenteredCoverCrop(imageWidth, imageHeight, aspect) {
  const imageAspect = imageWidth / imageHeight;

  if (imageAspect > aspect) {
    const width = (aspect / imageAspect) * 100;
    return {
      x: (100 - width) / 2,
      y: 0,
      width,
      height: 100,
    };
  }

  const height = (imageAspect / aspect) * 100;
  return {
    x: 0,
    y: (100 - height) / 2,
    width: 100,
    height,
  };
}

/** Clamp helpers matching API crop validation (±100…200 range). */
const CROP_COORD_MIN = -100;
const CROP_COORD_MAX = 200;
const CROP_SIZE_MIN = 0.01;
const CROP_SIZE_MAX = 200;

/**
 * Normalize cropper output. Zoom-out may use negative coords / sizes over 100 —
 * those are preserved so display can match the cropper (padded fit).
 * @returns {{ x: number, y: number, width: number, height: number } | null}
 */
export function normalizeMediaCropArea(area) {
  if (!area || typeof area !== 'object') {
    return null;
  }

  const x = Number(area.x);
  const y = Number(area.y);
  const width = Number(area.width);
  const height = Number(area.height);

  if (![x, y, width, height].every(Number.isFinite)) {
    return null;
  }

  return {
    x: Math.min(Math.max(x, CROP_COORD_MIN), CROP_COORD_MAX),
    y: Math.min(Math.max(y, CROP_COORD_MIN), CROP_COORD_MAX),
    width: Math.min(Math.max(width, CROP_SIZE_MIN), CROP_SIZE_MAX),
    height: Math.min(Math.max(height, CROP_SIZE_MIN), CROP_SIZE_MAX),
  };
}

function isExactFullImageCrop(crop) {
  return (
    Math.abs(crop.x) < 0.5 &&
    Math.abs(crop.y) < 0.5 &&
    crop.width >= 99.5 &&
    crop.width <= 100.5 &&
    crop.height >= 99.5 &&
    crop.height <= 100.5
  );
}

/**
 * CSS background framing so a percentage crop fills a cover container.
 * The full image URL stays intact for lightbox/full preview.
 * Supports zoom-out crops (negative x/y or width/height &gt; 100).
 *
 * @param {string} imageUrl
 * @param {{ x: number, y: number, width: number, height: number } | null | undefined} crop
 * @param {{ fullImageFit?: 'contain' | 'cover' }} [options]
 *   fullImageFit — how to frame an exact 100×100% crop.
 *   Use 'contain' for banners (show entire image). Use 'cover' for circular
 *   avatars so a full-bleed square source fills the circle.
 */
export function getCoverCropBackgroundStyle(imageUrl, crop, { fullImageFit = 'contain' } = {}) {
  if (!imageUrl) return {};

  const normalized = normalizeMediaCropArea(crop) || crop;

  if (!normalized?.width || !normalized?.height) {
    return {
      backgroundImage: `url(${imageUrl})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
    };
  }

  if (isExactFullImageCrop(normalized)) {
    return {
      backgroundImage: `url(${imageUrl})`,
      backgroundSize: fullImageFit === 'cover' ? 'cover' : 'contain',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
    };
  }

  const { x, y, width, height } = normalized;
  const sizeX = 100 / (width / 100);
  const sizeY = 100 / (height / 100);
  const posX = Math.abs(width - 100) < 0.01 ? 50 : (x / (100 - width)) * 100;
  const posY = Math.abs(height - 100) < 0.01 ? 50 : (y / (100 - height)) * 100;

  return {
    backgroundImage: `url(${imageUrl})`,
    backgroundSize: `${sizeX}% ${sizeY}%`,
    backgroundPosition: `${posX}% ${posY}%`,
    backgroundRepeat: 'no-repeat',
  };
}

export async function getCoverDisplayPreviewDataUrl(
  imageSrc,
  cropPercentages,
  displayAspect = COVER_PHOTO_MOBILE_ASPECT,
  outputWidth = 320
) {
  const image = await createImage(imageSrc);
  const crop = cropPercentages || getCenteredCoverCrop(image.naturalWidth, image.naturalHeight, displayAspect);

  const srcX = (crop.x / 100) * image.naturalWidth;
  const srcY = (crop.y / 100) * image.naturalHeight;
  const srcWidth = (crop.width / 100) * image.naturalWidth;
  const srcHeight = (crop.height / 100) * image.naturalHeight;
  const outputHeight = Math.round(outputWidth / displayAspect);

  const outputCanvas = document.createElement('canvas');
  const outputCtx = outputCanvas.getContext('2d');
  outputCanvas.width = outputWidth;
  outputCanvas.height = outputHeight;
  outputCtx.drawImage(
    image,
    srcX,
    srcY,
    srcWidth,
    srcHeight,
    0,
    0,
    outputWidth,
    outputHeight
  );

  return outputCanvas.toDataURL('image/jpeg', 0.9);
}

function resolveNaturalPixelCrop(image, cropArea = {}) {
  const { percentages, pixels } = cropArea;

  if (percentages) {
    return {
      x: Math.round((percentages.x / 100) * image.naturalWidth),
      y: Math.round((percentages.y / 100) * image.naturalHeight),
      width: Math.round((percentages.width / 100) * image.naturalWidth),
      height: Math.round((percentages.height / 100) * image.naturalHeight),
    };
  }

  if (pixels) {
    return {
      x: Math.round(pixels.x),
      y: Math.round(pixels.y),
      width: Math.round(pixels.width),
      height: Math.round(pixels.height),
    };
  }

  throw new Error('Crop area is required.');
}

function getOutputDimensions(width, height, { maxWidth, maxHeight } = {}) {
  let outWidth = width;
  let outHeight = height;

  if (maxWidth && outWidth > maxWidth) {
    const scale = maxWidth / outWidth;
    outWidth = maxWidth;
    outHeight = Math.round(outHeight * scale);
  }

  if (maxHeight && outHeight > maxHeight) {
    const scale = maxHeight / outHeight;
    outHeight = maxHeight;
    outWidth = Math.round(outWidth * scale);
  }

  return { outWidth, outHeight };
}

/** Resize full image without cropping — used so lightbox can show the original. */
export async function getResizedImageBlob(
  imageSrc,
  {
    mimeType = 'image/jpeg',
    quality = IMAGE_EXPORT_QUALITY,
    maxWidth,
    maxHeight,
  } = {}
) {
  const image = await createImage(imageSrc);
  const { outWidth, outHeight } = getOutputDimensions(image.naturalWidth, image.naturalHeight, {
    maxWidth,
    maxHeight,
  });

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = outWidth;
  canvas.height = outHeight;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, 0, 0, outWidth, outHeight);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Failed to process image.'));
          return;
        }
        resolve(blob);
      },
      mimeType,
      quality
    );
  });
}

export async function getCroppedImageBlob(
  imageSrc,
  cropArea,
  {
    mimeType = 'image/jpeg',
    quality = IMAGE_EXPORT_QUALITY,
    maxWidth,
    maxHeight,
  } = {}
) {
  const image = await createImage(imageSrc);
  const pixelCrop = resolveNaturalPixelCrop(image, cropArea);
  const { outWidth, outHeight } = getOutputDimensions(pixelCrop.width, pixelCrop.height, {
    maxWidth,
    maxHeight,
  });

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = outWidth;
  canvas.height = outHeight;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    outWidth,
    outHeight
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Failed to crop image.'));
          return;
        }
        resolve(blob);
      },
      mimeType,
      quality
    );
  });
}
