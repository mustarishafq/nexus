import { useCallback, useEffect, useSyncExternalStore } from 'react';

const STORAGE_KEY = 'nexus-email-fullscreen';
const listeners = new Set();

function readStored() {
  try {
    return window.sessionStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function emit(value) {
  listeners.forEach((listener) => listener(value));
}

export function getEmailFullscreen() {
  return readStored();
}

export function setEmailFullscreen(enabled) {
  try {
    if (enabled) {
      window.sessionStorage.setItem(STORAGE_KEY, '1');
    } else {
      window.sessionStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // ignore
  }
  emit(Boolean(enabled));
}

export function subscribeEmailFullscreen(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function subscribe(callback) {
  return subscribeEmailFullscreen(callback);
}

function getSnapshot() {
  return readStored();
}

function getServerSnapshot() {
  return false;
}

export function useEmailFullscreen() {
  const isFullscreen = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setFullscreen = useCallback((enabled) => {
    setEmailFullscreen(Boolean(enabled));
  }, []);

  const toggleFullscreen = useCallback(() => {
    setEmailFullscreen(!readStored());
  }, []);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && readStored()) {
        setEmailFullscreen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return { isFullscreen, setFullscreen, toggleFullscreen };
}
