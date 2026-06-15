/**
 * Malaysian NRIC: XXXXXX-XX-XXXX (12 digits).
 */
export function normalizeIcNumber(value) {
  if (value == null) return '';

  const digits = String(value).replace(/\D/g, '').slice(0, 12);
  if (!digits) return '';

  return formatIcNumber(digits);
}

export function formatIcNumber(value) {
  if (value == null) return '';

  const digits = String(value).replace(/\D/g, '').slice(0, 12);
  if (!digits) return '';

  if (digits.length <= 6) return digits;
  if (digits.length <= 8) return `${digits.slice(0, 6)}-${digits.slice(6)}`;

  return `${digits.slice(0, 6)}-${digits.slice(6, 8)}-${digits.slice(8)}`;
}
