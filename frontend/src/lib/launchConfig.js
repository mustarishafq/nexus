export const DEFAULT_LAUNCH_ANIMATION = 'warp';
export const DEFAULT_LAUNCH_OVERLAY_MODE = 'fullscreen';
export const DEFAULT_LAUNCH_PROGRESS_STYLE = 'bar';
export const DEFAULT_LAUNCH_DURATION = 'normal';

export const DEFAULT_LAUNCH_CONFIG = {
  animation_style: DEFAULT_LAUNCH_ANIMATION,
  overlay_mode: DEFAULT_LAUNCH_OVERLAY_MODE,
  progress_style: DEFAULT_LAUNCH_PROGRESS_STYLE,
  duration: DEFAULT_LAUNCH_DURATION,
  interactive: true,
  show_skip: true,
  show_hint: true,
};

export const LAUNCH_ANIMATIONS = [
  { id: 'none', label: 'Instant', description: 'Skip the overlay and open immediately.', hint: 'Best for power users who prefer zero delay.', category: 'instant' },
  { id: 'warp', label: 'Warp Drive', description: 'Star streaks rush past as the app logo zooms forward.', hint: 'Tap anywhere to jump to hyperdrive.', category: 'space' },
  { id: 'orbit', label: 'Orbital Sync', description: 'Satellites orbit the app icon before lift-off.', hint: 'Tap to add orbiters and accelerate.', category: 'space' },
  { id: 'portal', label: 'Portal Step', description: 'A swirling portal opens around the app logo.', hint: 'Tap or hold to step through the portal.', category: 'energy' },
  { id: 'ignite', label: 'Ignition', description: 'Embers gather around the logo before blast-off.', hint: 'Tap to stoke the flames and launch faster.', category: 'energy' },
  { id: 'pulse', label: 'Pulse Rings', description: 'Concentric rings pulse outward from the logo.', hint: 'Tap to amplify the pulse.', category: 'energy' },
  { id: 'aurora', label: 'Aurora', description: 'Northern-lights gradients swirl behind the logo.', hint: 'Tap to brighten the aurora.', category: 'nature' },
  { id: 'glitch', label: 'Glitch', description: 'RGB channels jitter before the logo locks in.', hint: 'Tap to destabilize and resync faster.', category: 'glitch', interactive: true },
  { id: 'liquid', label: 'Liquid Morph', description: 'Fluid blobs merge into the app icon.', hint: 'Tap to stir the liquid.', category: 'liquid', interactive: true },
  { id: 'vortex', label: 'Vortex', description: 'A spiral tunnel pulls the logo forward.', hint: 'Tap to spin the vortex faster.', category: 'space' },
  { id: 'magnetic', label: 'Magnetic Pull', description: 'Particles snap inward to assemble the logo.', hint: 'Tap to strengthen the magnetic field.', category: 'energy' },
  { id: 'comet', label: 'Comet Trail', description: 'A blazing comet orbits and settles on the icon.', hint: 'Tap to ignite a brighter tail.', category: 'space' },
  { id: 'neon', label: 'Neon Flicker', description: 'A buzzing neon frame flickers on around the logo.', hint: 'Tap to stabilize the neon sign.', category: 'energy' },
  { id: 'bounce', label: 'Bounce In', description: 'Logo drops in with a playful elastic bounce.', hint: 'Tap to add extra bounce.', category: 'energy' },
  { id: 'hologram', label: 'Hologram', description: 'Scan lines flicker before the logo stabilizes.', hint: 'Tap to sharpen the projection.', category: 'glitch' },
  { id: 'prism', label: 'Prism Split', description: 'RGB light channels converge into the logo.', hint: 'Tap to align the spectrum.', category: 'energy' },
  { id: 'smoke', label: 'Smoke Rise', description: 'Wisps of smoke clear to reveal the logo.', hint: 'Tap to blow the smoke away.', category: 'nature' },
  { id: 'glitch_rgb', label: 'RGB Split', description: 'Chromatic aberration splits then snaps the logo into focus.', hint: 'Tap to misalign channels faster.', category: 'glitch' },
  { id: 'static_burst', label: 'Static Burst', description: 'TV static noise clears to reveal the sharp logo.', hint: 'Tap to clear static sooner.', category: 'glitch' },
  { id: 'datamosh', label: 'Datamosh', description: 'Horizontal slices shear and reassemble the icon.', hint: 'Tap to corrupt more slices.', category: 'glitch' },
  { id: 'hologram_grid', label: 'Hologram Grid', description: 'Wireframe grid rotates behind a projected logo.', hint: 'Tap to lock the projection.', category: 'hologram' },
  { id: 'scanline', label: 'Scanline Sweep', description: 'A CRT scan beam sweeps down before the logo appears.', hint: 'Tap to speed up the sweep.', category: 'hologram' },
  { id: 'cyber_hex', label: 'Cyber Hex', description: 'Honeycomb hexagons orbit and dock on the logo.', hint: 'Tap to add hex cells.', category: 'energy' },
  { id: 'laser_grid', label: 'Laser Grid', description: 'Perspective laser grid converges on the brand mark.', hint: 'Tap to tighten the grid.', category: 'hologram' },
  { id: 'crystal', label: 'Crystal Shatter', description: 'Glass shards burst outward, revealing the logo.', hint: 'Tap to shatter faster.', category: 'energy' },
  { id: 'flip', label: 'Flip Reveal', description: 'Logo flips into view on a 3D axis.', hint: 'Tap to complete the flip.', category: 'energy' },
  { id: 'ink_drop', label: 'Ink Drop', description: 'Ink ripples spread outward from the logo center.', hint: 'Tap to send another ripple.', category: 'liquid' },
  { id: 'fold', label: 'Fold Unfold', description: 'Paper panels unfold to expose the logo.', hint: 'Tap to unfold quicker.', category: 'energy' },
  { id: 'ring_fire', label: 'Ring of Fire', description: 'A fiery halo spins before the brand ignites.', hint: 'Tap to stoke the flames.', category: 'energy' },
  { id: 'dna', label: 'DNA Helix', description: 'Twin helix strands spiral around the logo.', hint: 'Tap to tighten the spiral.', category: 'nature' },
  { id: 'particle_burst', label: 'Particle Burst', description: 'Sparks burst outward, then the logo resolves.', hint: 'Tap to trigger another burst.', category: 'energy' },
  { id: 'pixelate', label: 'Pixelate', description: 'Blocky pixels dissolve into a sharp logo.', hint: 'Tap to resolve pixels faster.', category: 'glitch' },
  { id: 'holo_flicker', label: 'Holo Flicker', description: 'Unstable hologram flickers before locking in.', hint: 'Tap to stabilize the signal.', category: 'hologram' },
  { id: 'shockwave', label: 'Shockwave', description: 'An explosive ring expands from the logo center.', hint: 'Tap to amplify the blast.', category: 'energy' },
  { id: 'tornado', label: 'Tornado', description: 'A spinning funnel lifts the logo into view.', hint: 'Tap to spin faster.', category: 'nature' },
  { id: 'eclipse', label: 'Eclipse', description: 'A dark disc passes to reveal the bright logo.', hint: 'Tap to speed the eclipse.', category: 'space' },
  { id: 'zoom_blur', label: 'Zoom Blur', description: 'Motion-blurred zoom rushes into the sharp logo.', hint: 'Tap to punch in harder.', category: 'energy' },
  { id: 'sandstorm', label: 'Sandstorm', description: 'Swirling grains part to reveal the logo.', hint: 'Tap to clear the storm.', category: 'nature' },
];

