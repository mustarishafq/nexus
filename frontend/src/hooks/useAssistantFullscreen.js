import { useCallback, useEffect, useSyncExternalStore } from 'react';

const STORAGE_KEY = 'nexus-assistant-fullscreen';
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

export function getAssistantFullscreen() {
  return readStored();
}

export function setAssistantFullscreen(enabled) {
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

export function subscribeAssistantFullscreen(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function subscribe(callback) {
  return subscribeAssistantFullscreen(callback);
}

function getSnapshot() {
  return readStored();
}

function getServerSnapshot() {
  return false;
}

export function useAssistantFullscreen() {
  const isFullscreen = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setFullscreen = useCallback((enabled) => {
    setAssistantFullscreen(Boolean(enabled));
  }, []);

  const toggleFullscreen = useCallback(() => {
    setAssistantFullscreen(!readStored());
  }, []);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && readStored()) {
        setAssistantFullscreen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return { isFullscreen, setFullscreen, toggleFullscreen };
}
