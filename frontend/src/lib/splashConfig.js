export const DEFAULT_SPLASH_ANIMATION = 'pulse-ring';
export const DEFAULT_LOGO_SRC = '/icons/logo.png';

export const DEFAULT_SPLASH_CONFIG = {
  enabled: true,
  animation_style: DEFAULT_SPLASH_ANIMATION,
  background_color: '#022e96',
  accent_color: '#FA9D04',
  secondary_color: '#017CF3',
  min_duration_ms: 1200,
  max_duration_ms: 6000,
  speed_percent: 100,
  exit_fade_ms: 450,
  logo_scale_percent: 100,
  logo_url: '',
  show_logo: true,
  media_fit: 'contain',
  video_loop: true,
  video_muted: true,
  show_system_name: false,
  system_name_animation: 'fade-rise',
  system_name_color: '#FFFFFF',
  system_name_size_percent: 100,
  system_name_position: 'below',
  backdrop_blur: 0,
  background_overlay_opacity: 0,
  background_style: 'solid',
  background_gradient_angle: 135,
  background_blur: 0,
};

export const SPLASH_BACKGROUND_STYLES = [
  { id: 'solid', label: 'Solid', description: 'Flat background color.' },
  { id: 'linear', label: 'Linear gradient', description: 'Smooth diagonal blend using your brand colors.' },
  { id: 'radial', label: 'Radial glow', description: 'Soft spotlight radiating from the center.' },
  { id: 'mesh', label: 'Color mesh', description: 'Blurred color blobs for depth and atmosphere.' },
  { id: 'aurora', label: 'Aurora', description: 'Slowly shifting northern-lights gradient.' },
  { id: 'vignette', label: 'Vignette', description: 'Solid fill with darkened edges framing the logo.' },
];

const BACKGROUND_STYLE_IDS = new Set(SPLASH_BACKGROUND_STYLES.map((item) => item.id));

export const SPLASH_SYSTEM_NAME_ANIMATIONS = [
  { id: 'fade-rise', label: 'Fade & Rise', description: 'Title fades in while moving upward.' },
  { id: 'slide-up', label: 'Slide Up', description: 'Title slides up from below the logo.' },
  { id: 'typewriter', label: 'Typewriter', description: 'Title appears one character at a time.' },
  { id: 'shimmer', label: 'Shimmer', description: 'Light shimmer sweeps across the title.' },
  { id: 'glow-pulse', label: 'Glow Pulse', description: 'Soft glowing pulse on the title text.' },
  { id: 'none', label: 'Instant', description: 'Show the title immediately with no motion.' },
];

