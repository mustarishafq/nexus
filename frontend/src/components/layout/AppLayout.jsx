import React, { useCallback, useState } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import TopBar from './TopBar';
import BottomNav from './BottomNav';
import BirthdayCelebrationGate from '@/components/celebrations/BirthdayCelebrationGate';
import BroadcastAnnouncementGate from '@/components/broadcasts/BroadcastAnnouncementGate';
import WebPushPromptGate from '@/components/notifications/WebPushPromptGate';
import NotificationToastGate from '@/components/notifications/NotificationToastGate';
import NotificationClickGate from '@/components/notifications/NotificationClickGate';
import NotificationAudioUnlock from '@/components/notifications/NotificationAudioUnlock';
import MailNotificationGate from '@/components/email/MailNotificationGate';
import UserPresenceGate from '@/components/presence/UserPresenceGate';
import TopAlertStrips from '@/components/layout/TopAlertStrips';
import {
  ATTENDANCE_PATH,
  useAttendanceClockInRedirect,
} from '@/hooks/useAttendanceReminder';
import { useNetworkHealthMonitor } from '@/hooks/useNetworkHealthMonitor';

export default function AppLayout() {
  useNetworkHealthMonitor();
  const { shouldRedirect, fromPath } = useAttendanceClockInRedirect();
  const isMobile = useIsMobile();
  const location = useLocation();
  const [topStripCount, setTopStripCount] = useState(0);

  const handleTopStripLayout = useCallback(({ stripCount }) => {
    setTopStripCount(stripCount);
  }, []);

  if (shouldRedirect) {
    return (
      <Navigate
        to={ATTENDANCE_PATH}
        replace
        state={{ attendanceRedirect: true, from: fromPath }}
      />
    );
  }

  const isFullBleed = /^\/applications\/\d+\/view$/.test(location.pathname);
  const isAnalyticsPage = location.pathname === '/analytics';
  const isEmailPage = /^\/email(\/|$)/.test(location.pathname);
  const isMessagesPage = /^\/messages(\/|$)/.test(location.pathname);
  const isViewportFillPage = isAnalyticsPage || isEmailPage || isMessagesPage;
  const showBottomNav = !isFullBleed;

  return (
    <UserPresenceGate>
      <div className="min-h-screen bg-background">
        <BirthdayCelebrationGate />
        <BroadcastAnnouncementGate />
        <WebPushPromptGate />
        <NotificationToastGate />
        <NotificationClickGate />
        <MailNotificationGate />
        <NotificationAudioUnlock />
        {!isFullBleed ? (
          <div className="fixed top-0 left-0 right-0 z-30 flex flex-col transition-all duration-200">
            <TopBar embedded sidebarWidth={0} isMobile={isMobile} />
            <TopAlertStrips
              embedded
              isMobile={isMobile}
              onLayoutChange={handleTopStripLayout}
            />
          </div>
        ) : null}
        <main
          className={cn(
            'transition-all duration-200',
            isFullBleed ? 'min-h-screen overflow-hidden' : 'pt-16',
            isViewportFillPage && 'h-[100dvh] max-h-[100dvh] overflow-hidden',
            !isFullBleed && !isViewportFillPage && 'min-h-screen',
            !isFullBleed && topStripCount === 1 && 'pt-[calc(4rem+1.75rem)] sm:pt-[calc(4rem+2rem)]',
            !isFullBleed && topStripCount >= 2 && 'pt-[calc(4rem+3.5rem)] sm:pt-[calc(4rem+4rem)]',
            showBottomNav && 'pb-[calc(5.25rem+env(safe-area-inset-bottom))]'
          )}
        >
          {isFullBleed ? (
            <Outlet />
          ) : isViewportFillPage ? (
            <div className="flex h-full min-h-0 flex-col overflow-hidden px-4 sm:px-6 pt-4 sm:pt-6 max-w-[1600px] mx-auto w-full">
              <Outlet />
            </div>
          ) : (
            <div className="p-4 sm:p-6 max-w-[1600px] mx-auto">
              <Outlet />
            </div>
          )}
        </main>
        {showBottomNav && <BottomNav />}
      </div>
    </UserPresenceGate>
  );
}
