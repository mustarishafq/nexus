import React, { useCallback, useEffect, useState } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import TopBar from './TopBar';
import BottomNav from './BottomNav';
import BirthdayCelebrationGate from '@/components/celebrations/BirthdayCelebrationGate';
import BroadcastAnnouncementGate from '@/components/broadcasts/BroadcastAnnouncementGate';
import { CelebrationGateProvider } from '@/lib/CelebrationGateContext';
import WebPushPromptGate from '@/components/notifications/WebPushPromptGate';
import LocationPromptGate from '@/components/location/LocationPromptGate';
import NotificationToastGate from '@/components/notifications/NotificationToastGate';
import NotificationClickGate from '@/components/notifications/NotificationClickGate';
import NotificationAudioUnlock from '@/components/notifications/NotificationAudioUnlock';
import MailNotificationGate from '@/components/email/MailNotificationGate';
import UserPresenceGate from '@/components/presence/UserPresenceGate';
import TeamRosterPanel from '@/components/presence/TeamRosterPanel';
import TopAlertStrips from '@/components/layout/TopAlertStrips';
import {
  ATTENDANCE_PATH,
  useAttendanceClockInRedirect,
} from '@/hooks/useAttendanceReminder';
import { useNetworkHealthMonitor } from '@/hooks/useNetworkHealthMonitor';
import { useEmailFullscreen, setEmailFullscreen } from '@/hooks/useEmailFullscreen';
import { isRunningStandalone } from '@/lib/pwa';

export default function AppLayout() {
  useNetworkHealthMonitor();
  const { shouldRedirect, fromPath } = useAttendanceClockInRedirect();
  const isMobile = useIsMobile();
  const location = useLocation();
  const standalone = isRunningStandalone();
  const [topStripCount, setTopStripCount] = useState(0);
  const { isFullscreen: emailFullscreen } = useEmailFullscreen();

  const handleTopStripLayout = useCallback(({ stripCount }) => {
    setTopStripCount(stripCount);
  }, []);

  const isEmailPage = /^\/email(\/|$)/.test(location.pathname);
  const isEmailFullscreen = isEmailPage && emailFullscreen;

  useEffect(() => {
    if (!isEmailPage && emailFullscreen) {
      setEmailFullscreen(false);
    }
  }, [isEmailPage, emailFullscreen]);

  if (shouldRedirect) {
    return (
      <Navigate
        to={ATTENDANCE_PATH}
        replace
        state={{ attendanceRedirect: true, from: fromPath }}
      />
    );
  }

  const isAppViewer = /^\/applications\/\d+\/view$/.test(location.pathname);
  const isFullBleed = isAppViewer || isEmailFullscreen;
  const isAnalyticsPage = location.pathname === '/analytics';
  const isMessagesPage = /^\/messages(\/|$)/.test(location.pathname);
  const isViewportFillPage = (isAnalyticsPage || isEmailPage || isMessagesPage) && !isFullBleed;
  const showBottomNav = !isFullBleed;

  return (
    <UserPresenceGate>
      <div className="min-h-screen min-w-0 max-w-full overflow-x-hidden bg-background">
        <CelebrationGateProvider>
          <BirthdayCelebrationGate />
          <BroadcastAnnouncementGate />
        </CelebrationGateProvider>
        <WebPushPromptGate />
        <LocationPromptGate />
        <NotificationToastGate />
        <NotificationClickGate />
        <MailNotificationGate />
        <NotificationAudioUnlock />
        {!isFullBleed ? (
          <div className="fixed top-0 left-0 right-0 z-30 flex flex-col pt-[var(--nexus-safe-top)] transition-all duration-200">
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
            'min-w-0 max-w-full transition-[padding] duration-200',
            isFullBleed ? 'h-[100dvh] max-h-[100dvh] overflow-hidden' : 'pt-[var(--nexus-header-offset)]',
            isViewportFillPage && 'h-[100dvh] max-h-[100dvh] overflow-hidden',
            !isFullBleed && !isViewportFillPage && 'min-h-screen',
            !isFullBleed && topStripCount === 1 && 'pt-[calc(var(--nexus-header-offset)+1.75rem)] sm:pt-[calc(var(--nexus-header-offset)+2rem)]',
            !isFullBleed && topStripCount === 2 && 'pt-[calc(var(--nexus-header-offset)+3.5rem)] sm:pt-[calc(var(--nexus-header-offset)+4rem)]',
            !isFullBleed && topStripCount >= 3 && 'pt-[calc(var(--nexus-header-offset)+5.25rem)] sm:pt-[calc(var(--nexus-header-offset)+6rem)]',
            showBottomNav
              && (standalone
                ? 'pb-[calc(5.25rem+env(safe-area-inset-bottom))]'
                : 'pb-[5.25rem]')
          )}
        >
          {isEmailFullscreen ? (
            <div className="flex h-full min-h-0 flex-col overflow-hidden p-2 sm:p-3">
              <Outlet />
            </div>
          ) : isFullBleed ? (
            <Outlet />
          ) : isViewportFillPage ? (
            <div className="mx-auto flex h-full min-h-0 w-full min-w-0 max-w-[1600px] flex-col overflow-hidden px-4 pt-4 sm:px-6 sm:pt-6">
              <Outlet />
            </div>
          ) : (
            <div className="mx-auto min-w-0 max-w-[1600px] p-4 sm:p-6">
              <Outlet />
            </div>
          )}
        </main>
        {showBottomNav && <BottomNav />}
        <TeamRosterPanel hidden={isFullBleed || isViewportFillPage || isMobile} />
      </div>
    </UserPresenceGate>
  );
}
