import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { isNativePlatform } from '@/lib/capacitor/platform';
import { getAuthToken } from '@/lib/authStorage';

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Downloads a file from the API and saves it into native app storage, then
 * opens the OS share sheet so the user can save/open it with another app.
 * Web keeps using the existing <a download> blob-link pattern unchanged
 * (see db.attendance.exportCsv / db.networkHealth.exportCsv) — only call
 * this on native platforms.
 */
export async function downloadAndShareFile(url, filename, { headers = {} } = {}) {
  if (!isNativePlatform()) {
    throw new Error('downloadAndShareFile is native-only; use the existing web download path.');
  }

  const token = getAuthToken();
  const response = await fetch(url, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Download failed: HTTP ${response.status}`);
  }

  const blob = await response.blob();
  const base64Data = await blobToBase64(blob);

  const writeResult = await Filesystem.writeFile({
    path: filename,
    data: base64Data,
    directory: Directory.Cache,
    recursive: true,
  });

  await Share.share({
    title: filename,
    url: writeResult.uri,
  });

  return writeResult.uri;
}
