const PRIORITY_WEIGHT = { critical: 4, high: 3, medium: 2, low: 1 };

export function sortBroadcastsByPriority(broadcasts = []) {
  return [...broadcasts].sort((a, b) => {
    const weightDiff =
      (PRIORITY_WEIGHT[b.priority] || 2) - (PRIORITY_WEIGHT[a.priority] || 2);
    if (weightDiff !== 0) return weightDiff;
    return new Date(b.created_date).getTime() - new Date(a.created_date).getTime();
  });
}

function getAckStorageKey(userId) {
  return `nexus_broadcast_ack_${userId}`;
}

export function getAcknowledgedBroadcastIds(userId) {
  if (!userId) return new Set();

  try {
    const raw = sessionStorage.getItem(getAckStorageKey(userId));
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.map(String) : []);
  } catch {
    return new Set();
  }
}

export function acknowledgeBroadcasts(userId, broadcastIds = []) {
  if (!userId || broadcastIds.length === 0) return;

  const acknowledged = getAcknowledgedBroadcastIds(userId);
  broadcastIds.forEach((id) => acknowledged.add(String(id)));
  sessionStorage.setItem(getAckStorageKey(userId), JSON.stringify([...acknowledged]));
}

export function getUnacknowledgedBroadcasts(userId, broadcasts = []) {
  const acknowledged = getAcknowledgedBroadcastIds(userId);
  return sortBroadcastsByPriority(
    broadcasts.filter((broadcast) => !acknowledged.has(String(broadcast.id)))
  );
}

export function clearBroadcastAckKeys() {
  Object.keys(sessionStorage).forEach((key) => {
    if (key.startsWith('nexus_broadcast_ack_')) {
      sessionStorage.removeItem(key);
    }
  });
}
