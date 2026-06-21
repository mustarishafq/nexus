import { toAbsoluteUrl } from '@/lib/media';

export const DEFAULT_ATTENDANCE_WATERMARK_CONFIG = {
  enabled: true,
  clock_in_redirect_enabled: true,
  show_datetime: true,
  show_date: true,
  show_time: true,
  datetime_format: 'full',
  show_location: true,
  show_coordinates: true,
  show_user_name: true,
  show_device_info: false,
  show_custom_text: false,
  custom_text: '',
  font_size_percent: 100,
  text_color: '#FFFFFF',
  background_color: '#000000',
  background_opacity: 45,
  position: 'bottom-left',
  margin_percent: 3,
  show_logo: false,
  logo_url: '',
  logo_size_percent: 100,
  logo_opacity: 100,
  logo_position: 'center',
};

export const ATTENDANCE_DATETIME_FORMATS = [
  { id: 'full', label: 'Full date & time', description: 'Jun 21, 2026 2:30:45 PM' },
  { id: 'date_only', label: 'Date only', description: 'Jun 21, 2026' },
  { id: 'time_only', label: 'Time only', description: '2:30:45 PM' },
  { id: 'iso', label: 'ISO 8601', description: '2026-06-21T14:30:45' },
];

export const ATTENDANCE_LOGO_POSITIONS = [
  { id: 'left', label: 'Left', description: 'Align the logo to the left inside the watermark panel.' },
  { id: 'center', label: 'Center', description: 'Center the logo above the watermark text.' },
  { id: 'right', label: 'Right', description: 'Align the logo to the right inside the watermark panel.' },
];

export const ATTENDANCE_WATERMARK_POSITIONS = [
  { id: 'bottom-left', label: 'Bottom left', description: 'Stacked text in the lower-left corner.' },
  { id: 'bottom-right', label: 'Bottom right', description: 'Stacked text in the lower-right corner.' },
  { id: 'top-left', label: 'Top left', description: 'Stacked text in the upper-left corner.' },
  { id: 'top-right', label: 'Top right', description: 'Stacked text in the upper-right corner.' },
  { id: 'bottom-center', label: 'Bottom center', description: 'Centered along the bottom edge.' },
];

const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;

function clampInt(value, min, max) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return min;
  return Math.max(min, Math.min(max, parsed));
}

function toBool(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === 1 || value === '1') return true;
  if (value === 'false' || value === 0 || value === '0') return false;
  return fallback;
}

function normalizeHexColor(value, fallback = '#FFFFFF') {
  const normalized = String(value || '').trim().toUpperCase();
  return HEX_COLOR_REGEX.test(normalized) ? normalized : fallback;
}

function normalizeDatetimeFormat(value) {
  const allowed = ATTENDANCE_DATETIME_FORMATS.map((item) => item.id);
  const normalized = String(value || '').trim().toLowerCase();
  return allowed.includes(normalized) ? normalized : DEFAULT_ATTENDANCE_WATERMARK_CONFIG.datetime_format;
}

function normalizeLogoPosition(value) {
  const allowed = ATTENDANCE_LOGO_POSITIONS.map((item) => item.id);
  const normalized = String(value || '').trim().toLowerCase();
  return allowed.includes(normalized) ? normalized : DEFAULT_ATTENDANCE_WATERMARK_CONFIG.logo_position;
}

function normalizePosition(value) {
  const allowed = ATTENDANCE_WATERMARK_POSITIONS.map((item) => item.id);
  const normalized = String(value || '').trim().toLowerCase();
  return allowed.includes(normalized) ? normalized : DEFAULT_ATTENDANCE_WATERMARK_CONFIG.position;
}

