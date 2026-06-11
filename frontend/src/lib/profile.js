import { format, formatDistanceToNow, parseISO } from 'date-fns';

const PROFILE_CHECKS = [
  { key: 'photo', label: 'Profile photo' },
  { key: 'cover', label: 'Cover photo' },
  { key: 'name', label: 'Display name' },
  { key: 'birthday', label: 'Birthday' },
  { key: 'tenure', label: 'Joined date' },
];

export function getProfileCompleteness(user) {
  if (!user) {
    return { percent: 0, checks: PROFILE_CHECKS.map((item) => ({ ...item, done: false })) };
  }

  const checks = [
    { key: 'photo', label: 'Profile photo', done: Boolean(user.profile_picture) },
    { key: 'cover', label: 'Cover photo', done: Boolean(user.cover_picture) },
    { key: 'name', label: 'Display name', done: Boolean(user.full_name?.trim()) },
    { key: 'birthday', label: 'Birthday', done: Boolean(user.date_of_birth) },
    { key: 'tenure', label: 'Joined date', done: Boolean(user.joined_at) },
  ];

  const doneCount = checks.filter((item) => item.done).length;
  const percent = Math.round((doneCount / checks.length) * 100);

  return { percent, checks };
}

export function formatMemberSince(joinedAt) {
  if (!joinedAt) return null;

  const date = parseISO(String(joinedAt).slice(0, 10));
  return format(date, 'MMMM yyyy');
}

export function formatTenure(joinedAt) {
  if (!joinedAt) return null;

  const start = parseISO(String(joinedAt).slice(0, 10));
  const years = new Date().getFullYear() - start.getFullYear();
  const months = new Date().getMonth() - start.getMonth();
  const totalMonths = years * 12 + months;

  if (totalMonths < 1) return 'New member';
  if (totalMonths < 12) return `${totalMonths} month${totalMonths === 1 ? '' : 's'}`;

  const y = Math.floor(totalMonths / 12);
  const m = totalMonths % 12;
  if (m === 0) return `${y} year${y === 1 ? '' : 's'}`;
  return `${y}y ${m}m`;
}

export function formatBirthdayLabel(dateOfBirth) {
  if (!dateOfBirth) return null;

  const date = parseISO(String(dateOfBirth).slice(0, 10));
  return format(date, 'MMMM d');
}

export function formatRelativeDate(value) {
  if (!value) return '';
  return formatDistanceToNow(new Date(value), { addSuffix: true });
}
