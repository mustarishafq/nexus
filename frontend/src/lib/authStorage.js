const AUTH_TOKEN_KEY = 'nexus_auth_token';
const REMEMBER_ME_KEY = 'nexus_remember_me';
const IMPERSONATOR_TOKEN_KEY = 'nexus_impersonator_token';
const IMPERSONATOR_REMEMBER_KEY = 'nexus_impersonator_remember';

export function getAuthToken() {
  return localStorage.getItem(AUTH_TOKEN_KEY) || sessionStorage.getItem(AUTH_TOKEN_KEY);
}

export function setAuthToken(token, { remember = true } = {}) {
  if (remember) {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    localStorage.setItem(REMEMBER_ME_KEY, '1');
    sessionStorage.removeItem(AUTH_TOKEN_KEY);
    return;
  }

  sessionStorage.setItem(AUTH_TOKEN_KEY, token);
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(REMEMBER_ME_KEY);
}

export function clearAuthToken() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  sessionStorage.removeItem(AUTH_TOKEN_KEY);
}

export function getRememberMePreference() {
  return localStorage.getItem(REMEMBER_ME_KEY) !== '0';
}

export function setRememberMePreference(remember) {
  localStorage.setItem(REMEMBER_ME_KEY, remember ? '1' : '0');
}

export function isImpersonating() {
  return Boolean(sessionStorage.getItem(IMPERSONATOR_TOKEN_KEY));
}

export function getImpersonatorToken() {
  return sessionStorage.getItem(IMPERSONATOR_TOKEN_KEY);
}

/**
 * Stash the admin token and activate the preview (target) token.
 * Preview token is always session-scoped.
 */
export function startImpersonationSession(adminToken, targetToken) {
  const rememberAdmin = localStorage.getItem(AUTH_TOKEN_KEY) === adminToken;

  sessionStorage.setItem(IMPERSONATOR_TOKEN_KEY, adminToken);
  sessionStorage.setItem(IMPERSONATOR_REMEMBER_KEY, rememberAdmin ? '1' : '0');
  setAuthToken(targetToken, { remember: false });
}

/**
 * Restore the stashed admin token and clear preview state.
 * @returns {string|null} Restored admin token, or null if none was stashed.
 */
export function stopImpersonationSession() {
  const adminToken = sessionStorage.getItem(IMPERSONATOR_TOKEN_KEY);
  const rememberAdmin = sessionStorage.getItem(IMPERSONATOR_REMEMBER_KEY) !== '0';

  sessionStorage.removeItem(IMPERSONATOR_TOKEN_KEY);
  sessionStorage.removeItem(IMPERSONATOR_REMEMBER_KEY);

  if (!adminToken) {
    clearAuthToken();
    return null;
  }

  setAuthToken(adminToken, { remember: rememberAdmin });
  return adminToken;
}

export function clearImpersonationSession() {
  sessionStorage.removeItem(IMPERSONATOR_TOKEN_KEY);
  sessionStorage.removeItem(IMPERSONATOR_REMEMBER_KEY);
}