export function normalizeAttendanceWatermarkConfig(input = {}) {
  const flat = typeof input === 'object' && input ? input : {};
  const nested = flat.attendance && typeof flat.attendance === 'object' ? flat.attendance : {};
  const source = { ...flat, ...nested };
  const logoUrl = [nested.logo_url, flat.attendance_watermark_logo_url, flat.logo_url]
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .find(Boolean) ?? '';

  return {
    enabled: toBool(source?.enabled ?? source?.attendance_enabled, DEFAULT_ATTENDANCE_WATERMARK_CONFIG.enabled),
    clock_in_redirect_enabled: toBool(
      source?.clock_in_redirect_enabled ?? source?.attendance_clock_in_redirect_enabled,
      DEFAULT_ATTENDANCE_WATERMARK_CONFIG.clock_in_redirect_enabled,
    ),
    show_datetime: toBool(
      source?.show_datetime ?? source?.attendance_watermark_show_datetime,
      DEFAULT_ATTENDANCE_WATERMARK_CONFIG.show_datetime,
    ),
    show_date: toBool(
      source?.show_date ?? source?.attendance_watermark_show_date,
      DEFAULT_ATTENDANCE_WATERMARK_CONFIG.show_date,
    ),
    show_time: toBool(
      source?.show_time ?? source?.attendance_watermark_show_time,
      DEFAULT_ATTENDANCE_WATERMARK_CONFIG.show_time,
    ),
    datetime_format: normalizeDatetimeFormat(
      source?.datetime_format ?? source?.attendance_watermark_datetime_format,
    ),
    show_location: toBool(
      source?.show_location ?? source?.attendance_watermark_show_location,
      DEFAULT_ATTENDANCE_WATERMARK_CONFIG.show_location,
    ),
    show_coordinates: toBool(
      source?.show_coordinates ?? source?.attendance_watermark_show_coordinates,
      DEFAULT_ATTENDANCE_WATERMARK_CONFIG.show_coordinates,
    ),
    show_user_name: toBool(
      source?.show_user_name ?? source?.attendance_watermark_show_user_name,
      DEFAULT_ATTENDANCE_WATERMARK_CONFIG.show_user_name,
    ),
    show_device_info: toBool(
      source?.show_device_info ?? source?.attendance_watermark_show_device_info,
      DEFAULT_ATTENDANCE_WATERMARK_CONFIG.show_device_info,
    ),
    show_custom_text: toBool(
      source?.show_custom_text ?? source?.attendance_watermark_show_custom_text,
      DEFAULT_ATTENDANCE_WATERMARK_CONFIG.show_custom_text,
    ),
    custom_text: String(source?.custom_text ?? source?.attendance_watermark_custom_text ?? '').trim(),
    font_size_percent: clampInt(
      source?.font_size_percent ?? source?.attendance_watermark_font_size_percent,
      50,
      200,
    ),
    text_color: normalizeHexColor(
      source?.text_color ?? source?.attendance_watermark_text_color,
      DEFAULT_ATTENDANCE_WATERMARK_CONFIG.text_color,
    ),
    background_color: normalizeHexColor(
      source?.background_color ?? source?.attendance_watermark_background_color,
      DEFAULT_ATTENDANCE_WATERMARK_CONFIG.background_color,
    ),
    background_opacity: clampInt(
      source?.background_opacity ?? source?.attendance_watermark_background_opacity,
      0,
      100,
    ),
    position: normalizePosition(source?.position ?? source?.attendance_watermark_position),
    margin_percent: clampInt(
      source?.margin_percent ?? source?.attendance_watermark_margin_percent,
      1,
      15,
    ),
    show_logo: toBool(
      source?.show_logo ?? source?.attendance_watermark_show_logo,
      DEFAULT_ATTENDANCE_WATERMARK_CONFIG.show_logo,
    ),
    logo_url: logoUrl,
    logo_size_percent: clampInt(
      source?.logo_size_percent ?? source?.attendance_watermark_logo_size_percent,
      50,
      200,
    ),
    logo_opacity: clampInt(
      source?.logo_opacity ?? source?.attendance_watermark_logo_opacity,
      0,
      100,
    ),
    logo_position: normalizeLogoPosition(
      source?.logo_position ?? source?.attendance_watermark_logo_position,
    ),
  };
}

