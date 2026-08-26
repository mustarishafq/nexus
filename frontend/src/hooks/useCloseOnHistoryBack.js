import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

const OVERLAY_STATE_KEY = '__closeOnBack';

function currentHistoryState() {
  const state = window.history.state;
  return state && typeof state === 'object' ? state : {};
}

function ensureOverlayHistoryEntry() {
  const state = currentHistoryState();
  if (state[OVERLAY_STATE_KEY]) {
    return;
  }

  window.history.pushState({ ...state, [OVERLAY_STATE_KEY]: true }, '');
}

function swallowNextPopState() {
  const swallow = (event) => {
    event.stopImmediatePropagation();
  };

  window.addEventListener('popstate', swallow, true);
  window.history.back();
  window.setTimeout(() => {
    window.removeEventListener('popstate', swallow, true);
  }, 50);
}

/**
 * While `open` is true, browser/PWA back closes the overlay instead of
 * leaving the current page. Closing via the UI also drops the dummy history
 * entry so the next back still goes to the previous page.
 */
export function useCloseOnHistoryBack(open, onClose) {
  const location = useLocation();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const pushedRef = useRef(false);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    ensureOverlayHistoryEntry();
    pushedRef.current = true;
  }, [open, location.pathname, location.search, location.key]);

  useEffect(() => {
    if (!open || typeof onCloseRef.current !== 'function') {
      return undefined;
    }

    const onPopState = (event) => {
      event.stopImmediatePropagation();
      pushedRef.current = false;
      onCloseRef.current?.();
    };

    window.addEventListener('popstate', onPopState, true);

    return () => {
      window.removeEventListener('popstate', onPopState, true);
      if (!pushedRef.current) {
        return;
      }

      pushedRef.current = false;
      if (currentHistoryState()[OVERLAY_STATE_KEY]) {
        swallowNextPopState();
      }
    };
  }, [open]);
}
