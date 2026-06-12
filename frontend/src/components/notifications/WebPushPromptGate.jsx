import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';
import { useWebPush } from '@/hooks/useWebPush';
import {
  dismissWebPushPrompt,
  isWebPushPromptDismissed,
} from '@/lib/webPushPrompt';
import WebPushPromptModal from './WebPushPromptModal';

const PROMPT_DELAY_MS = 3000;

export default function WebPushPromptGate() {
  const { user, appPublicSettings } = useAuth();
  const location = useLocation();
  const publicKey = appPublicSettings?.web_push_public_key;
  const { pushState, subscribe } = useWebPush(publicKey);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user?.id || !publicKey || location.pathname === '/settings') {
      setOpen(false);
      return undefined;
    }

    if (!pushState.checked || pushState.subscribed || !pushState.supported) {
      setOpen(false);
      return undefined;
    }

    if (pushState.permission === 'denied' || isWebPushPromptDismissed(user.id)) {
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
    location.pathname,
    pushState.checked,
    pushState.subscribed,
    pushState.supported,
    pushState.permission,
  ]);

  if (!user) return null;

  const handleEnable = async () => {
    const result = await subscribe();

    if (result.success) {
      toast.success('Web push enabled');
      return true;
    }

    toast.error(result.error || 'Unable to enable web push');
    return false;
  };

  const handleDismiss = () => {
    dismissWebPushPrompt(user.id);
  };

  return (
    <WebPushPromptModal
      open={open}
      onOpenChange={setOpen}
      onEnable={handleEnable}
      onDismiss={handleDismiss}
      loading={pushState.loading}
    />
  );
}
