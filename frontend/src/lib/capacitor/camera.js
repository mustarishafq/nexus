import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { isNativePlatform } from '@/lib/capacitor/platform';

async function webPathToFile(webPath, format, fallbackName) {
  const response = await fetch(webPath);
  const blob = await response.blob();
  const ext = format || 'jpeg';
  return new File([blob], `${fallbackName}.${ext}`, { type: blob.type || `image/${ext}` });
}

/**
 * Opens the native camera and returns a File, matching what an
 * <input type="file"> change event would give existing upload code
 * (e.g. db.integrations.Core.UploadFile({ file })). No-op web fallback
 * is the caller's existing <input type="file"> — only call this when
 * isNativePlatform() is true.
 */
export async function capturePhoto({ fileName = `photo-${Date.now()}` } = {}) {
  const photo = await Camera.getPhoto({
    resultType: CameraResultType.Uri,
    source: CameraSource.Camera,
    quality: 85,
    allowEditing: false,
  });

  return webPathToFile(photo.webPath, photo.format, fileName);
}

/** Opens the native photo library picker and returns a File. */
export async function pickPhoto({ fileName = `photo-${Date.now()}` } = {}) {
  const photo = await Camera.getPhoto({
    resultType: CameraResultType.Uri,
    source: CameraSource.Photos,
    quality: 85,
    allowEditing: false,
  });

  return webPathToFile(photo.webPath, photo.format, fileName);
}

export function isCameraSupported() {
  return isNativePlatform();
}
