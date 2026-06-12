import { format, formatDistanceToNow, parseISO } from 'date-fns';

export function getDisplayName(user, fallback = 'User') {
  if (!user) return fallback;
  return user.name?.trim() || user.full_name?.trim() || user.email || fallback;
}

const PROFILE_CHECKS = [
  { key: 'photo', label: 'Profile photo' },
  { key: 'cover', label: 'Cover photo' },
  { key: 'name', label: 'Display name' },
  { key: 'full_name', label: 'Full name' },
  { key: 'bio', label: 'Bio' },
  { key: 'department', label: 'Department' },
  { key: 'birthday', label: 'Birthday' },
  { key: 'tenure', label: 'Joined date' },
];

export function normalizeSkills(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean).slice(0, 10);
  }

  if (typeof value !== 'string') {
    return [];
  }

  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 10);
}

export function formatSkillsInput(skills) {
  return normalizeSkills(skills).join(', ');
}

export function skillsAreEqual(a, b) {
  const left = normalizeSkills(a);
  const right = normalizeSkills(b);
  return left.length === right.length && left.every((item, index) => item === right[index]);
}

export function getProfileCompleteness(user) {
  if (!user) {
    return { percent: 0, checks: PROFILE_CHECKS.map((item) => ({ ...item, done: false })) };
  }

  const checks = [
    { key: 'photo', label: 'Profile photo', done: Boolean(user.profile_picture) },
    { key: 'cover', label: 'Cover photo', done: Boolean(user.cover_picture) },
    { key: 'name', label: 'Display name', done: Boolean(user.name?.trim()) },
    { key: 'full_name', label: 'Full name', done: Boolean(user.full_name?.trim()) },
    { key: 'bio', label: 'Bio', done: Boolean(user.bio?.trim()) },
    { key: 'department', label: 'Department', done: Boolean(user.department?.trim()) },
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
