const AUTH_TOKEN_KEY = 'nexus_auth_token';
const REMEMBER_ME_KEY = 'nexus_remember_me';

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
