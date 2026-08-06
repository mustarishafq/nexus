const STORAGE_KEY = 'nexus.reaction-shortcuts';
export const MAX_REACTION_SHORTCUTS = 12;

function readPins() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry) => typeof entry === 'string' && entry.length > 0);
  } catch {
    return [];
  }
}

function writePins(pins) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(pins));
  } catch {
    // Ignore quota / private-mode failures.
  }
}

/**
 * Merge server/default quick reactions with personal pins (deduped, capped).
 */
export function getReactionShortcuts(defaults = []) {
  const base = Array.isArray(defaults) ? defaults.filter(Boolean) : [];
  const pins = readPins().filter((emoji) => !base.includes(emoji));
  return [...base, ...pins].slice(0, MAX_REACTION_SHORTCUTS);
}

/**
 * Pin an emoji onto the personal quick bar (after defaults). Returns the updated list.
 */
export function pinReactionShortcut(emoji, defaults = []) {
  if (!emoji || typeof emoji !== 'string') {
    return getReactionShortcuts(defaults);
  }

  const base = Array.isArray(defaults) ? defaults.filter(Boolean) : [];
  if (base.includes(emoji)) {
    return getReactionShortcuts(defaults);
  }

  const pins = readPins().filter((entry) => entry !== emoji);
  pins.unshift(emoji);

  const maxPins = Math.max(0, MAX_REACTION_SHORTCUTS - base.length);
  writePins(pins.slice(0, maxPins));

  return getReactionShortcuts(defaults);
}
