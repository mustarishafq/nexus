import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { normalizePhoneNumber } from '@/lib/phone';
import { normalizeIcNumber } from '@/lib/ic';

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

export const MARITAL_STATUS_OPTIONS = [
  { value: 'single', label: 'Single' },
  { value: 'married', label: 'Married' },
  { value: 'divorced', label: 'Divorced' },
  { value: 'widowed', label: 'Widowed' },
  { value: 'separated', label: 'Separated' },
];

export const RELIGION_OPTIONS = [
  { value: 'islam', label: 'Islam' },
  { value: 'buddhism', label: 'Buddhism' },
  { value: 'christianity', label: 'Christianity' },
  { value: 'hinduism', label: 'Hinduism' },
  { value: 'sikhism', label: 'Sikhism' },
  { value: 'other', label: 'Other' },
];

export const RACE_OPTIONS = [
  { value: 'malay', label: 'Malay' },
  { value: 'chinese', label: 'Chinese' },
  { value: 'indian', label: 'Indian' },
  { value: 'bumiputera', label: 'Bumiputera' },
  { value: 'other', label: 'Other' },
];

export const EMPTY_SPOUSE_DETAILS = {
  full_name: '',
  ic_number: '',
  phone: '',
  occupation: '',
  employer_name: '',
  employer_address: '',
};

export const CHILDREN_FIELDS = [
  { key: 'name', label: 'Child name', placeholder: 'Full name' },
  { key: 'age', label: 'Age', placeholder: 'e.g. 8' },
];

export const SPOUSE_FIELDS = [
  { key: 'full_name', label: 'Full name', placeholder: 'Spouse full name' },
  { key: 'ic_number', label: 'IC no.', placeholder: 'e.g. 900101-01-1234' },
  { key: 'phone', label: 'Phone no.', placeholder: 'e.g. +60123456789' },
  { key: 'occupation', label: 'Occupation', placeholder: 'e.g. Teacher' },
  { key: 'employer_name', label: "Employer's name", placeholder: 'Company or organisation' },
  { key: 'employer_address', label: "Employer's address", placeholder: 'Full address', type: 'textarea', fullWidth: true },
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

export function getMaritalStatusLabel(value) {
  return MARITAL_STATUS_OPTIONS.find((option) => option.value === value)?.label || value || null;
}

export function getReligionLabel(value) {
  return RELIGION_OPTIONS.find((option) => option.value === value)?.label || value || null;
}

export function getRaceLabel(value) {
  return RACE_OPTIONS.find((option) => option.value === value)?.label || value || null;
}

export function normalizeSpouseDetails(value) {
  const source = value && typeof value === 'object' ? value : EMPTY_SPOUSE_DETAILS;

  return {
    full_name: String(source.full_name || '').trim(),
    ic_number: normalizeIcNumber(source.ic_number) || '',
    phone: normalizePhoneNumber(source.phone) || '',
    occupation: String(source.occupation || '').trim(),
    employer_name: String(source.employer_name || '').trim(),
    employer_address: String(source.employer_address || '').trim(),
  };
}

export function normalizeChildren(value) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => ({
      name: String(item?.name || '').trim(),
      age: String(item?.age || '').trim(),
    }))
    .filter((item) => item.name)
    .slice(0, 10);
}

export function spouseDetailsIsEqual(a, b) {
  return JSON.stringify(normalizeSpouseDetails(a)) === JSON.stringify(normalizeSpouseDetails(b));
}

export function childrenAreEqual(a, b) {
  return JSON.stringify(normalizeChildren(a)) === JSON.stringify(normalizeChildren(b));
}

export function buildHrProfileForm(user) {
  return {
    place_of_birth: user?.place_of_birth || '',
    nationality: user?.nationality || '',
    religion: user?.religion || '',
    race: user?.race || '',
    marital_status: user?.marital_status || '',
    current_address: user?.current_address || '',
    home_phone: user?.home_phone || '',
    ic_number: user?.ic_number || '',
    epf_number: user?.epf_number || '',
    socso_number: user?.socso_number || '',
    income_tax_number: user?.income_tax_number || '',
    emergency_contact_name: user?.emergency_contact_name || '',
    emergency_contact_phone: user?.emergency_contact_phone || '',
    next_of_kin_relationship: user?.next_of_kin_relationship || '',
    next_of_kin_ic_number: user?.next_of_kin_ic_number || '',
    next_of_kin_nationality: user?.next_of_kin_nationality || '',
    next_of_kin_occupation: user?.next_of_kin_occupation || '',
    next_of_kin_address: user?.next_of_kin_address || '',
    spouse_details: normalizeSpouseDetails(user?.spouse_details),
    children: normalizeChildren(user?.children),
    gender: user?.gender || '',
  };
}