export const SPLASH_ANIMATIONS = [
  { id: 'lottie', label: 'Classic Lottie', description: 'The original bundled Lottie splash animation.', durationMs: 2400 },
  { id: 'pulse-ring', label: 'Pulse Rings', description: 'Logo centered with expanding energy rings.', durationMs: 2200 },
  { id: 'orbit', label: 'Orbital Launch', description: 'Satellite dots orbit the logo before lift-off.', durationMs: 2400 },
  { id: 'neural', label: 'Neural Network', description: 'Connected nodes pulse around the brand mark.', durationMs: 2600 },
  { id: 'constellation', label: 'Constellation', description: 'Star field with lines that converge on the logo.', durationMs: 2800 },
  { id: 'spin-glow', label: 'Spin Glow', description: 'Rotating halo and soft glow behind the logo.', durationMs: 2200 },
  { id: 'fade-rise', label: 'Fade & Rise', description: 'Minimal logo entrance with a gentle upward motion.', durationMs: 1800 },
  { id: 'particle-burst', label: 'Particle Burst', description: 'Brand-colored sparks burst outward, then the logo resolves.', durationMs: 2400 },
  { id: 'logo-morph', label: 'Logo Morph', description: 'Logo materializes from blur with a crisp morph-in finish.', durationMs: 2100 },
  { id: 'radar-sweep', label: 'Radar Sweep', description: 'A scanning radar arc sweeps across the splash.', durationMs: 2300 },
  { id: 'bounce-in', label: 'Bounce In', description: 'Logo drops in with a playful elastic bounce.', durationMs: 1900 },
  { id: 'flip-reveal', label: 'Flip Reveal', description: 'Logo flips into view on a 3D axis.', durationMs: 2000 },
  { id: 'ripple-pond', label: 'Ripple Pond', description: 'Concentric ripples spread from the logo center.', durationMs: 2400 },
  { id: 'dna-helix', label: 'DNA Helix', description: 'Twin helix strands spiral around the logo.', durationMs: 2600 },
  { id: 'hex-build', label: 'Hex Build', description: 'Honeycomb hexagons assemble around the brand mark.', durationMs: 2500 },
  { id: 'zoom-punch', label: 'Zoom Punch', description: 'Logo rockets in from deep space with impact.', durationMs: 1800 },
  { id: 'sunburst', label: 'Sunburst', description: 'Radiating light beams burst from the center.', durationMs: 2300 },
  { id: 'matrix-fall', label: 'Matrix Fall', description: 'Falling code columns loop around the logo.', durationMs: 2700 },
  { id: 'matrix-rain', label: 'Matrix Rain', description: 'Full-screen code rain keeps falling behind the logo.', durationMs: 3500 },
  { id: 'laser-grid', label: 'Laser Grid', description: 'A glowing grid scans in before the logo locks on.', durationMs: 2400 },
  { id: 'comet-trail', label: 'Comet Trail', description: 'A blazing comet orbits and settles into the logo.', durationMs: 2500 },
  { id: 'prism-split', label: 'Prism Split', description: 'RGB channels converge into a sharp logo reveal.', durationMs: 2100 },
  { id: 'ring-of-fire', label: 'Ring of Fire', description: 'A fiery halo spins before the brand ignites.', durationMs: 2300 },
  { id: 'mosaic-tile', label: 'Mosaic Tile', description: 'Tiles snap together to form the logo.', durationMs: 2600 },
  { id: 'ink-drop', label: 'Ink Drop', description: 'Ripples spread outward like ink hitting water.', durationMs: 2400 },
  { id: 'hologram-flicker', label: 'Hologram Flicker', description: 'Scan lines flicker before the logo stabilizes.', durationMs: 2200 },
  { id: 'gear-spin', label: 'Gear Spin', description: 'Mechanical gears rotate into place around the brand.', durationMs: 2500 },
  { id: 'star-warp', label: 'Star Warp', description: 'Streaking stars rush past before the logo arrives.', durationMs: 2300 },
  { id: 'bubble-pop', label: 'Bubble Pop', description: 'Floating bubbles burst to reveal the logo.', durationMs: 2400 },
  { id: 'magnetic-pull', label: 'Magnetic Pull', description: 'Particles snap inward and assemble the logo.', durationMs: 2600 },
  { id: 'tap-ripple', label: 'Tap Ripple', description: 'Tap anywhere to send ripples across the splash.', durationMs: 3400, interactive: true },
  { id: 'pointer-glow', label: 'Pointer Glow', description: 'Move or tap to steer a spotlight over the logo.', durationMs: 3200, interactive: true },
  { id: 'tilt-parallax', label: 'Tilt Parallax', description: 'Drag or tap to tilt the logo in 3D space.', durationMs: 3200, interactive: true },
  { id: 'crystal-shatter', label: 'Crystal Shatter', description: 'Glass shards burst away to reveal the logo.', durationMs: 2500 },
  { id: 'clockwork', label: 'Clockwork', description: 'Clock hands spin into alignment before the brand appears.', durationMs: 2400 },
  { id: 'neon-flicker', label: 'Neon Flicker', description: 'A neon sign buzzes and flickers on around the logo.', durationMs: 2300 },
  { id: 'fold-unfold', label: 'Fold Unfold', description: 'Paper panels unfold to expose the logo.', durationMs: 2400 },
  { id: 'orbit-pulse', label: 'Orbit Pulse', description: 'Concentric rings pulse inward toward the logo.', durationMs: 2200 },
];

export const INTERACTIVE_SPLASH_ANIMATIONS = new Set(
  SPLASH_ANIMATIONS.filter((item) => item.interactive).map((item) => item.id),
);

export function isSplashAnimationInteractive(value) {
  return INTERACTIVE_SPLASH_ANIMATIONS.has(normalizeSplashAnimation(value));
}

const SPLASH_ANIMATION_MAP = Object.fromEntries(SPLASH_ANIMATIONS.map((item) => [item.id, item]));
const SYSTEM_NAME_ANIMATION_IDS = new Set(SPLASH_SYSTEM_NAME_ANIMATIONS.map((item) => item.id));

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeHex(value, fallback) {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return /^#[0-9A-Fa-f]{6}$/.test(trimmed) ? trimmed.toUpperCase() : fallback;
}

