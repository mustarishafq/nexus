import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import db from '@/api/apiClient';
import { useAuth } from '@/lib/AuthContext';
import { useVisibleRefetchInterval } from '@/hooks/useVisibleRefetchInterval';

const PRESENCE_POLL_MS = 60_000;

const defaultContext = {
  isOnline: () => false,
  onlineUserIds: new Set(),
  lastSeenAt: () => null,
};

const UserPresenceContext = createContext(defaultContext);

export function useUserPresence() {
  return useContext(UserPresenceContext);
}

export function useIsUserOnline(userId) {
  const { isOnline } = useUserPresence();

  if (!userId) {
    return false;
  }

  return isOnline(userId);
}

export function useUserLastSeenAt(userId) {
  const { lastSeenAt } = useUserPresence();

  if (!userId) {
    return null;
  }

  return lastSeenAt(userId);
}

export default function UserPresenceGate({ children }) {
  const { isAuthenticated } = useAuth();
  const pollInterval = useVisibleRefetchInterval(PRESENCE_POLL_MS);
  const [onlineUserIds, setOnlineUserIds] = useState(() => new Set());
  const [lastSeenByUserId, setLastSeenByUserId] = useState(() => ({}));
  const lastSeenRef = useRef({});

  useEffect(() => {
    if (!isAuthenticated) {
      setOnlineUserIds(new Set());
      setLastSeenByUserId({});
      lastSeenRef.current = {};
      return undefined;
    }

    let cancelled = false;

    const mergeLastSeen = (lastSeen = {}) => {
      const next = { ...lastSeenRef.current };
      Object.entries(lastSeen).forEach(([id, value]) => {
        if (typeof value === 'string' && value) {
          next[Number(id)] = value;
        }
      });
      lastSeenRef.current = next;
      setLastSeenByUserId(next);
    };

    const refreshOnlineUsers = async () => {
      try {
        const payload = await db.getOnlinePresence();
        if (!cancelled) {
          setOnlineUserIds(new Set((payload.userIds || []).map((id) => Number(id))));
          mergeLastSeen(payload.lastSeen || {});
        }
      } catch {
        if (!cancelled) {
          setOnlineUserIds(new Set());
        }
      }
    };

    const sendHeartbeat = () => {
      void db.sendPresenceHeartbeat()
        .then((payload) => {
          if (cancelled || !payload?.last_login_at) {
            return;
          }
          // Heartbeat confirms *this* browser session is active; last_seen for
          // other users still comes from the online poll.
        })
        .catch(() => {});
    };

    sendHeartbeat();
    void refreshOnlineUsers();

    if (!pollInterval) {
      return () => {
        cancelled = true;
      };
    }

    const heartbeatTimer = window.setInterval(sendHeartbeat, pollInterval);
    const onlineTimer = window.setInterval(() => {
      void refreshOnlineUsers();
    }, pollInterval);

    return () => {
      cancelled = true;
      window.clearInterval(heartbeatTimer);
      window.clearInterval(onlineTimer);
    };
  }, [isAuthenticated, pollInterval]);

  const value = useMemo(() => ({
    onlineUserIds,
    isOnline: (userId) => {
      if (!userId) {
        return false;
      }

      return onlineUserIds.has(Number(userId));
    },
    lastSeenAt: (userId) => {
      if (!userId) {
        return null;
      }

      return lastSeenByUserId[Number(userId)] || null;
    },
  }), [onlineUserIds, lastSeenByUserId]);

  return (
    <UserPresenceContext.Provider value={value}>
      {children}
    </UserPresenceContext.Provider>
  );
}
