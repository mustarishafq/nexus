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

/** Long-edge cap for feed photos — sharp on retina, far below typical camera megapixels. */
export const POST_IMAGE_MAX_EDGE = 2560;
/** JPEG quality ≈ visually lossless for photos; still much smaller than phone originals. */
export const POST_IMAGE_QUALITY = 0.92;
export const POST_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const POST_IMAGE_SOURCE_MAX_BYTES = 40 * 1024 * 1024;

/** Square quiz question images: sharp on play screens, small on disk. */
export const QUIZ_QUESTION_IMAGE_MAX_EDGE = 1080;
export const QUIZ_QUESTION_IMAGE_QUALITY = 0.82;
export const QUIZ_QUESTION_IMAGE_MAX_BYTES = 1 * 1024 * 1024;
export const QUIZ_QUESTION_IMAGE_SOURCE_MAX_BYTES = 10 * 1024 * 1024;

/**
 * Public disk files are served at /storage/..., never under /api.
 * Upload responses may be relative or absolute (APP_URL) — canonicalize the path.
 */
export function extractPublicStoragePath(url) {
  if (!url || typeof url !== 'string') return null;

  const trimmed = url.trim();
  if (!trimmed) return null;

  let pathname = trimmed;
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      pathname = new URL(trimmed).pathname || '';
    } catch {
      return null;
    }
  } else if (!trimmed.startsWith('/')) {
    pathname = `/${trimmed}`;
  }

  const marker = '/storage/';
  const index = pathname.indexOf(marker);
  if (index === -1) return null;

  return pathname.slice(index);
}

function publicAssetOrigin() {
  if (API_ORIGIN && /^https?:\/\//i.test(API_ORIGIN)) {
    try {
      return new URL(API_ORIGIN).origin;
    } catch {
      // Fall through to the current page origin.
    }
  }

  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }

  return '';
}

/** Resolve profile, cover, quiz, and other public-disk URLs for <img src>. */
export function toPublicFileUrl(url) {
  if (!url) return '';
  if (url.startsWith('data:') || url.startsWith('blob:')) return url;

  const storagePath = extractPublicStoragePath(url);
  if (storagePath) {
    const origin = publicAssetOrigin();
    return origin ? `${origin}${storagePath}` : storagePath;
  }

  return toAbsoluteUrl(url);
}