export function attendanceWatermarkConfigToFormState(input = {}) {
  const config = normalizeAttendanceWatermarkConfig(input);

  return {
    attendance_enabled: config.enabled,
    attendance_clock_in_redirect_enabled: config.clock_in_redirect_enabled,
    attendance_watermark_show_datetime: config.show_datetime,
    attendance_watermark_show_date: config.show_date,
    attendance_watermark_show_time: config.show_time,
    attendance_watermark_datetime_format: config.datetime_format,
    attendance_watermark_show_location: config.show_location,
    attendance_watermark_show_coordinates: config.show_coordinates,
    attendance_watermark_show_user_name: config.show_user_name,
    attendance_watermark_show_device_info: config.show_device_info,
    attendance_watermark_show_custom_text: config.show_custom_text,
    attendance_watermark_custom_text: config.custom_text,
    attendance_watermark_font_size_percent: config.font_size_percent,
    attendance_watermark_text_color: config.text_color,
    attendance_watermark_background_color: config.background_color,
    attendance_watermark_background_opacity: config.background_opacity,
    attendance_watermark_position: config.position,
    attendance_watermark_margin_percent: config.margin_percent,
    attendance_watermark_show_logo: config.show_logo,
    attendance_watermark_logo_url: config.logo_url,
    attendance_watermark_logo_size_percent: config.logo_size_percent,
    attendance_watermark_logo_opacity: config.logo_opacity,
    attendance_watermark_logo_position: config.logo_position,
  };
}

export function resetAttendanceWatermarkFormState() {
  return attendanceWatermarkConfigToFormState(DEFAULT_ATTENDANCE_WATERMARK_CONFIG);
}

export function formatWatermarkDateTime(date, config, timezone) {
  const resolved = date instanceof Date ? date : new Date(date);
  const options = { timeZone: timezone || Intl.DateTimeFormat().resolvedOptions().timeZone };

  if (!config.show_datetime) return null;

  if (config.datetime_format === 'iso') {
    return resolved.toISOString().slice(0, 19);
  }

  if (config.datetime_format === 'date_only' || (config.show_date && !config.show_time)) {
    return new Intl.DateTimeFormat(undefined, { ...options, dateStyle: 'medium' }).format(resolved);
  }

  if (config.datetime_format === 'time_only' || (!config.show_date && config.show_time)) {
    return new Intl.DateTimeFormat(undefined, { ...options, timeStyle: 'medium' }).format(resolved);
  }

  return new Intl.DateTimeFormat(undefined, {
    ...options,
    dateStyle: 'medium',
    timeStyle: 'medium',
  }).format(resolved);
}

export function formatCoordinates(latitude, longitude) {
  if (latitude == null || longitude == null) return null;

  const lat = Number(latitude);
  const lng = Number(longitude);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;

  const latDir = lat >= 0 ? 'N' : 'S';
  const lngDir = lng >= 0 ? 'E' : 'W';

  return `${Math.abs(lat).toFixed(5)}° ${latDir}, ${Math.abs(lng).toFixed(5)}° ${lngDir}`;
}

export function buildWatermarkLines(config, context = {}) {
  const lines = [];
  const {
    userName,
    capturedAt = new Date(),
    timezone,
    locationLabel,
    latitude,
    longitude,
    deviceInfo,
    locatingAddress = false,
    locatingPosition = false,
  } = context;

  if (config.show_user_name && userName) {
    lines.push(userName);
  }

  const datetimeLine = formatWatermarkDateTime(capturedAt, config, timezone);
  if (datetimeLine) {
    lines.push(datetimeLine);
  }

  if (config.show_location) {
    if (locationLabel) {
      lines.push(locationLabel);
    } else if (locatingAddress) {
      lines.push('Locating address…');
    }
  }

  if (config.show_coordinates) {
    const coordinates = formatCoordinates(latitude, longitude);
    if (coordinates) {
      lines.push(coordinates);
    } else if (locatingPosition) {
      lines.push('Getting GPS…');
    }
  }

  if (config.show_device_info && deviceInfo) {
    const deviceLine = [
      deviceInfo.device_type,
      deviceInfo.operating_system,
      deviceInfo.browser,
    ].filter(Boolean).join(' · ');
    if (deviceLine) {
      lines.push(deviceLine);
    }
  }

  if (config.show_custom_text && config.custom_text) {
    lines.push(config.custom_text);
  }

  return lines;
}

