import { format, formatDistanceToNow, parseISO } from 'date-fns';

export const EMPLOYMENT_TYPE_LABELS = {
  full_time: 'Full-time',
  part_time: 'Part-time',
  contract: 'Contract',
};

export const GENDER_OPTIONS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];

export function normalizeEducationHistory(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => ({
      institution: String(item?.institution || '').trim(),
      qualification: String(item?.qualification || '').trim(),
      field_of_study: String(item?.field_of_study || '').trim(),
      year_from: String(item?.year_from || '').trim(),
      year_to: String(item?.year_to || '').trim(),
    }))
    .filter((item) => item.institution)
    .slice(0, 10);
}

export function normalizeWorkHistory(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => ({
      company: String(item?.company || '').trim(),
      job_title: String(item?.job_title || '').trim(),
      date_from: String(item?.date_from || '').trim(),
      date_to: String(item?.date_to || '').trim(),
      description: String(item?.description || '').trim(),
    }))
    .filter((item) => item.company)
    .slice(0, 15);
}

export function educationHistoryIsEqual(a, b) {
  return JSON.stringify(normalizeEducationHistory(a)) === JSON.stringify(normalizeEducationHistory(b));
}

export function workHistoryIsEqual(a, b) {
  return JSON.stringify(normalizeWorkHistory(a)) === JSON.stringify(normalizeWorkHistory(b));
}

export function formatHistoryRange(from, to) {
  if (!from && !to) return '';
  if (from && to) return `${from} – ${to}`;
  return from || to;
}

export function getEmploymentTypeLabel(value) {
  return EMPLOYMENT_TYPE_LABELS[value] || value || null;
}

export function getGenderLabel(value) {
  return GENDER_OPTIONS.find((option) => option.value === value)?.label || value || null;
}

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
  { key: 'work_phone', label: 'Work phone' },
  { key: 'birthday', label: 'Birthday' },
  { key: 'tenure', label: 'Joined date' },
  { key: 'education', label: 'Education history' },
  { key: 'work_history', label: 'Work history' },
  { key: 'emergency_contact', label: 'Emergency contact' },
  { key: 'gender', label: 'Gender' },
];

function isProfileCheckDone(user, key) {
  switch (key) {
    case 'photo':
      return Boolean(user.profile_picture);
    case 'cover':
      return Boolean(user.cover_picture);
    case 'name':
      return Boolean(user.name?.trim());
    case 'full_name':
      return Boolean(user.full_name?.trim());
    case 'bio':
      return Boolean(user.bio?.trim());
    case 'department':
      return Boolean(user.department?.trim());
    case 'work_phone':
      return Boolean(user.work_phone?.trim());
    case 'birthday':
      return Boolean(user.date_of_birth);
    case 'tenure':
      return Boolean(user.joined_at);
    case 'education':
      return normalizeEducationHistory(user.education_history).length > 0;
    case 'work_history':
      return normalizeWorkHistory(user.work_history).length > 0;
    case 'emergency_contact':
      return Boolean(user.emergency_contact_name?.trim()) && Boolean(user.emergency_contact_phone?.trim());
    case 'gender':
      return Boolean(user.gender?.trim());
    default:
      return false;
  }
}

export function getProfileCompleteness(user) {
  if (!user) {
    return { percent: 0, checks: PROFILE_CHECKS.map((item) => ({ ...item, done: false })) };
  }

  const checks = PROFILE_CHECKS.map((item) => ({
    ...item,
    done: isProfileCheckDone(user, item.key),
  }));

  const doneCount = checks.filter((item) => item.done).length;
  const percent = Math.round((doneCount / checks.length) * 100);

  return { percent, checks };
}

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

export function getOrgChartHref(departmentId = null) {
  if (departmentId) {
    return `/organization?department=${departmentId}`;
  }
  return '/organization';
}