function normalizeUrl(value) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (/^https?:\/\/.+/i.test(trimmed) || trimmed.startsWith('/')) {
    return trimmed;
  }
  return '';
}

function normalizeMediaFit(value) {
  return ['contain', 'cover', 'fill'].includes(value) ? value : 'contain';
}

function normalizeSystemNamePosition(value) {
  return value === 'above' ? 'above' : 'below';
}

function normalizeSystemNameAnimation(value) {
  return SYSTEM_NAME_ANIMATION_IDS.has(value) ? value : 'fade-rise';
}

function normalizeBackgroundStyle(value) {
  return BACKGROUND_STYLE_IDS.has(value) ? value : DEFAULT_SPLASH_CONFIG.background_style;
}

function withAlpha(color, alpha) {
  const hex = color.replace('#', '');
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function detectSplashMediaType(url) {
  if (!url) return 'default';
  const lower = url.split('?')[0].toLowerCase();
  if (/\.(mp4|webm|mov|ogv|ogg)(\?|$)/.test(lower)) return 'video';
  if (/\.(jpg|jpeg|png|gif|webp|svg|avif)(\?|$)/.test(lower)) return 'image';
  if (lower.startsWith('http') || lower.startsWith('/')) return 'image';
  return 'unknown';
}

export function shouldUseFullscreenVideoSplash(runtime) {
  return Boolean(
    runtime?.media?.show
    && runtime.media.type === 'video'
    && runtime.media.customUrl,
  );
}

export function buildFullscreenVideoStyle(runtime) {
  const scale = runtime.timing.logoScale;
  const fit = runtime.media.fit;
  const base = {
    transformOrigin: 'center center',
    objectPosition: 'center',
  };

  if (fit === 'fill') {
    return {
      ...base,
      position: 'absolute',
      top: '50%',
      left: '50%',
      width: '100%',
      height: '100%',
      objectFit: 'fill',
      transform: `translate(-50%, -50%) scale(${scale})`,
    };
  }

  if (fit === 'contain') {
    return {
      ...base,
      position: 'absolute',
      top: '50%',
      left: '50%',
      width: '100%',
      height: '100%',
      objectFit: 'contain',
      transform: `translate(-50%, -50%) scale(${scale})`,
    };
  }

  return {
    ...base,
    position: 'absolute',
    top: '50%',
    left: '50%',
    minWidth: '100%',
    minHeight: '100%',
    width: 'auto',
    height: 'auto',
    objectFit: 'cover',
    transform: `translate(-50%, -50%) scale(${scale * 1.02})`,
  };
}

/** Sample edge pixels from a video frame to match the splash backdrop to the clip. */
export function sampleVideoBackgroundColor(video) {
  if (!video?.videoWidth || !video?.videoHeight) return null;

  try {
    const canvas = document.createElement('canvas');
    const width = Math.min(video.videoWidth, 128);
    const height = Math.min(video.videoHeight, 128);
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return null;

    context.drawImage(video, 0, 0, width, height);

    const corners = [
      [0, 0],
      [width - 1, 0],
      [0, height - 1],
      [width - 1, height - 1],
    ];

    const samplePoints = [...corners];
    const edgeInset = Math.max(1, Math.floor(Math.min(width, height) * 0.04));

    for (let x = edgeInset; x < width; x += Math.max(4, Math.floor(width / 12))) {
      samplePoints.push([x, edgeInset], [x, height - edgeInset - 1]);
    }
    for (let y = edgeInset; y < height; y += Math.max(4, Math.floor(height / 12))) {
      samplePoints.push([edgeInset, y], [width - edgeInset - 1, y]);
    }

    let red = 0;
    let green = 0;
    let blue = 0;
    let weight = 0;

    for (const [x, y] of samplePoints) {
      const isCorner = corners.some(([cx, cy]) => cx === x && cy === y);
      const pixelWeight = isCorner ? 3 : 1;
      const [pixelRed, pixelGreen, pixelBlue] = context.getImageData(x, y, 1, 1).data;
      red += pixelRed * pixelWeight;
      green += pixelGreen * pixelWeight;
      blue += pixelBlue * pixelWeight;
      weight += pixelWeight;
    }

    if (weight === 0) return null;

    const toHex = (value) => Math.round(value / weight).toString(16).padStart(2, '0');

    return `#${toHex(red)}${toHex(green)}${toHex(blue)}`.toUpperCase();
  } catch {
    return null;
  }
}

export const SPLASH_VIDEO_BACKDROP_FALLBACK = '#000000';

export function normalizeSplashAnimation(value) {
  return SPLASH_ANIMATION_MAP[value] ? value : DEFAULT_SPLASH_ANIMATION;
}

export function getSplashAnimationMeta(value) {
  return SPLASH_ANIMATION_MAP[normalizeSplashAnimation(value)] || SPLASH_ANIMATION_MAP[DEFAULT_SPLASH_ANIMATION];
}

export function mergeSplashAnimationCatalog(serverCatalog) {
  if (!Array.isArray(serverCatalog) || serverCatalog.length === 0) {
    return SPLASH_ANIMATIONS;
  }

  return serverCatalog.map((item) => {
    const local = SPLASH_ANIMATION_MAP[item?.id];
    return {
      id: item?.id,
      label: item?.label || local?.label || item?.id,
      description: item?.description || local?.description || '',
      durationMs: local?.durationMs || 2200,
      interactive: local?.interactive || false,
    };
  }).filter((item) => SPLASH_ANIMATION_MAP[item.id]);
}

export function mergeSystemNameAnimationCatalog(serverCatalog) {
  if (!Array.isArray(serverCatalog) || serverCatalog.length === 0) {
    return SPLASH_SYSTEM_NAME_ANIMATIONS;
  }

  return serverCatalog.filter((item) => SYSTEM_NAME_ANIMATION_IDS.has(item?.id));
}

export function normalizeSplashConfig(input) {
  const values = input && typeof input === 'object' ? input : {};
  const minDuration = clamp(Number(values.min_duration_ms ?? values.splash_min_duration_ms ?? DEFAULT_SPLASH_CONFIG.min_duration_ms), 400, 15000);
  let maxDuration = clamp(Number(values.max_duration_ms ?? values.splash_max_duration_ms ?? DEFAULT_SPLASH_CONFIG.max_duration_ms), 2000, 30000);

  if (minDuration >= maxDuration) {
    maxDuration = Math.max(minDuration + 500, 2000);
  }

  return {
    enabled: values.splash_enabled ?? values.enabled ?? DEFAULT_SPLASH_CONFIG.enabled,
    animation_style: normalizeSplashAnimation(values.animation_style ?? values.splash_animation_style),
    background_color: normalizeHex(values.background_color ?? values.splash_background_color, DEFAULT_SPLASH_CONFIG.background_color),
    accent_color: normalizeHex(values.accent_color ?? values.splash_accent_color, DEFAULT_SPLASH_CONFIG.accent_color),
    secondary_color: normalizeHex(values.secondary_color ?? values.splash_secondary_color, DEFAULT_SPLASH_CONFIG.secondary_color),
    min_duration_ms: minDuration,
    max_duration_ms: maxDuration,
    speed_percent: clamp(Number(values.speed_percent ?? values.splash_speed_percent ?? DEFAULT_SPLASH_CONFIG.speed_percent), 50, 200),
    exit_fade_ms: clamp(Number(values.exit_fade_ms ?? values.splash_exit_fade_ms ?? DEFAULT_SPLASH_CONFIG.exit_fade_ms), 150, 1200),
    logo_scale_percent: clamp(Number(values.logo_scale_percent ?? values.splash_logo_scale_percent ?? DEFAULT_SPLASH_CONFIG.logo_scale_percent), 50, 200),
    logo_url: normalizeUrl(values.logo_url ?? values.splash_logo_url),
    show_logo: values.splash_show_logo ?? values.show_logo ?? DEFAULT_SPLASH_CONFIG.show_logo,
    media_fit: normalizeMediaFit(values.media_fit ?? values.splash_media_fit ?? DEFAULT_SPLASH_CONFIG.media_fit),
    video_loop: values.splash_video_loop ?? values.video_loop ?? DEFAULT_SPLASH_CONFIG.video_loop,
    video_muted: values.splash_video_muted ?? values.video_muted ?? DEFAULT_SPLASH_CONFIG.video_muted,
    show_system_name: values.splash_show_system_name ?? values.show_system_name ?? DEFAULT_SPLASH_CONFIG.show_system_name,
    system_name_animation: normalizeSystemNameAnimation(values.system_name_animation ?? values.splash_system_name_animation),
    system_name_color: normalizeHex(values.system_name_color ?? values.splash_system_name_color, DEFAULT_SPLASH_CONFIG.system_name_color),
    system_name_size_percent: clamp(Number(values.system_name_size_percent ?? values.splash_system_name_size_percent ?? DEFAULT_SPLASH_CONFIG.system_name_size_percent), 70, 150),
    system_name_position: normalizeSystemNamePosition(values.system_name_position ?? values.splash_system_name_position),
    backdrop_blur: clamp(Number(values.backdrop_blur ?? values.splash_backdrop_blur ?? DEFAULT_SPLASH_CONFIG.backdrop_blur), 0, 24),
    background_overlay_opacity: clamp(Number(values.background_overlay_opacity ?? values.splash_background_overlay_opacity ?? DEFAULT_SPLASH_CONFIG.background_overlay_opacity), 0, 80),
    background_style: normalizeBackgroundStyle(values.background_style ?? values.splash_background_style),
    background_gradient_angle: clamp(Number(values.background_gradient_angle ?? values.splash_background_gradient_angle ?? DEFAULT_SPLASH_CONFIG.background_gradient_angle), 0, 360),
    background_blur: clamp(Number(values.background_blur ?? values.splash_background_blur ?? DEFAULT_SPLASH_CONFIG.background_blur), 0, 60),
  };
}

export function buildSplashBackgroundLayers(config) {
  const normalized = normalizeSplashConfig(config ?? {});
  const { background_color: bg, accent_color: accent, secondary_color: secondary } = normalized;
  const style = normalized.background_style;
  const angle = normalized.background_gradient_angle;
  const blobBlur = normalized.background_blur || (style === 'mesh' ? 48 : style === 'aurora' ? 36 : 0);

  const base = { backgroundColor: bg };

  if (style === 'linear') {
    base.background = `linear-gradient(${angle}deg, ${bg} 0%, ${secondary} 48%, ${accent} 100%)`;
  } else if (style === 'radial') {
    base.background = `radial-gradient(circle at 50% 42%, ${withAlpha(accent, 0.55)} 0%, ${withAlpha(secondary, 0.35)} 34%, ${bg} 72%)`;
  }

  const blobs = [];

  if (style === 'mesh') {
    blobs.push(
      {
        style: {
          width: '55%',
          height: '55%',
          top: '-8%',
          left: '-10%',
          background: withAlpha(secondary, 0.55),
        },
        blur: blobBlur,
      },
      {
        style: {
          width: '48%',
          height: '48%',
          bottom: '-12%',
          right: '-8%',
          background: withAlpha(accent, 0.5),
        },
        blur: blobBlur,
      },
      {
        style: {
          width: '38%',
          height: '38%',
          top: '38%',
          left: '42%',
          background: withAlpha('#FFFFFF', 0.12),
        },
        blur: Math.max(blobBlur - 8, 12),
      },
    );
  }

  if (style === 'aurora') {
    blobs.push(
      {
        style: {
          width: '80%',
          height: '45%',
          top: '8%',
          left: '10%',
          background: `linear-gradient(120deg, ${withAlpha(secondary, 0.65)}, transparent)`,
        },
        blur: blobBlur,
        animate: { x: [0, 24, -12, 0], y: [0, 12, -8, 0], opacity: [0.55, 0.85, 0.6, 0.55] },
        transition: { duration: 8, repeat: Infinity, ease: 'easeInOut' },
      },
      {
        style: {
          width: '70%',
          height: '40%',
          bottom: '10%',
          right: '5%',
          background: `linear-gradient(300deg, ${withAlpha(accent, 0.6)}, transparent)`,
        },
        blur: blobBlur,
        animate: { x: [0, -20, 16, 0], y: [0, -10, 8, 0], opacity: [0.45, 0.75, 0.5, 0.45] },
        transition: { duration: 9, repeat: Infinity, ease: 'easeInOut' },
      },
      {
        style: {
          width: '50%',
          height: '50%',
          top: '30%',
          left: '25%',
          background: `radial-gradient(circle, ${withAlpha('#FFFFFF', 0.18)} 0%, transparent 70%)`,
        },
        blur: Math.max(blobBlur - 6, 16),
        animate: { scale: [1, 1.08, 0.96, 1], opacity: [0.35, 0.55, 0.4, 0.35] },
        transition: { duration: 7, repeat: Infinity, ease: 'easeInOut' },
      },
    );
  }

  return {
    base,
    blobs,
    vignette: style === 'vignette',
    noise: style === 'mesh' || style === 'aurora',
  };
}

export function resolveSplashConfigFromSettings(settings) {
  if (settings?.splash && typeof settings.splash === 'object') {
    return normalizeSplashConfig(settings.splash);
  }

  return normalizeSplashConfig(settings || {});
}

export function splashConfigToFormState(config) {
  const normalized = normalizeSplashConfig(config);

  return {
    splash_enabled: normalized.enabled,
    splash_animation_style: normalized.animation_style,
    splash_background_color: normalized.background_color,
    splash_accent_color: normalized.accent_color,
    splash_secondary_color: normalized.secondary_color,
    splash_min_duration_ms: normalized.min_duration_ms,
    splash_max_duration_ms: normalized.max_duration_ms,
    splash_speed_percent: normalized.speed_percent,
    splash_exit_fade_ms: normalized.exit_fade_ms,
    splash_logo_scale_percent: normalized.logo_scale_percent,
    splash_logo_url: normalized.logo_url,
    splash_show_logo: normalized.show_logo,
    splash_media_fit: normalized.media_fit,
    splash_video_loop: normalized.video_loop,
    splash_video_muted: normalized.video_muted,
    splash_show_system_name: normalized.show_system_name,
    splash_system_name_animation: normalized.system_name_animation,
    splash_system_name_color: normalized.system_name_color,
    splash_system_name_size_percent: normalized.system_name_size_percent,
    splash_system_name_position: normalized.system_name_position,
    splash_backdrop_blur: normalized.backdrop_blur,
    splash_background_overlay_opacity: normalized.background_overlay_opacity,
    splash_background_style: normalized.background_style,
    splash_background_gradient_angle: normalized.background_gradient_angle,
    splash_background_blur: normalized.background_blur,
  };
}

export function buildSplashRuntime(config, animationStyle, systemName = '') {
  const normalized = normalizeSplashConfig(config);
  const style = normalizeSplashAnimation(animationStyle ?? normalized.animation_style);
  const speedMultiplier = normalized.speed_percent / 100;
  const animationMeta = getSplashAnimationMeta(style);
  const mediaType = normalized.logo_url ? detectSplashMediaType(normalized.logo_url) : 'default';

  return {
    theme: {
      background: normalized.background_color,
      accent: normalized.accent_color,
      secondary: normalized.secondary_color,
    },
    media: {
      url: normalized.logo_url || DEFAULT_LOGO_SRC,
      customUrl: normalized.logo_url,
      type: mediaType,
      show: normalized.show_logo,
      fit: normalized.media_fit,
      loop: normalized.video_loop,
      muted: normalized.video_muted,
      fullscreen: mediaType === 'video' && Boolean(normalized.logo_url) && normalized.show_logo,
    },
    title: {
      show: normalized.show_system_name,
      text: systemName || '',
      animation: normalized.system_name_animation,
      color: normalized.system_name_color,
      sizeScale: normalized.system_name_size_percent / 100,
      position: normalized.system_name_position,
    },
    effects: {
      backdropBlur: normalized.backdrop_blur,
      overlayOpacity: normalized.background_overlay_opacity / 100,
      backgroundStyle: normalized.background_style,
      backgroundGradientAngle: normalized.background_gradient_angle,
      backgroundBlur: normalized.background_blur,
    },
    timing: {
      minDurationMs: normalized.min_duration_ms,
      maxDurationMs: normalized.max_duration_ms,
      exitFadeMs: normalized.exit_fade_ms,
      speedMultiplier,
      logoScale: normalized.logo_scale_percent / 100,
      animationDurationMs: Math.round(animationMeta.durationMs / speedMultiplier),
    },
    scaleDuration(seconds) {
      return seconds / speedMultiplier;
    },
    withAlpha(color, alpha) {
      const hex = color.replace('#', '');
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    },
  };
}

export function resetSplashFormState() {
  return splashConfigToFormState(DEFAULT_SPLASH_CONFIG);
}
