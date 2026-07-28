import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';
import { useWebPush } from '@/hooks/useWebPush';
import { isWebPushPromptDismissed } from '@/lib/webPushPrompt';
import {
  dismissLocationPrompt,
  isLocationPromptDismissed,
} from '@/lib/locationPrompt';
import {
  getGeolocationPermissionState,
  isGeolocationSupported,
  requestPreciseLocation,
} from '@/lib/geolocationPermission';
import LocationPromptModal from './LocationPromptModal';

const PROMPT_DELAY_MS = 3000;

/**
 * True while the web-push post-login prompt may still appear or is awaiting
 * a response. Location waits until this is false.
 */
function isWebPushPromptPending(userId, publicKey, pushState) {
  if (!userId) return false;
  // Hold until push eligibility is known when VAPID key is present
  if (publicKey && !pushState.checked) return true;
  if (!publicKey) return false;
  if (pushState.subscribed || !pushState.supported) return false;
  if (pushState.permission === 'denied' || isWebPushPromptDismissed(userId)) return false;
  return true;
}

export default function LocationPromptGate() {
  const { user, appPublicSettings } = useAuth();
  const publicKey = appPublicSettings?.web_push_public_key;
  const { pushState } = useWebPush(publicKey);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [permission, setPermission] = useState(null);
  const [permissionChecked, setPermissionChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function checkPermission() {
      if (!isGeolocationSupported()) {
        if (!cancelled) {
          setPermission('denied');
          setPermissionChecked(true);
        }
        return;
      }

      const state = await getGeolocationPermissionState();
      if (!cancelled) {
        setPermission(state);
        setPermissionChecked(true);
      }
    }

    checkPermission();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || !permissionChecked) {
      setOpen(false);
      return undefined;
    }

    if (!isGeolocationSupported()) {
      setOpen(false);
      return undefined;
    }

    if (permission === 'granted' || permission === 'denied') {
      setOpen(false);
      return undefined;
    }

    if (isLocationPromptDismissed(user.id)) {
      setOpen(false);
      return undefined;
    }

    if (isWebPushPromptPending(user.id, publicKey, pushState)) {
      setOpen(false);
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setOpen(true);
    }, PROMPT_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [
    user?.id,
    publicKey,
    permission,
    permissionChecked,
    pushState.checked,
    pushState.subscribed,
    pushState.supported,
    pushState.permission,
  ]);

  if (!user) return null;

  const handleEnable = async () => {
    setLoading(true);
    try {
      const result = await requestPreciseLocation();

      if (result.success) {
        setPermission('granted');
        toast.success('Precise location enabled');
        return true;
      }

      if (result.error === 'Location permission was denied') {
        setPermission('denied');
      }

      toast.error(result.error || 'Unable to enable location');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = () => {
    dismissLocationPrompt(user.id);
  };

  return (
    <LocationPromptModal
      open={open}
      onOpenChange={setOpen}
      onEnable={handleEnable}
      onDismiss={handleDismiss}
      loading={loading}
    />
  );
}