export const LAUNCH_OVERLAY_MODES = [
  { id: 'fullscreen', label: 'Fullscreen', description: 'Immersive full-screen launch overlay.' },
  { id: 'card', label: 'Center card', description: 'Floating card centered on a dimmed backdrop.' },
  { id: 'glass', label: 'Glass panel', description: 'Frosted glass panel with blurred background.' },
  { id: 'clear_glass', label: 'Clear glass modal', description: 'See-through glass modal — background stays sharp with only a light panel blur.', interactive: true },
  { id: 'shell_glass', label: 'Shell glass modal', description: 'See-through modal using the same glass styling as the navbar and bottom navigation.', interactive: true },
  { id: 'spotlight', label: 'Spotlight', description: 'Radial spotlight framing the app logo.' },
  { id: 'cinema', label: 'Cinema', description: 'Letterboxed cinematic presentation.' },
  { id: 'minimal', label: 'Bottom bar', description: 'Compact progress bar anchored to the bottom.' },
  { id: 'dock', label: 'Dock', description: 'Dock-style panel rising from the bottom edge.' },
  { id: 'corner', label: 'Corner', description: 'Small floating card in the bottom-right corner.' },
  { id: 'blur', label: 'Heavy blur', description: 'Full-screen backdrop with deep gaussian blur.', interactive: true },
  { id: 'frosted', label: 'Frosted veil', description: 'Entire screen wrapped in a frosted glass veil.', interactive: true },
  { id: 'glass_deep', label: 'Deep glass', description: 'Layered frosted panels with inner glow and depth.', interactive: true },
  { id: 'bubble', label: 'Bubble', description: 'Floating luminous bubble with soft refraction.', interactive: true },
  { id: 'gradient', label: 'Gradient mesh', description: 'Animated brand-gradient mesh fills the screen.' },
  { id: 'mesh', label: 'Color mesh', description: 'Blurred color blobs drift behind the launch card.' },
  { id: 'neon_frame', label: 'Neon frame', description: 'Pulsing neon border frames the launch content.', interactive: true },
  { id: 'hologram_panel', label: 'Hologram panel', description: 'Scanline holographic sheet with cyan edges.' },
  { id: 'prism_edge', label: 'Prism edge', description: 'Prismatic light splits along the panel edges.' },
  { id: 'interactive_glow', label: 'Pointer glow', description: 'Spotlight follows your cursor or tap position.', interactive: true },
  { id: 'tilt', label: 'Tilt card', description: '3D-tilted card that responds to pointer movement.', interactive: true },
  { id: 'split', label: 'Split reveal', description: 'Two panels part to reveal the launch content.' },
  { id: 'glitch_frame', label: 'Glitch frame', description: 'Full-screen overlay with RGB-jitter border.', interactive: true },
  { id: 'crt_monitor', label: 'CRT monitor', description: 'Retro monitor bezel around a scanline panel.' },
  { id: 'hexagon_panel', label: 'Hexagon panel', description: 'Hexagonal floating panel with soft glow.' },
  { id: 'sidebar', label: 'Side panel', description: 'Tall panel slides in from the left edge.' },
  { id: 'top_banner', label: 'Top banner', description: 'Compact banner strip across the top.' },
  { id: 'aurora_full', label: 'Aurora sky', description: 'Full-screen northern-lights gradient backdrop.' },
  { id: 'scanlines_full', label: 'CRT scanlines', description: 'Full-screen retro scanline overlay.' },
  { id: 'void', label: 'Deep void', description: 'Infinite dark radial void engulfs the screen.' },
  { id: 'mirror', label: 'Mirror glass', description: 'Reflective glass panel with shine highlights.' },
  { id: 'glitch_panel', label: 'Glitch panel', description: 'Floating card with chromatic edge glitch.', interactive: true },
  { id: 'polaroid', label: 'Polaroid', description: 'Photo-style card with white frame and shadow.' },
  { id: 'bottom_sheet', label: 'Bottom sheet', description: 'Rounded sheet slides up from the bottom.' },
  { id: 'full_glass', label: 'Full glass', description: 'Full-screen frosted glass sheet with the same slide-up feel.' },
  { id: 'right_rail', label: 'Right rail', description: 'Narrow panel anchored to the right edge.' },
  { id: 'prism_full', label: 'Prism sky', description: 'Full-screen prismatic color wash.' },
  { id: 'circuit_board', label: 'Circuit board', description: 'Glowing circuit traces across the screen.', interactive: true },
  { id: 'hologram_full', label: 'Hologram field', description: 'Full-screen holographic grid and scanlines.' },
  { id: 'vignette', label: 'Vignette', description: 'Heavy edge darkening frames the center.' },
  { id: 'stained_glass', label: 'Stained glass', description: 'Colorful glass panel with lead-line segments.' },
  { id: 'pixel_frame', label: 'Pixel frame', description: 'Retro pixel border around a floating card.', interactive: true },
  { id: 'orbit_frame', label: 'Orbit frame', description: 'Orbiting dots trace a full-screen border.', interactive: true },
];

