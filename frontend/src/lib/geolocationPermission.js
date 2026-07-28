export function isGeolocationSupported() {
  return typeof navigator !== 'undefined' && 'geolocation' in navigator;
}

/**
 * @returns {Promise<'granted' | 'denied' | 'prompt' | 'unknown'>}
 */
export async function getGeolocationPermissionState() {
  if (!isGeolocationSupported()) {
    return 'denied';
  }

  if (!navigator.permissions?.query) {
    return 'unknown';
  }

  try {
    const result = await navigator.permissions.query({ name: 'geolocation' });
    if (result.state === 'granted' || result.state === 'denied' || result.state === 'prompt') {
      return result.state;
    }
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * Triggers the browser/OS location permission dialog with high accuracy
 * (so Approximate vs Precise can offer Precise).
 *
 * Settles as soon as permission is granted — does not wait for a GPS fix,
 * which can hang for a long time indoors.
 *
 * @param {number} [timeoutMs=12000] Absolute hard stop so the UI never spins forever
 * @returns {Promise<{ success: boolean, latitude?: number, longitude?: number, accuracy?: number, error?: string }>}
 */
export function requestPreciseLocation(timeoutMs = 12000) {
  if (!isGeolocationSupported()) {
    return Promise.resolve({
      success: false,
      error: 'Location is not supported in this browser',
    });
  }

  return new Promise((resolve) => {
    let settled = false;
    let permissionStatus = null;

    const finish = (result) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(hardTimeoutId);
      if (permissionStatus) {
        permissionStatus.removeEventListener('change', onPermissionChange);
      }
      resolve(result);
    };

    const succeed = (coords = {}) => {
      finish({ success: true, ...coords });
    };

    const onPermissionChange = () => {
      if (permissionStatus?.state === 'granted') {
        succeed();
      } else if (permissionStatus?.state === 'denied') {
        finish({ success: false, error: 'Location permission was denied' });
      }
    };

    const hardTimeoutId = window.setTimeout(async () => {
      const state = await getGeolocationPermissionState();
      if (state === 'granted' || permissionStatus?.state === 'granted') {
        succeed();
        return;
      }
      finish({ success: false, error: 'Location request timed out' });
    }, timeoutMs);

    if (navigator.permissions?.query) {
      navigator.permissions.query({ name: 'geolocation' }).then((status) => {
        if (settled) return;
        permissionStatus = status;
        if (status.state === 'granted') {
          succeed();
          return;
        }
        if (status.state === 'denied') {
          finish({ success: false, error: 'Location permission was denied' });
          return;
        }
        status.addEventListener('change', onPermissionChange);
      }).catch(() => {
        // Permissions API unavailable — rely on getCurrentPosition + hard timeout
      });
    }

    // Request a high-accuracy fix so the OS shows Precise when available.
    // We do not require coords to succeed once permission is granted.
    navigator.geolocation.getCurrentPosition(
      (position) => {
        succeed({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
      },
      async (error) => {
        if (settled) return;

        const state = await getGeolocationPermissionState();
        if (state === 'granted' || permissionStatus?.state === 'granted') {
          succeed();
          return;
        }

        let message = 'Unable to get location';
        if (error?.code === 1 || state === 'denied') {
          message = 'Location permission was denied';
        } else if (error?.code === 2) {
          message = 'Location is unavailable';
        } else if (error?.code === 3) {
          message = 'Location request timed out';
        }
        finish({ success: false, error: message });
      },
      {
        enableHighAccuracy: true,
        timeout: Math.max(2000, timeoutMs - 1000),
        maximumAge: 60000,
      },
    );
  });
}
