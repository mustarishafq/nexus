/**
 * Normalize a phone value to E.164-style storage: + followed by digits only.
 */
export function normalizePhoneNumber(value) {
  if (value == null) return '';

  const trimmed = String(value).trim();
  if (!trimmed) return '';

  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return '';

  // Malaysian local numbers: 01X… or 0X… landline
  if (digits.startsWith('01') || (digits.startsWith('0') && digits.length >= 9)) {
    return `+60${digits.slice(1)}`;
  }

  if (digits.startsWith('60')) {
    return `+${digits}`;
  }

  // Bare mobile without leading zero (19…, 11…, etc.)
  if (/^1\d/.test(digits) && digits.length >= 9 && digits.length <= 11) {
    return `+60${digits}`;
  }

  if (hasPlus) {
    return `+${digits}`;
  }

  return digits;
}

function formatMalaysianDigits(digits) {
  const national = digits.startsWith('60') ? digits.slice(2) : digits;
  if (!national) return '+60';

  // Mobile (1X…)
  if (national.startsWith('1')) {
    if (national.length <= 2) return `+60 ${national}`;
    if (national.length <= 5) return `+60 ${national.slice(0, 2)}-${national.slice(2)}`;
    if (national.length <= 9) {
      return `+60 ${national.slice(0, 2)}-${national.slice(2, 5)} ${national.slice(5)}`;
    }
    if (national.length === 10) {
      return `+60 ${national.slice(0, 2)}-${national.slice(2, 6)} ${national.slice(6)}`;
    }
    return `+60 ${national.slice(0, 2)}-${national.slice(2, 6)} ${national.slice(6, 10)} ${national.slice(10)}`.trim();
  }

  // Landline — single-digit area codes (3 KL, 4, 5, 6, 7, 9)
  if (/^[345679]/.test(national)) {
    if (national.length <= 1) return `+60 ${national}`;
    if (national.length <= 5) return `+60 ${national.slice(0, 1)}-${national.slice(1)}`;
    const main = `+60 ${national.slice(0, 1)}-${national.slice(1, 5)} ${national.slice(5, 9)}`.trim();
    return national.length > 9 ? `${main} ${national.slice(9)}` : main;
  }

  // Two-digit area codes (82, 84, 86, 88, …)
  if (national.length <= 2) return `+60 ${national}`;
  if (national.length <= 6) return `+60 ${national.slice(0, 2)}-${national.slice(2)}`;
  const main = `+60 ${national.slice(0, 2)}-${national.slice(2, 6)} ${national.slice(6, 10)}`.trim();
  return national.length > 10 ? `${main} ${national.slice(10)}` : main;
}

/**
 * Format a phone number for display. Handles Malaysian +60 numbers and generic international.
 */
export function formatPhoneNumber(value) {
  if (value == null) return '';

  const trimmed = String(value).trim();
  if (!trimmed) return '';

  const normalized = normalizePhoneNumber(trimmed);
  const digits = normalized.replace(/\D/g, '');

  if (!digits) return trimmed;

  if (digits.startsWith('60')) {
    return formatMalaysianDigits(digits);
  }

  // Generic international fallback
  if (normalized.startsWith('+')) {
    if (digits.length <= 2) return `+${digits}`;
    if (digits.length <= 5) return `+${digits.slice(0, 2)} ${digits.slice(2)}`;
    if (digits.length <= 8) return `+${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5)}`;
    return `+${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`.trim();
  }

  // Local Malaysian without country code
  if (digits.startsWith('0')) {
    return formatMalaysianDigits(`60${digits.slice(1)}`);
  }

  return trimmed;
}

/**
 * tel: href target — normalized E.164 when possible.
 */
export function phoneTelHref(value) {
  const normalized = normalizePhoneNumber(value);
  return normalized ? `tel:${normalized}` : null;
}