export const LAUNCH_OVERLAY_PLACEMENT_CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'fullscreen', label: 'Full screen' },
  { id: 'center', label: 'Center panel' },
  { id: 'border', label: 'Border & frame' },
  { id: 'bottom', label: 'Bottom' },
  { id: 'bottom_right', label: 'Bottom right' },
  { id: 'top', label: 'Top' },
  { id: 'side', label: 'Side' },
];

export const LAUNCH_OVERLAY_PLACEMENT_LABELS = {
  fullscreen: 'Full screen',
  center: 'Center panel',
  border: 'Border & frame',
  bottom: 'Bottom',
  bottom_right: 'Bottom right',
  top: 'Top',
  side: 'Side',
};

/** Where on screen the overlay content is anchored. */
export const LAUNCH_OVERLAY_PLACEMENT_BY_MODE = {
  fullscreen: 'fullscreen',
  blur: 'fullscreen',
  frosted: 'fullscreen',
  spotlight: 'fullscreen',
  gradient: 'fullscreen',
  mesh: 'fullscreen',
  split: 'fullscreen',
  cinema: 'fullscreen',
  glitch_frame: 'border',
  aurora_full: 'fullscreen',
  scanlines_full: 'fullscreen',
  void: 'fullscreen',
  prism_full: 'fullscreen',
  circuit_board: 'fullscreen',
  hologram_full: 'fullscreen',
  vignette: 'fullscreen',
  orbit_frame: 'border',
  interactive_glow: 'fullscreen',
  card: 'center',
  glass: 'center',
  glass_deep: 'center',
  bubble: 'center',
  tilt: 'center',
  mirror: 'center',
  clear_glass: 'center',
  shell_glass: 'center',
  neon_frame: 'border',
  hologram_panel: 'border',
  prism_edge: 'border',
  crt_monitor: 'border',
  hexagon_panel: 'border',
  glitch_panel: 'border',
  polaroid: 'border',
  stained_glass: 'border',
  pixel_frame: 'border',
  minimal: 'bottom',
  dock: 'bottom',
  bottom_sheet: 'bottom',
  full_glass: 'bottom',
  corner: 'bottom_right',
  top_banner: 'top',
  sidebar: 'side',
  right_rail: 'side',
};

