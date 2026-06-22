import { useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import db from '@/api/base44Client';
import { followNotificationAction } from '@/lib/notificationAction';

export default function NotificationClickGate() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const { data: applications = [] } = useQuery({
    queryKey: ['applications'],
    queryFn: () => db.entities.Application.list(),
  });

  const openNotification = useCallback(async (payload = {}) => {
    let notification = null;

    if (payload.id) {
      try {
        notification = await db.entities.Notification.get(payload.id);
      } catch {
        notification = null;
      }
    }

    if (!notification) {
      notification = {
        id: payload.id || null,
        action_url: payload.action_url || payload.url || null,
        system_id: payload.system_id || null,
      };
    }

    if (!notification.action_url && !notification.system_id) {
      navigate('/notifications');
      return;
    }

    try {
      await followNotificationAction(notification, { applications, navigate });
    } catch (error) {
      toast.error(error?.message || 'Unable to open notification link.');
      navigate('/notifications');
    }
  }, [applications, navigate]);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      return undefined;
    }

    const handleMessage = (event) => {
      if (event.data?.type !== 'NOTIFICATION_OPEN') {
        return;
      }

      void openNotification(event.data.payload || {});
    };

    navigator.serviceWorker.addEventListener('message', handleMessage);
    return () => navigator.serviceWorker.removeEventListener('message', handleMessage);
  }, [openNotification]);

  useEffect(() => {
    const openId = searchParams.get('open');
    if (!openId) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('open');
    setSearchParams(nextParams, { replace: true });
    void openNotification({ id: openId });
  }, [openNotification, searchParams, setSearchParams]);

  return null;
}