function hexToRgba(hex, alpha) {
  const normalized = normalizeHexColor(hex, '#000000').slice(1);
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function resolveFontSize(canvasWidth, config) {
  const base = Math.max(12, Math.round(canvasWidth * 0.032));
  return Math.round(base * (config.font_size_percent / 100));
}

function measureLogoSize(logoImage, canvasWidth, fontSize, config) {
  if (!logoImage?.naturalWidth || !logoImage?.naturalHeight) {
    return null;
  }

  const maxWidth = Math.round(canvasWidth * 0.22 * (config.logo_size_percent / 100));
  const scale = maxWidth / logoImage.naturalWidth;
  const height = Math.round(logoImage.naturalHeight * scale);

  return {
    width: maxWidth,
    height,
    gap: Math.round(fontSize * 0.35),
  };
}

function measureWatermarkBlock(ctx, lines, fontSize, logoSize = null) {
  const lineHeight = Math.round(fontSize * 1.35);
  const paddingX = Math.round(fontSize * 0.75);
  const paddingY = Math.round(fontSize * 0.55);
  let maxWidth = logoSize?.width || 0;

  lines.forEach((line) => {
    const metrics = ctx.measureText(line);
    maxWidth = Math.max(maxWidth, metrics.width);
  });

  const textHeight = lines.length ? lines.length * lineHeight : 0;
  const logoHeight = logoSize ? logoSize.height + (lines.length ? logoSize.gap : 0) : 0;

  return {
    width: Math.ceil(maxWidth + paddingX * 2),
    height: Math.ceil(textHeight + logoHeight + paddingY * 2),
    lineHeight,
    paddingX,
    paddingY,
    logoSize,
  };
}

function resolveWatermarkOrigin(canvasWidth, canvasHeight, block, config) {
  const marginX = Math.round(canvasWidth * (config.margin_percent / 100));
  const marginY = Math.round(canvasHeight * (config.margin_percent / 100));

  switch (config.position) {
    case 'top-right':
      return { x: canvasWidth - marginX - block.width, y: marginY };
    case 'top-left':
      return { x: marginX, y: marginY };
    case 'bottom-right':
      return { x: canvasWidth - marginX - block.width, y: canvasHeight - marginY - block.height };
    case 'bottom-center':
      return { x: Math.round((canvasWidth - block.width) / 2), y: canvasHeight - marginY - block.height };
    case 'bottom-left':
    default:
      return { x: marginX, y: canvasHeight - marginY - block.height };
  }
}

function resolveLogoX(origin, block, logoSize, logoPosition) {
  const innerWidth = block.width - block.paddingX * 2;

  switch (logoPosition) {
    case 'right':
      return origin.x + block.paddingX + Math.max(0, innerWidth - logoSize.width);
    case 'center':
      return origin.x + block.paddingX + Math.max(0, (innerWidth - logoSize.width) / 2);
    case 'left':
    default:
      return origin.x + block.paddingX;
  }
}

export function drawWatermarkOnCanvas(ctx, canvas, config, context = {}, logoImage = null) {
  const lines = buildWatermarkLines(config, context);
  const showLogo = config.show_logo && config.logo_url && logoImage;
  if (!lines.length && !showLogo) return;

  const fontSize = resolveFontSize(canvas.width, config);
  const logoSize = showLogo ? measureLogoSize(logoImage, canvas.width, fontSize, config) : null;

  ctx.save();
  ctx.font = `600 ${fontSize}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  const block = measureWatermarkBlock(ctx, lines, fontSize, logoSize);
  const origin = resolveWatermarkOrigin(canvas.width, canvas.height, block, config);

  if (config.background_opacity > 0) {
    ctx.fillStyle = hexToRgba(config.background_color, config.background_opacity / 100);
    ctx.fillRect(origin.x, origin.y, block.width, block.height);
  }

  let contentY = origin.y + block.paddingY;

  if (showLogo && logoSize) {
    const logoX = resolveLogoX(origin, block, logoSize, config.logo_position);
    ctx.save();
    ctx.globalAlpha = config.logo_opacity / 100;
    ctx.drawImage(logoImage, logoX, contentY, logoSize.width, logoSize.height);
    ctx.restore();
    contentY += logoSize.height + (lines.length ? logoSize.gap : 0);
  }

  if (lines.length) {
    ctx.fillStyle = config.text_color;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.75)';
    ctx.shadowBlur = Math.max(2, Math.round(fontSize * 0.2));
    ctx.shadowOffsetY = 1;
    lines.forEach((line, index) => {
      const y = contentY + index * block.lineHeight;
      ctx.fillText(line, origin.x + block.paddingX, y);
    });
  }

  ctx.restore();
}

const watermarkLogoCache = new Map();

function createWatermarkImage(src) {
  return new Promise((resolve) => {
    const image = new Image();
    image.addEventListener('load', () => {
      resolve(image.naturalWidth > 0 ? image : null);
    });
    image.addEventListener('error', () => resolve(null));
    image.src = src;
  });
}

function isCrossOrigin(url) {
  try {
    return new URL(url, window.location.href).origin !== window.location.origin;
  } catch {
    return true;
  }
}

function resolveAttendanceLogoStoragePath(url) {
  const value = String(url || '').trim();
  if (value.startsWith('/storage/attendance-watermark-logos/')) {
    return value;
  }

  const match = value.match(/\/storage\/attendance-watermark-logos\/[A-Za-z0-9._\-]+/);
  return match ? match[0] : null;
}

async function loadImageFromBlob(blob) {
  const objectUrl = URL.createObjectURL(blob);
  try {
    return await createWatermarkImage(objectUrl);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function clearWatermarkLogoCache(url = null) {
  if (!url) {
    watermarkLogoCache.clear();
    return;
  }

  const storagePath = resolveAttendanceLogoStoragePath(url) || resolveAttendanceLogoStoragePath(toAbsoluteUrl(url));
  if (storagePath) {
    watermarkLogoCache.delete(storagePath);
  }
  watermarkLogoCache.delete(toAbsoluteUrl(url));
}

export async function loadWatermarkLogo(url) {
  const storagePath = resolveAttendanceLogoStoragePath(url) || resolveAttendanceLogoStoragePath(toAbsoluteUrl(url));
  const absolute = toAbsoluteUrl(url);
  const cacheKey = storagePath || absolute;
  if (!cacheKey) return null;

  if (watermarkLogoCache.has(cacheKey)) {
    return watermarkLogoCache.get(cacheKey);
  }

  const promise = (async () => {
    const sources = [];
    if (storagePath) sources.push(storagePath);
    if (absolute && !sources.includes(absolute)) sources.push(absolute);

    // Same-origin fetch (Vite /storage proxy or same host) — safe for canvas export.
    for (const source of sources) {
      if (isCrossOrigin(source)) continue;

      try {
        const response = await fetch(source, { credentials: 'include' });
        if (!response.ok) continue;

        const image = await loadImageFromBlob(await response.blob());
        if (image) return image;
      } catch {
        // Try the next loader.
      }
    }

    // Authenticated API route returns a blob without tainting the canvas.
    if (storagePath) {
      try {
        const { default: db } = await import('@/api/base44Client');
        const blob = await db.attendance.fetchWatermarkLogo(storagePath);
        if (blob) {
          const image = await loadImageFromBlob(blob);
          if (image) return image;
        }
      } catch {
        // Try the next loader.
      }
    }

    // Cross-origin API/storage host (e.g. VITE_API_BASE_URL on a different port).
    for (const source of sources) {
      if (!isCrossOrigin(source)) continue;

      try {
        const response = await fetch(source, { credentials: 'include', mode: 'cors' });
        if (!response.ok) continue;

        const image = await loadImageFromBlob(await response.blob());
        if (image) return image;
      } catch {
        // Try the next loader.
      }
    }

    return null;
  })();

  watermarkLogoCache.set(cacheKey, promise);

  const image = await promise;
  if (!image) {
    watermarkLogoCache.delete(cacheKey);
  }

  return image;
}

export function computeCenterCropRect(sourceWidth, sourceHeight, targetAspect) {
  if (!sourceWidth || !sourceHeight || !targetAspect) {
    return { x: 0, y: 0, width: sourceWidth, height: sourceHeight };
  }

  const sourceAspect = sourceWidth / sourceHeight;

  if (sourceAspect > targetAspect) {
    const height = sourceHeight;
    const width = height * targetAspect;
    return {
      x: (sourceWidth - width) / 2,
      y: 0,
      width,
      height,
    };
  }

  const width = sourceWidth;
  const height = width / targetAspect;
  return {
    x: 0,
    y: (sourceHeight - height) / 2,
    width,
    height,
  };
}

export function drawVideoFrameWithWatermark(
  ctx,
  canvas,
  video,
  config,
  context = {},
  displayAspect = null,
  logoImage = null,
) {
  const sourceWidth = video.videoWidth || 640;
  const sourceHeight = video.videoHeight || 480;
  const aspect = displayAspect || (sourceWidth / sourceHeight);
  const crop = computeCenterCropRect(sourceWidth, sourceHeight, aspect);

  canvas.width = Math.max(1, Math.round(crop.width));
  canvas.height = Math.max(1, Math.round(crop.height));

  ctx.drawImage(
    video,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    canvas.width,
    canvas.height,
  );

  drawWatermarkOnCanvas(ctx, canvas, config, context, logoImage);
}

export async function captureCanvasWithWatermark(video, config, context = {}, displayAspect = null, logoImage = null) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  drawVideoFrameWithWatermark(ctx, canvas, video, config, context, displayAspect, logoImage);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Failed to capture photo.'));
          return;
        }
        resolve(blob);
      },
      'image/jpeg',
      0.92,
    );
  });
}

export async function reverseGeocodeAddress(latitude, longitude, geocodeRequest = null) {
  if (latitude == null || longitude == null) return null;

  try {
    if (geocodeRequest) {
      const payload = await geocodeRequest({ latitude, longitude });
      return payload?.location_label || null;
    }

    const { default: db } = await import('@/api/base44Client');
    const payload = await db.attendance.reverseGeocode({ latitude, longitude });
    return payload?.location_label || null;
  } catch {
    return null;
  }
}

function formatAddressLabel(address = {}, displayName = '') {
  const street = address.road
    || address.pedestrian
    || address.footway
    || address.path
    || address.cycleway
    || address.residential;

  const area = address.suburb
    || address.neighbourhood
    || address.quarter
    || address.district;

  const city = address.city
    || address.town
    || address.village
    || address.municipality
    || address.county;

  const parts = [street, area, city].filter(Boolean);
  if (parts.length) {
    return parts.join(', ');
  }

  if (displayName) {
    return displayName.split(',').slice(0, 3).join(',').trim();
  }

  return null;
}

export async function getCurrentLocation(timeoutMs = 10000) {
  if (!navigator.geolocation) {
    return {
      latitude: null,
      longitude: null,
      locationLabel: null,
      locatingAddress: false,
      locatingPosition: false,
    };
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const locationLabel = await reverseGeocodeAddress(latitude, longitude);

        resolve({
          latitude,
          longitude,
          locationLabel,
          locatingAddress: false,
          locatingPosition: false,
        });
      },
      () => resolve({
        latitude: null,
        longitude: null,
        locationLabel: null,
        locatingAddress: false,
        locatingPosition: false,
      }),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 },
    );
  });
}

export function startLocationWatch(onUpdate, onError) {
  if (!navigator.geolocation) {
    onError?.('unsupported');
    return () => {};
  }

  let active = true;
  let geocodeRequestId = 0;

  const watchId = navigator.geolocation.watchPosition(
    async (position) => {
      if (!active) return;

      const { latitude, longitude } = position.coords;
      const requestId = ++geocodeRequestId;

      onUpdate({
        latitude,
        longitude,
        locationLabel: null,
        locatingAddress: true,
        locatingPosition: false,
      });

      const locationLabel = await reverseGeocodeAddress(latitude, longitude);
      if (!active || requestId !== geocodeRequestId) return;

      onUpdate({
        latitude,
        longitude,
        locationLabel,
        locatingAddress: false,
        locatingPosition: false,
      });
    },
    (error) => {
      if (!active) return;
      onError?.(error);
      onUpdate({
        latitude: null,
        longitude: null,
        locationLabel: null,
        locatingAddress: false,
        locatingPosition: false,
        locationError: error?.code,
      });
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 },
  );

  onUpdate({
    latitude: null,
    longitude: null,
    locationLabel: null,
    locatingAddress: false,
    locatingPosition: true,
  });

  return () => {
    active = false;
    navigator.geolocation.clearWatch(watchId);
  };
}