export const LAUNCH_PROGRESS_STYLES = [
  { id: 'bar', label: 'Loading bar', description: 'Horizontal bar that fills as launch progresses.' },
  { id: 'liquid_bar', label: 'Liquid bar', description: 'Wavy liquid fill with a glossy surface.' },
  { id: 'spinner', label: 'Spinner', description: 'Circular spinner with percentage in the center.' },
  { id: 'dots', label: 'Dots', description: 'Three animated dots that light up in sequence.' },
  { id: 'ring', label: 'Ring', description: 'Circular progress ring with percentage.' },
  { id: 'percent', label: 'Percentage', description: 'Large numeric percentage with loading label.' },
  { id: 'pulse', label: 'Pulse', description: 'Pulsing dot that grows with progress.' },
  { id: 'none', label: 'Hidden', description: 'Hide the progress indicator.' },
  { id: 'wave', label: 'Wave', description: 'Sine wave bar that ripples as it fills.' },
  { id: 'segmented', label: 'Segmented', description: 'Block segments light up one by one.' },
  { id: 'stripe', label: 'Stripes', description: 'Diagonal animated stripes show progress.' },
  { id: 'ladder', label: 'Ladder', description: 'Step blocks climb upward with progress.' },
  { id: 'orbit_track', label: 'Orbit track', description: 'Dot orbits a circular track as progress advances.' },
  { id: 'gradient_ring', label: 'Gradient ring', description: 'Rainbow gradient ring with percentage.' },
  { id: 'glitch_bar', label: 'Glitch bar', description: 'Progress bar with RGB glitch jitter.' },
  { id: 'neon_bar', label: 'Neon bar', description: 'Glowing neon tube that fills with light.' },
  { id: 'hologram_ring', label: 'Hologram ring', description: 'Cyan holographic ring with scanline flicker.' },
  { id: 'glitch_percent', label: 'Glitch percent', description: 'Jittery percentage with RGB offset.' },
  { id: 'matrix_stream', label: 'Matrix stream', description: 'Falling code characters inside the bar.' },
  { id: 'scanline_bar', label: 'Scanline bar', description: 'CRT bar with a moving scan beam.' },
  { id: 'hex_segments', label: 'Hex segments', description: 'Hexagonal cells fill in sequence.' },
  { id: 'radar_sweep', label: 'Radar sweep', description: 'Rotating radar arc shows progress.' },
  { id: 'binary', label: 'Binary', description: 'Binary counter climbs with progress.' },
  { id: 'crt_bar', label: 'CRT bar', description: 'Thick retro tube with phosphor glow.' },
  { id: 'hologram_bar', label: 'Hologram bar', description: 'Shimmering holographic fill bar.' },
  { id: 'glitch_dots', label: 'Glitch dots', description: 'Dots jump with chromatic glitch offset.' },
  { id: 'plasma_bar', label: 'Plasma bar', description: 'Swirling plasma energy fills the tube.' },
  { id: 'pixel_blocks', label: 'Pixel blocks', description: 'Retro pixel squares light up in sequence.' },
  { id: 'orbit_dots', label: 'Orbit dots', description: 'Multiple dots race around a circular track.' },
  { id: 'heartbeat', label: 'Heartbeat', description: 'ECG-style pulse line climbs with progress.' },
  { id: 'countdown', label: 'Countdown', description: 'Large numerals tick down as launch completes.' },
  { id: 'fire_trail', label: 'Fire trail', description: 'Flaming gradient bar scorches forward.' },
  { id: 'circuit_trace', label: 'Circuit trace', description: 'Circuit path lights up segment by segment.' },
  { id: 'holo_segments', label: 'Holo segments', description: 'Shimmering holographic blocks fill in.' },
  { id: 'prism_bar', label: 'Prism bar', description: 'Rainbow prism spectrum fills the bar.' },
  { id: 'morse_dash', label: 'Morse dash', description: 'Dashes and dots pulse with progress.' },
];

