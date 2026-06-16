import db from '@/api/base44Client';
import { getAuthToken } from '@/lib/authStorage';
import { getDeviceInfo } from '@/lib/deviceInfo';

const INTERVAL_MS = 60 * 60 * 1000;
const LOCK_TTL_MS = 10 * 60 * 1000;
const LAST_RUN_KEY = 'nexus_network_health_last_run';
const LOCK_KEY = 'nexus_network_health_lock';
const CHANNEL_NAME = 'nexus_network_health';
const MAX_RETRIES = 2;

const TAB_ID = typeof crypto !== 'undefined' && crypto.randomUUID
  ? crypto.randomUUID()
  : `tab-${Date.now()}-${Math.random().toString(36).slice(2)}`;

let channel = null;
let intervalId = null;
let running = false;

function getApiBase() {
  return `${import.meta.env.VITE_API_BASE_URL || ''}/api`;
}

function readLock() {
  try {
    const raw = localStorage.getItem(LOCK_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeLock() {
  localStorage.setItem(LOCK_KEY, JSON.stringify({
    tabId: TAB_ID,
    expiresAt: Date.now() + LOCK_TTL_MS,
  }));
}

function releaseLock() {
  const lock = readLock();
  if (lock?.tabId === TAB_ID) {
    localStorage.removeItem(LOCK_KEY);
  }
}

function acquireLock() {
  const now = Date.now();
  const lock = readLock();

  if (lock && lock.expiresAt > now && lock.tabId !== TAB_ID) {
    return false;
  }

  writeLock();
  return true;
}

function getLastRun() {
  const value = localStorage.getItem(LAST_RUN_KEY);
  return value ? Number(value) : 0;
}

function setLastRun(timestamp) {
  localStorage.setItem(LAST_RUN_KEY, String(timestamp));
}

function shouldRunNow() {
  return Date.now() - getLastRun() >= INTERVAL_MS;
}

function broadcast(message) {
  channel?.postMessage({ ...message, tabId: TAB_ID });
}

async function withRetries(fn, retries = MAX_RETRIES) {
  let lastError = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
  }

  throw lastError;
}

async function measureLatency() {
  const samples = [];

  for (let i = 0; i < 3; i += 1) {
    const start = performance.now();
    await withRetries(() => db.networkHealth.ping());
    samples.push(performance.now() - start);
  }

  return Math.round(samples.reduce((sum, value) => sum + value, 0) / samples.length);
}

async function measureDownloadSpeed() {
  const token = getAuthToken();
  const start = performance.now();

  const response = await withRetries(async () => {
    const res = await fetch(`${getApiBase()}/network-health/download-test`, {
      method: 'GET',
      headers: {
        Accept: 'application/octet-stream',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: 'include',
      cache: 'no-store',
    });

    if (!res.ok) {
      throw new Error(`Download test failed: HTTP ${res.status}`);
    }

    return res;
  });

  const buffer = await response.arrayBuffer();
  const durationSec = (performance.now() - start) / 1000;
  const bits = buffer.byteLength * 8;

  return Number(((bits / durationSec) / 1_000_000).toFixed(2));
}

async function measureUploadSpeed() {
  const token = getAuthToken();
  const payload = new Uint8Array(131072);
  const blob = new Blob([payload], { type: 'application/octet-stream' });
  const formData = new FormData();
  formData.append('file', blob, 'network-health-upload-test.bin');

  const start = performance.now();

  await withRetries(async () => {
    const res = await fetch(`${getApiBase()}/network-health/upload-test`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
      credentials: 'include',
    });

    if (!res.ok) {
      throw new Error(`Upload test failed: HTTP ${res.status}`);
    }

    return res.json();
  });

  const durationSec = (performance.now() - start) / 1000;
  const bits = payload.byteLength * 8;

  return Number(((bits / durationSec) / 1_000_000).toFixed(2));
}

async function runHealthCheck() {
  if (running || !getAuthToken()) {
    return;
  }

  if (!shouldRunNow()) {
    return;
  }

  if (!acquireLock()) {
    return;
  }

  running = true;
  broadcast({ type: 'test_started' });

  try {
    const [latencyMs, downloadMbps, uploadMbps, clientInfo] = await Promise.all([
      measureLatency().catch(() => null),
      measureDownloadSpeed().catch(() => null),
      measureUploadSpeed().catch(() => null),
      withRetries(() => db.networkHealth.clientInfo()).catch(() => ({ ip_address: null })),
    ]);

    const deviceInfo = getDeviceInfo();

    await db.networkHealth.saveLog({
      latency_ms: latencyMs,
      download_mbps: downloadMbps,
      upload_mbps: uploadMbps,
      ...deviceInfo,
      ip_address: clientInfo?.ip_address || null,
      tested_at: new Date().toISOString(),
    });

    const now = Date.now();
    setLastRun(now);
    broadcast({ type: 'test_complete', testedAt: now });
  } catch (error) {
    if (error?.status !== 409) {
      console.warn('Network health check failed:', error);
    } else {
      const now = Date.now();
      setLastRun(now);
      broadcast({ type: 'test_complete', testedAt: now });
    }
  } finally {
    running = false;
    releaseLock();
  }
}

function scheduleNext(delay = INTERVAL_MS) {
  if (intervalId) {
    clearTimeout(intervalId);
  }

  intervalId = setTimeout(async () => {
    await runHealthCheck();
    scheduleNext();
  }, delay);
}

function handleChannelMessage(event) {
  if (event.data?.tabId === TAB_ID) {
    return;
  }

  if (event.data?.type === 'test_complete' && event.data.testedAt) {
    setLastRun(event.data.testedAt);
  }
}

function handleStorageEvent(event) {
  if (event.key === LAST_RUN_KEY && event.newValue) {
    // Another tab completed a test.
  }
}

export function startNetworkHealthMonitor() {
  if (typeof window === 'undefined') {
    return () => {};
  }

  channel = new BroadcastChannel(CHANNEL_NAME);
  channel.addEventListener('message', handleChannelMessage);
  window.addEventListener('storage', handleStorageEvent);

  const initialDelay = shouldRunNow() ? 5000 : Math.max(INTERVAL_MS - (Date.now() - getLastRun()), 60000);

  setTimeout(() => {
    runHealthCheck();
  }, initialDelay);

  scheduleNext(initialDelay + INTERVAL_MS);

  return stopNetworkHealthMonitor;
}

export function stopNetworkHealthMonitor() {
  if (intervalId) {
    clearTimeout(intervalId);
    intervalId = null;
  }

  channel?.removeEventListener('message', handleChannelMessage);
  channel?.close();
  channel = null;

  window.removeEventListener('storage', handleStorageEvent);
  releaseLock();
  running = false;
}
