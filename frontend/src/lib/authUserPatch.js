/** Lightweight bridge so non-React modules (claim helpers) can patch auth user. */
let authUserPatcher = null;

export function registerAuthUserPatcher(patcher) {
  authUserPatcher = typeof patcher === 'function' ? patcher : null;
  return () => {
    if (authUserPatcher === patcher) {
      authUserPatcher = null;
    }
  };
}

export function patchAuthUser(partial) {
  if (!partial || typeof partial !== 'object') return;
  authUserPatcher?.(partial);
}