export const LAUNCH_DURATIONS = [
  { id: 'quick', label: 'Quick', description: 'Short launch sequence (~1.2s).', min_ms: 700, max_ms: 2200 },
  { id: 'normal', label: 'Normal', description: 'Balanced launch timing (~2s).', min_ms: 900, max_ms: 3200 },
  { id: 'slow', label: 'Cinematic', description: 'Longer, more dramatic launch (~3.5s).', min_ms: 1400, max_ms: 4800 },
];

const ANIMATION_IDS = new Set(LAUNCH_ANIMATIONS.map((item) => item.id));
const OVERLAY_MODE_IDS = new Set(LAUNCH_OVERLAY_MODES.map((item) => item.id));
const PROGRESS_STYLE_IDS = new Set(LAUNCH_PROGRESS_STYLES.map((item) => item.id));
const DURATION_IDS = new Set(LAUNCH_DURATIONS.map((item) => item.id));

export function normalizeLaunchAnimation(value) {
  return ANIMATION_IDS.has(value) ? value : DEFAULT_LAUNCH_ANIMATION;
}

export function normalizeLaunchOverlayMode(value) {
  return OVERLAY_MODE_IDS.has(value) ? value : DEFAULT_LAUNCH_OVERLAY_MODE;
}

export function normalizeLaunchProgressStyle(value) {
  return PROGRESS_STYLE_IDS.has(value) ? value : DEFAULT_LAUNCH_PROGRESS_STYLE;
}

export function normalizeLaunchDuration(value) {
  return DURATION_IDS.has(value) ? value : DEFAULT_LAUNCH_DURATION;
}

export function normalizeLaunchConfig(input = {}) {
  return {
    animation_style: normalizeLaunchAnimation(input.animation_style ?? input.launch_animation_style),
    overlay_mode: normalizeLaunchOverlayMode(input.overlay_mode ?? input.launch_overlay_mode),
    progress_style: normalizeLaunchProgressStyle(input.progress_style ?? input.launch_progress_style),
    duration: normalizeLaunchDuration(input.duration ?? input.launch_duration),
    interactive: input.interactive ?? input.launch_interactive ?? DEFAULT_LAUNCH_CONFIG.interactive,
    show_skip: input.show_skip ?? input.launch_show_skip ?? DEFAULT_LAUNCH_CONFIG.show_skip,
    show_hint: input.show_hint ?? input.launch_show_hint ?? DEFAULT_LAUNCH_CONFIG.show_hint,
  };
}

