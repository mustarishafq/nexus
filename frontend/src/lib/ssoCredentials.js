export function buildLaunchOptions({ primary_email: primaryEmail, launch_options: launchOptions } = {}) {
  if (Array.isArray(launchOptions) && launchOptions.length > 0) {
    return launchOptions;
  }

  const email = typeof primaryEmail === 'string' ? primaryEmail.trim() : '';
  if (!email) return [];

  return [{
    id: 'primary',
    email,
    label: 'Nexus account',
    primary: true,
  }];
}

export function shouldPromptForSsoCredential(options = []) {
  return options.length > 1;
}

export function defaultSsoEmail(options = []) {
  return options[0]?.email ?? null;
}

export const SSO_SELECTION_CANCELLED_MESSAGE = 'SSO account selection cancelled.';

export function isSsoSelectionCancelled(error) {
  return error?.message === SSO_SELECTION_CANCELLED_MESSAGE;
}

let pickerHandler = null;

export function registerSsoCredentialPicker(handler) {
  pickerHandler = handler;

  return () => {
    if (pickerHandler === handler) {
      pickerHandler = null;
    }
  };
}

export async function pickSsoEmailForLaunch(application, fetchLaunchOptions) {
  if (!application || application.auth_mode === 'redirect') {
    return null;
  }

  const payload = await fetchLaunchOptions(application.id);
  const options = buildLaunchOptions(payload);

  if (!shouldPromptForSsoCredential(options)) {
    return defaultSsoEmail(options);
  }

  if (!pickerHandler) {
    return defaultSsoEmail(options);
  }

  return pickerHandler({ application, options });
}
