const DISMISSED_KEY_PREFIX = 'location_prompt_dismissed';
const DISMISS_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

function getDismissedKey(userId) {
  return `${DISMISSED_KEY_PREFIX}_${userId}`;
}

export function isLocationPromptDismissed(userId) {
  if (!userId) return true;

  const dismissedAt = localStorage.getItem(getDismissedKey(userId));
  if (!dismissedAt) return false;

  return Date.now() - Number(dismissedAt) < DISMISS_COOLDOWN_MS;
}

export function dismissLocationPrompt(userId) {
  if (!userId) return;
  localStorage.setItem(getDismissedKey(userId), String(Date.now()));
}

export function clearLocationPromptDismissal(userId) {
  if (!userId) return;
  localStorage.removeItem(getDismissedKey(userId));
}
