import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import db from '@/api/apiClient';
import { useAuth } from '@/lib/AuthContext';
import { useVisibleRefetchInterval } from '@/hooks/useVisibleRefetchInterval';

const PRESENCE_POLL_MS = 60_000;

const defaultContext = {
  isOnline: () => false,
  onlineUserIds: new Set(),
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

export default function UserPresenceGate({ children }) {
  const { isAuthenticated } = useAuth();
  const pollInterval = useVisibleRefetchInterval(PRESENCE_POLL_MS);
  const [onlineUserIds, setOnlineUserIds] = useState(() => new Set());

  useEffect(() => {
    if (!isAuthenticated) {
      setOnlineUserIds(new Set());
      return undefined;
    }

    let cancelled = false;

    const refreshOnlineUsers = async () => {
      try {
        const userIds = await db.getOnlineUserIds();
        if (!cancelled) {
          setOnlineUserIds(new Set(userIds.map((id) => Number(id))));
        }
      } catch {
        if (!cancelled) {
          setOnlineUserIds(new Set());
        }
      }
    };

    const sendHeartbeat = () => {
      void db.sendPresenceHeartbeat().catch(() => {});
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
  }), [onlineUserIds]);

  return (
    <UserPresenceContext.Provider value={value}>
      {children}
    </UserPresenceContext.Provider>
  );
}
