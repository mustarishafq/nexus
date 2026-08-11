export const CHECK_IN_FORM_MAX_FIELDS = 10;
export const CHECK_IN_FORM_AUDIENCE_PUBLIC = 'public';
export const CHECK_IN_FORM_AUDIENCE_EVERYONE = 'everyone';

export const CHECK_IN_FORM_MAX_OPTIONS = 20;
export const CHECK_IN_FORM_MIN_POLL_OPTIONS = 2;

export const CHECK_IN_FORM_TYPES = [
  { value: 'text', label: 'Short text' },
  { value: 'phone', label: 'Phone' },
  { value: 'textarea', label: 'Long text' },
  { value: 'poll', label: 'Poll' },
];

export function defaultCheckInFormFields() {
  return [
    {
      id: 'name',
      key: 'name',
      label: 'Name',
      type: 'text',
      required: false,
    },
  ];
}

export function slugifyCheckInFieldKey(label) {
  const slug = String(label || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);

  return slug || 'field';
}

function uniqueFieldId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `field-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function defaultPollOptions() {
  return [
    { id: uniqueFieldId(), label: 'Option 1' },
    { id: uniqueFieldId(), label: 'Option 2' },
  ];
}

export function normalizePollOptions(options) {
  if (!Array.isArray(options)) {
    return [];
  }

  const seenLabels = new Set();

  return options
    .map((option) => {
      if (typeof option === 'string' || typeof option === 'number') {
        return { id: uniqueFieldId(), label: String(option).trim() };
      }

      if (!option || typeof option !== 'object') {
        return null;
      }

      const label = String(option.label || '').trim();
      if (!label) {
        return null;
      }

      return {
        id: option.id || uniqueFieldId(),
        label,
      };
    })
    .filter((option) => {
      if (!option) {
        return false;
      }

      const key = option.label.toLowerCase();
      if (seenLabels.has(key)) {
        return false;
      }

      seenLabels.add(key);
      return true;
    })
    .slice(0, CHECK_IN_FORM_MAX_OPTIONS);
}

export function isPollField(field) {
  return field?.type === 'poll';
}

export function createCheckInFormField(partial = {}) {
  const label = String(partial.label || 'New field').trim() || 'New field';
  const requestedKey = slugifyCheckInFieldKey(partial.key || label);
  const type = ['text', 'phone', 'textarea', 'poll'].includes(partial.type) ? partial.type : 'text';

  const field = {
    id: partial.id || uniqueFieldId(),
    key: requestedKey === 'email' ? 'field' : requestedKey,
    label,
    type,
    required: Boolean(partial.required),
  };

  if (type === 'poll') {
    const options = normalizePollOptions(partial.options);
    field.multiple = Boolean(partial.multiple);
    field.options = options.length >= CHECK_IN_FORM_MIN_POLL_OPTIONS ? options : defaultPollOptions();
  }

  return field;
}

export function normalizeCheckInFormFields(fields) {
  if (!Array.isArray(fields)) {
    return defaultCheckInFormFields();
  }

  const seen = new Set();

  return fields
    .map((field) => {
      if (!field || typeof field !== 'object') {
        return null;
      }

      const created = createCheckInFormField(field);
      let key = created.key;
      let suffix = 2;

      while (seen.has(key)) {
        key = `${created.key}_${suffix}`.slice(0, 40);
        suffix += 1;
      }

      seen.add(key);
      return { ...created, key };
    })
    .filter(Boolean)
    .slice(0, CHECK_IN_FORM_MAX_FIELDS);
}

export function normalizeCheckInFormAudience(audience) {
  return audience === CHECK_IN_FORM_AUDIENCE_EVERYONE
    ? CHECK_IN_FORM_AUDIENCE_EVERYONE
    : CHECK_IN_FORM_AUDIENCE_PUBLIC;
}

export function extraCheckInFormFields(fields) {
  return (Array.isArray(fields) ? fields : []).filter((field) => field?.key !== 'name');
}

export function staffMustFillCheckInForm(form) {
  return form?.audience === CHECK_IN_FORM_AUDIENCE_EVERYONE
    && Array.isArray(form?.fields)
    && form.fields.length > 0;
}

export function emptyCheckInAnswers(fields) {
  const answers = {};

  (Array.isArray(fields) ? fields : []).forEach((field) => {
    if (!field?.key) {
      return;
    }

    answers[field.key] = field.type === 'poll' && field.multiple ? [] : '';
  });

  return answers;
}

export function formatCheckInAnswer(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean).join(', ');
  }

  return String(value || '').trim();
}

export function pollFieldHasEnoughOptions(field) {
  if (!isPollField(field)) {
    return true;
  }

  return normalizePollOptions(field.options).length >= CHECK_IN_FORM_MIN_POLL_OPTIONS;
}

export function hasCheckInFormFieldKey(fields, key) {
  return (Array.isArray(fields) ? fields : []).some((field) => field?.key === key);
}
