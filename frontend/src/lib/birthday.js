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

function getBirthdaySnoozeKey(userId) {
  return `nexus_birthday_snooze_${userId}`;
}

function getStartOfTomorrowTimestamp() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  return tomorrow.getTime();
}

export function isBirthdayCelebrationSnoozedToday(userId) {
  if (!userId || typeof localStorage === 'undefined') return false;

  try {
    const snoozedUntil = Number(localStorage.getItem(getBirthdaySnoozeKey(userId)) || 0);
    return snoozedUntil > Date.now();
  } catch {
    return false;
  }
}

export function snoozeBirthdayCelebrationForToday(userId) {
  if (!userId || typeof localStorage === 'undefined') return;

  localStorage.setItem(getBirthdaySnoozeKey(userId), String(getStartOfTomorrowTimestamp()));
}

export function shouldShowBirthdayCelebration(user) {
  if (!user?.id || !user?.date_of_birth) return false;
  if (!isBirthdayToday(user.date_of_birth)) return false;
  if (isBirthdayCelebrationSnoozedToday(user.id)) return false;

  return !sessionStorage.getItem(getBirthdayShownKey(user.id));
}

export function markBirthdayCelebrationShown(userId) {
  if (!userId) return;
  sessionStorage.setItem(getBirthdayShownKey(userId), '1');
}

export function clearBirthdayShownKeys() {
  Object.keys(sessionStorage).forEach((key) => {
    if (key.startsWith('nexus_birthday_shown_')) {
      sessionStorage.removeItem(key);
    }
  });
}