export function toAbsoluteUrl(url) {
  if (!url) return '';
  if (url.startsWith('data:') || url.startsWith('blob:')) return url;

  const storagePath = extractPublicStoragePath(url);
  if (storagePath) {
    return toPublicFileUrl(url);
  }

  if (/^https?:\/\//i.test(url)) {
    return url;
  }

  if (!API_ORIGIN) return url.startsWith('/') ? url : `/${url}`;

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
      backgroundImage: `url(${JSON.stringify(imageUrl)})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
    };
  }

  if (isExactFullImageCrop(normalized)) {
    return {
      backgroundImage: `url(${JSON.stringify(imageUrl)})`,
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
    backgroundImage: `url(${JSON.stringify(imageUrl)})`,
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

function isFiniteArea(area) {
  if (!area || typeof area !== 'object') return false;
  return ['x', 'y', 'width', 'height'].every((key) => Number.isFinite(Number(area[key])));
}

/**
 * Accept react-easy-crop output, a flat percentage box, or { percentages, pixels }.
 * @returns {{ percentages: { x: number, y: number, width: number, height: number } | null, pixels: { x: number, y: number, width: number, height: number } | null } | null}
 */
export function toExportCropArea(cropArea) {
  if (!cropArea || typeof cropArea !== 'object') return null;

  if (cropArea.percentages || cropArea.pixels) {
    const percentages = cropArea.percentages ? normalizeMediaCropArea(cropArea.percentages) : null;
    const pixels = isFiniteArea(cropArea.pixels)
      ? {
          x: Number(cropArea.pixels.x),
          y: Number(cropArea.pixels.y),
          width: Number(cropArea.pixels.width),
          height: Number(cropArea.pixels.height),
        }
      : null;
    if (!percentages && !pixels) return null;
    return { percentages, pixels };
  }

  const percentages = normalizeMediaCropArea(cropArea);
  return percentages ? { percentages, pixels: null } : null;
}

function resolveNaturalPixelCrop(image, cropArea = {}) {
  const normalized = toExportCropArea(cropArea);
  if (!normalized) {
    throw new Error('Crop area is required.');
  }

  if (normalized.pixels && normalized.pixels.width > 0 && normalized.pixels.height > 0) {
    return {
      x: Math.round(normalized.pixels.x),
      y: Math.round(normalized.pixels.y),
      width: Math.round(normalized.pixels.width),
      height: Math.round(normalized.pixels.height),
    };
  }

  if (normalized.percentages) {
    return {
      x: Math.round((normalized.percentages.x / 100) * image.naturalWidth),
      y: Math.round((normalized.percentages.y / 100) * image.naturalHeight),
      width: Math.round((normalized.percentages.width / 100) * image.naturalWidth),
      height: Math.round((normalized.percentages.height / 100) * image.naturalHeight),
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

  return canvasToBlob(canvas, mimeType, quality);
}

function canvasToBlob(canvas, mimeType, quality) {
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

function isGifFile(file) {
  const type = String(file?.type || '').toLowerCase();
  return type === 'image/gif' || /\.gif$/i.test(file?.name || '');
}

function toJpegFileName(name) {
  const base = String(name || 'image').replace(/\.[^.]+$/, '').trim() || 'image';
  return `${base}.jpg`;
}

async function decodeImageSource(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      return {
        bitmap: await createImageBitmap(file, { imageOrientation: 'from-image' }),
        objectUrl: null,
      };
    } catch {
      try {
        return { bitmap: await createImageBitmap(file), objectUrl: null };
      } catch {
        // Fall through to HTMLImageElement (HEIC on some browsers).
      }
    }
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    return { bitmap: await createImage(objectUrl), objectUrl };
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
}

function sourcePixelSize(image) {
  return {
    width: image.naturalWidth || image.width || 0,
    height: image.naturalHeight || image.height || 0,
  };
}

/**
 * Re-encode a feed photo at high quality before upload.
 * Animated GIFs are left as-is. If the result is not smaller, the original file is kept.
 */
export async function compressImageFile(
  file,
  {
    maxEdge = POST_IMAGE_MAX_EDGE,
    quality = POST_IMAGE_QUALITY,
  } = {}
) {
  if (!file || isGifFile(file)) {
    return file;
  }

  let bitmap = null;
  let objectUrl = null;

  try {
    ({ bitmap, objectUrl } = await decodeImageSource(file));
    const { width, height } = sourcePixelSize(bitmap);
    if (!width || !height) {
      return file;
    }

    const { outWidth, outHeight } = getOutputDimensions(width, height, {
      maxWidth: maxEdge,
      maxHeight: maxEdge,
    });

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return file;
    }

    canvas.width = outWidth;
    canvas.height = outHeight;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, outWidth, outHeight);
    ctx.drawImage(bitmap, 0, 0, outWidth, outHeight);

    const blob = await canvasToBlob(canvas, 'image/jpeg', quality);
    const didDownscale = outWidth < width || outHeight < height;
    if (!didDownscale && blob.size >= file.size) {
      return file;
    }

    return new File([blob], toJpegFileName(file.name), {
      type: 'image/jpeg',
      lastModified: Date.now(),
    });
  } catch {
    return file;
  } finally {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
    }
    if (bitmap && typeof bitmap.close === 'function') {
      bitmap.close();
    }
  }
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
  const cropWidth = Math.max(1, pixelCrop.width);
  const cropHeight = Math.max(1, pixelCrop.height);
  const { outWidth, outHeight } = getOutputDimensions(cropWidth, cropHeight, {
    maxWidth,
    maxHeight,
  });

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = outWidth;
  canvas.height = outHeight;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, outWidth, outHeight);

  const imageWidth = image.naturalWidth || image.width || 0;
  const imageHeight = image.naturalHeight || image.height || 0;
  const srcX = Math.max(0, pixelCrop.x);
  const srcY = Math.max(0, pixelCrop.y);
  const srcRight = Math.min(imageWidth, pixelCrop.x + cropWidth);
  const srcBottom = Math.min(imageHeight, pixelCrop.y + cropHeight);
  const srcWidth = srcRight - srcX;
  const srcHeight = srcBottom - srcY;

  if (srcWidth > 0 && srcHeight > 0) {
    ctx.drawImage(
      image,
      srcX,
      srcY,
      srcWidth,
      srcHeight,
      ((srcX - pixelCrop.x) / cropWidth) * outWidth,
      ((srcY - pixelCrop.y) / cropHeight) * outHeight,
      (srcWidth / cropWidth) * outWidth,
      (srcHeight / cropHeight) * outHeight,
    );
  }

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

export async function exportQuizQuestionImage(imageSrc, cropArea) {
  let quality = QUIZ_QUESTION_IMAGE_QUALITY;
  let blob = await getCroppedImageBlob(imageSrc, cropArea, {
    mimeType: 'image/jpeg',
    quality,
    maxWidth: QUIZ_QUESTION_IMAGE_MAX_EDGE,
    maxHeight: QUIZ_QUESTION_IMAGE_MAX_EDGE,
  });

  while (blob.size > QUIZ_QUESTION_IMAGE_MAX_BYTES && quality > 0.5) {
    quality = Math.max(0.5, quality - 0.08);
    blob = await getCroppedImageBlob(imageSrc, cropArea, {
      mimeType: 'image/jpeg',
      quality,
      maxWidth: QUIZ_QUESTION_IMAGE_MAX_EDGE,
      maxHeight: QUIZ_QUESTION_IMAGE_MAX_EDGE,
    });
  }

  if (blob.size > QUIZ_QUESTION_IMAGE_MAX_BYTES) {
    throw new Error('Image is still too large after compression. Try a simpler photo.');
  }

  return new File([blob], 'quiz-question.jpg', {
    type: 'image/jpeg',
    lastModified: Date.now(),
  });
}
