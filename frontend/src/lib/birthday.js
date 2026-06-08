import { format } from 'date-fns';

export function isBirthdayToday(dateOfBirth) {
  if (!dateOfBirth) return false;

  const dob = String(dateOfBirth).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) return false;

  const [, month, day] = dob.split('-');
  const today = format(new Date(), 'MM-dd');

  return `${month}-${day}` === today;
}

export function getBirthdayAge(dateOfBirth) {
  if (!dateOfBirth) return null;

  const dob = String(dateOfBirth).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) return null;

  const birthYear = Number(dob.slice(0, 4));
  const todayYear = new Date().getFullYear();

  return todayYear - birthYear;
}

export function getBirthdayShownKey(userId) {
  const today = format(new Date(), 'yyyy-MM-dd');
  return `nexus_birthday_shown_${userId}_${today}`;
}

export function clearBirthdayShownKeys() {
  Object.keys(sessionStorage).forEach((key) => {
    if (key.startsWith('nexus_birthday_shown_')) {
      sessionStorage.removeItem(key);
    }
  });
}
