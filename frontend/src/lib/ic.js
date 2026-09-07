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

export function dateOfBirthFromIc(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length < 6) return '';

  const yy = Number(digits.slice(0, 2));
  const mm = Number(digits.slice(2, 4));
  const dd = Number(digits.slice(4, 6));
  if (!Number.isInteger(yy) || !Number.isInteger(mm) || !Number.isInteger(dd)) return '';

  const currentYy = new Date().getFullYear() % 100;
  const year = yy <= currentYy ? 2000 + yy : 1900 + yy;
  const date = new Date(year, mm - 1, dd);
  if (date.getFullYear() !== year || date.getMonth() !== mm - 1 || date.getDate() !== dd) {
    return '';
  }

  return `${year}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
}

export function applyIcDateOfBirth(currentDob, ic) {
  if (currentDob) return currentDob;
  return dateOfBirthFromIc(ic) || '';
}