export function hrProfileFormIsDirty(form, user) {
  if (!user) return false;

  const baseline = buildHrProfileForm(user);

  return (
    form.place_of_birth !== baseline.place_of_birth ||
    form.nationality !== baseline.nationality ||
    form.religion !== baseline.religion ||
    form.race !== baseline.race ||
    form.marital_status !== baseline.marital_status ||
    form.current_address !== baseline.current_address ||
    form.home_phone !== baseline.home_phone ||
    form.ic_number !== baseline.ic_number ||
    form.epf_number !== baseline.epf_number ||
    form.socso_number !== baseline.socso_number ||
    form.income_tax_number !== baseline.income_tax_number ||
    form.emergency_contact_name !== baseline.emergency_contact_name ||
    form.emergency_contact_phone !== baseline.emergency_contact_phone ||
    form.next_of_kin_relationship !== baseline.next_of_kin_relationship ||
    form.next_of_kin_ic_number !== baseline.next_of_kin_ic_number ||
    form.next_of_kin_nationality !== baseline.next_of_kin_nationality ||
    form.next_of_kin_occupation !== baseline.next_of_kin_occupation ||
    form.next_of_kin_address !== baseline.next_of_kin_address ||
    form.gender !== baseline.gender ||
    !spouseDetailsIsEqual(form.spouse_details, baseline.spouse_details) ||
    !childrenAreEqual(form.children, baseline.children)
  );
}

export function buildHrProfilePayload(form) {
  const spouse = normalizeSpouseDetails(form.spouse_details);
  const hasSpouse = Object.values(spouse).some(Boolean);

  return {
    place_of_birth: form.place_of_birth?.trim() || null,
    nationality: form.nationality?.trim() || null,
    religion: form.religion || null,
    race: form.race || null,
    marital_status: form.marital_status || null,
    current_address: form.current_address?.trim() || null,
    home_phone: normalizePhoneNumber(form.home_phone) || null,
    ic_number: normalizeIcNumber(form.ic_number) || null,
    epf_number: form.epf_number?.trim() || null,
    socso_number: form.socso_number?.trim() || null,
    income_tax_number: form.income_tax_number?.trim() || null,
    emergency_contact_name: form.emergency_contact_name?.trim() || null,
    emergency_contact_phone: normalizePhoneNumber(form.emergency_contact_phone) || null,
    next_of_kin_relationship: form.next_of_kin_relationship?.trim() || null,
    next_of_kin_ic_number: normalizeIcNumber(form.next_of_kin_ic_number) || null,
    next_of_kin_nationality: form.next_of_kin_nationality?.trim() || null,
    next_of_kin_occupation: form.next_of_kin_occupation?.trim() || null,
    next_of_kin_address: form.next_of_kin_address?.trim() || null,
    gender: form.gender || null,
    spouse_details: hasSpouse ? spouse : null,
    children: normalizeChildren(form.children).length > 0 ? normalizeChildren(form.children) : null,
  };
}

export function getDisplayName(user, fallback = 'User') {
  if (!user) return fallback;
  return user.name?.trim() || user.full_name?.trim() || user.email || fallback;
}

const PROFILE_CHECKS = [
  { key: 'photos', label: 'Profile & cover photo' },
  { key: 'name', label: 'Display & full name' },
  { key: 'bio', label: 'Bio' },
  { key: 'department', label: 'Department' },
  { key: 'work_phone', label: 'Work phone' },
  { key: 'dates', label: 'Birthday & joined date' },
  { key: 'background', label: 'Education or experience' },
  { key: 'hr_private', label: 'HR & private details' },
];

function isProfileCheckDone(user, key) {
  switch (key) {
    case 'photos':
      return Boolean(user.profile_picture) && Boolean(user.cover_picture);
    case 'name':
      return Boolean(user.name?.trim()) && Boolean(user.full_name?.trim());
    case 'bio':
      return Boolean(user.bio?.trim());
    case 'department':
      return Boolean(user.department?.trim());
    case 'work_phone':
      return Boolean(user.work_phone?.trim());
    case 'dates':
      return Boolean(user.date_of_birth) && Boolean(user.joined_at);
    case 'background':
      return normalizeEducationHistory(user.education_history).length > 0
        || normalizeWorkHistory(user.work_history).length > 0;
    case 'hr_private':
      return Boolean(user.gender?.trim())
        && Boolean(user.nationality?.trim())
        && Boolean(user.ic_number?.trim())
        && Boolean(user.current_address?.trim())
        && Boolean(user.emergency_contact_name?.trim())
        && Boolean(user.emergency_contact_phone?.trim())
        && Boolean(user.next_of_kin_relationship?.trim());
    default:
      return false;
  }
}

export function getProfileCompleteness(user) {
  if (!user) {
    return { percent: 0, doneCount: 0, totalCount: PROFILE_CHECKS.length, checks: PROFILE_CHECKS.map((item) => ({ ...item, done: false })) };
  }

  // Prefer server-computed completeness — public profile payloads strip private fields
  // (full_name, HR details) that the client checklist needs, which under-reports strength.
  if (user.profile_completeness) {
    const { percent, done_count, total_count, checks } = user.profile_completeness;
    return {
      percent: Number(percent) || 0,
      doneCount: Number(done_count) || 0,
      totalCount: Number(total_count) || PROFILE_CHECKS.length,
      checks: (checks || []).map((item) => ({
        key: item.key,
        label: item.label,
        done: Boolean(item.done),
      })),
    };
  }

  const checks = PROFILE_CHECKS.map((item) => ({
    ...item,
    done: isProfileCheckDone(user, item.key),
  }));

  const doneCount = checks.filter((item) => item.done).length;
  const totalCount = checks.length;
  const percent = Math.round((doneCount / totalCount) * 100);

  return { percent, doneCount, totalCount, checks };
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