export function launchConfigToFormState(input = {}) {
  const config = normalizeLaunchConfig(input?.launch || input);

  return {
    launch_animation_style: config.animation_style,
    launch_overlay_mode: config.overlay_mode,
    launch_progress_style: config.progress_style,
    launch_duration: config.duration,
    launch_interactive: Boolean(config.interactive),
    launch_show_skip: Boolean(config.show_skip),
    launch_show_hint: Boolean(config.show_hint),
  };
}

export function resetLaunchFormState() {
  return launchConfigToFormState(DEFAULT_LAUNCH_CONFIG);
}

export function mergeLaunchAnimationCatalog(catalog) {
  if (!catalog?.length) return LAUNCH_ANIMATIONS;
  const byId = Object.fromEntries(LAUNCH_ANIMATIONS.map((item) => [item.id, item]));
  return catalog.map((item) => ({ ...byId[item.id], ...item }));
}

export function mergeLaunchOverlayModeCatalog(catalog) {
  const withPlacement = (item) => ({
    ...item,
    placement: item.placement ?? LAUNCH_OVERLAY_PLACEMENT_BY_MODE[item.id] ?? 'fullscreen',
  });

  if (!catalog?.length) {
    return LAUNCH_OVERLAY_MODES.map(withPlacement);
  }

  const byId = Object.fromEntries(LAUNCH_OVERLAY_MODES.map((item) => [item.id, withPlacement(item)]));
  return catalog.map((item) => withPlacement({ ...byId[item.id], ...item }));
}

export function getLaunchOverlayPlacement(mode, catalog) {
  const resolved = normalizeLaunchOverlayMode(mode);
  const meta = mergeLaunchOverlayModeCatalog(catalog).find((item) => item.id === resolved);

  return meta?.placement ?? LAUNCH_OVERLAY_PLACEMENT_BY_MODE[resolved] ?? 'fullscreen';
}

export function mergeLaunchProgressStyleCatalog(catalog) {
  if (!catalog?.length) return LAUNCH_PROGRESS_STYLES;
  const byId = Object.fromEntries(LAUNCH_PROGRESS_STYLES.map((item) => [item.id, item]));
  return catalog.map((item) => ({ ...byId[item.id], ...item }));
}

export function mergeLaunchDurationCatalog(catalog) {
  if (!catalog?.length) return LAUNCH_DURATIONS;
  const byId = Object.fromEntries(LAUNCH_DURATIONS.map((item) => [item.id, item]));
  return catalog.map((item) => ({ ...byId[item.id], ...item }));
}

export function getLaunchAnimationMeta(style, catalog) {
  const options = mergeLaunchAnimationCatalog(catalog);
  return options.find((item) => item.id === normalizeLaunchAnimation(style)) || options[0];
}

export function getLaunchDurationPreset(duration, catalog) {
  const options = mergeLaunchDurationCatalog(catalog);
  return options.find((item) => item.id === normalizeLaunchDuration(duration)) || options.find((item) => item.id === DEFAULT_LAUNCH_DURATION);
}

export function resolveLaunchConfigFromSettings(settings) {
  return normalizeLaunchConfig({
    ...settings?.launch,
    launch_animation_style: settings?.launch_animation_style,
    launch_overlay_mode: settings?.launch_overlay_mode,
    launch_progress_style: settings?.launch_progress_style,
    launch_duration: settings?.launch_duration,
    launch_interactive: settings?.launch_interactive,
    launch_show_skip: settings?.launch_show_skip,
    launch_show_hint: settings?.launch_show_hint,
  });
}

export function shouldShowLaunchOverlay(config) {
  return normalizeLaunchAnimation(config?.animation_style) !== 'none';
}

export const LAUNCH_ANIMATION_CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'glitch', label: 'Glitch' },
  { id: 'hologram', label: 'Hologram' },
  { id: 'space', label: 'Space' },
  { id: 'energy', label: 'Energy' },
  { id: 'liquid', label: 'Liquid' },
  { id: 'nature', label: 'Nature' },
  { id: 'instant', label: 'Instant' },
];

