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

export async function getCoverDisplayPreviewDataUrl(
  imageSrc,
  desktopCrop,
  displayAspect = COVER_PHOTO_MOBILE_ASPECT,
  outputWidth = 320
) {
  const image = await createImage(imageSrc);
  const desktopCanvas = document.createElement('canvas');
  const desktopCtx = desktopCanvas.getContext('2d');

  desktopCanvas.width = desktopCrop.width;
  desktopCanvas.height = desktopCrop.height;
  desktopCtx.drawImage(
    image,
    desktopCrop.x,
    desktopCrop.y,
    desktopCrop.width,
    desktopCrop.height,
    0,
    0,
    desktopCrop.width,
    desktopCrop.height
  );

  const srcWidth = desktopCrop.width;
  const srcHeight = desktopCrop.height;
  const srcAspect = srcWidth / srcHeight;
  const outputHeight = Math.round(outputWidth / displayAspect);

  let cropX = 0;
  let cropY = 0;
  let cropWidth = srcWidth;
  let cropHeight = srcHeight;

  if (srcAspect > displayAspect) {
    cropWidth = srcHeight * displayAspect;
    cropX = (srcWidth - cropWidth) / 2;
  } else if (srcAspect < displayAspect) {
    cropHeight = srcWidth / displayAspect;
    cropY = (srcHeight - cropHeight) / 2;
  }

  const outputCanvas = document.createElement('canvas');
  const outputCtx = outputCanvas.getContext('2d');
  outputCanvas.width = outputWidth;
  outputCanvas.height = outputHeight;
  outputCtx.drawImage(
    desktopCanvas,
    cropX,
    cropY,
    cropWidth,
    cropHeight,
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