export const COMPACT_LAUNCH_OVERLAY_MODES = new Set(['minimal', 'dock', 'corner', 'top_banner', 'bottom_sheet']);

/** All centered floating panel overlay modes — compact shell_glass sizing and dense content layout. */
export const CENTER_PANEL_LAUNCH_OVERLAY_MODES = new Set(
  Object.entries(LAUNCH_OVERLAY_PLACEMENT_BY_MODE)
    .filter(([, placement]) => placement === 'center')
    .map(([id]) => id),
);

/** @deprecated Use CENTER_PANEL_LAUNCH_OVERLAY_MODES */
export const DENSE_PANEL_LAUNCH_OVERLAY_MODES = CENTER_PANEL_LAUNCH_OVERLAY_MODES;

export const INTERACTIVE_LAUNCH_OVERLAY_MODES = new Set([
  'interactive_glow',
  'tilt',
  'neon_frame',
  'bubble',
  'glass_deep',
  'glitch_frame',
  'glitch_panel',
  'circuit_board',
  'pixel_frame',
  'orbit_frame',
  'clear_glass',
  'shell_glass',
]);

export function isCompactLaunchOverlayMode(mode) {
  return COMPACT_LAUNCH_OVERLAY_MODES.has(normalizeLaunchOverlayMode(mode));
}

export function isDensePanelLaunchOverlayMode(mode) {
  return CENTER_PANEL_LAUNCH_OVERLAY_MODES.has(normalizeLaunchOverlayMode(mode));
}

export function isCenterPanelLaunchOverlayMode(mode) {
  return isDensePanelLaunchOverlayMode(mode);
}

export function isInteractiveLaunchOverlayMode(mode) {
  return INTERACTIVE_LAUNCH_OVERLAY_MODES.has(normalizeLaunchOverlayMode(mode));
}

/** Overlay covers the entire viewport — no underlying UI should peek through. */
export const FULLSCREEN_LAUNCH_OVERLAY_MODES = new Set([
  'fullscreen',
  'blur',
  'frosted',
  'spotlight',
  'gradient',
  'mesh',
  'interactive_glow',
  'split',
  'cinema',
  'glitch_frame',
  'aurora_full',
  'scanlines_full',
  'void',
  'prism_full',
  'circuit_board',
  'hologram_full',
  'vignette',
  'orbit_frame',
  'full_glass',
]);

/** Floating panel centered on screen — underlying app UI remains visible around it. */
export const PANEL_LAUNCH_OVERLAY_MODES = new Set([
  'card',
  'glass',
  'glass_deep',
  'bubble',
  'neon_frame',
  'hologram_panel',
  'prism_edge',
  'tilt',
  'crt_monitor',
  'hexagon_panel',
  'sidebar',
  'mirror',
  'glitch_panel',
  'polaroid',
  'right_rail',
  'stained_glass',
  'pixel_frame',
  'clear_glass',
  'shell_glass',
]);

/**
 * @returns {'fullscreen' | 'panel' | 'docked'}
 */
export function getLaunchOverlayLayoutKind(mode) {
  const resolved = normalizeLaunchOverlayMode(mode);
  if (COMPACT_LAUNCH_OVERLAY_MODES.has(resolved)) return 'docked';
  if (PANEL_LAUNCH_OVERLAY_MODES.has(resolved)) return 'panel';
  return 'fullscreen';
}

export function getLaunchOverlayLayoutLabel(mode, catalog) {
  const resolved = normalizeLaunchOverlayMode(mode);
  const options = mergeLaunchOverlayModeCatalog(catalog);
  const meta = options.find((item) => item.id === resolved);
  const kind = getLaunchOverlayLayoutKind(resolved);

  if (kind === 'fullscreen') {
    return { kind, title: 'Fullscreen', hint: 'Covers the entire screen edge to edge', modeLabel: meta?.label || resolved };
  }
  if (kind === 'docked') {
    return { kind, title: 'Partial overlay', hint: 'Compact bar or corner — most of the app stays visible', modeLabel: meta?.label || resolved };
  }
  return { kind, title: 'Floating panel', hint: 'Centered panel with the app grid visible behind', modeLabel: meta?.label || resolved };
}
