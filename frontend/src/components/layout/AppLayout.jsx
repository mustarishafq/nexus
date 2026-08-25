import React, { useEffect } from 'react';
import { useIsCompactNav, useIsMobile } from '@/hooks/use-mobile';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { glassTopBarStyles } from './glassStyles';
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

export default function AppLayout() {
  useNetworkHealthMonitor();
  const { shouldRedirect, fromPath } = useAttendanceClockInRedirect();
  const isMobile = useIsMobile();
  const isCompactNav = useIsCompactNav();
  const location = useLocation();
  const { isFullscreen: emailFullscreen } = useEmailFullscreen();

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
  // Host / play / preview: keep TopBar, but stage fills main edge-to-edge (no page padding gap)
  const isGameImmersive = /^\/games\/(sessions\/[^/]+\/host|play\/[^/]+|[^/]+\/preview)$/.test(location.pathname);
  const isAnalyticsPage = location.pathname === '/analytics';
  const isMessagesPage = /^\/messages(\/|$)/.test(location.pathname);
  const isOrganizationPage = location.pathname === '/organization' || location.pathname.startsWith('/organization/');
  const isViewportFillPage = (isAnalyticsPage || isEmailPage || isMessagesPage || isOrganizationPage) && !isFullBleed;
  const showBottomNav = !isFullBleed;

  const lockToViewport = isFullBleed || isViewportFillPage;

  return (
    <UserPresenceGate>
      <div
        className={cn(
          'flex min-w-0 max-w-full flex-col bg-background',
          'h-[100dvh] max-h-[100dvh] overflow-x-clip overflow-y-hidden',
        )}
      >
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
        <main
          className={cn(
            'flex min-h-0 min-w-0 max-w-full flex-1 flex-col',
            lockToViewport || isGameImmersive
              ? 'overflow-hidden'
              : 'overflow-x-clip overflow-y-auto overscroll-y-contain',
          )}
        >
          {!isFullBleed ? (
            <div
              className={cn(
                glassTopBarStyles,
                'sticky top-0 z-30 flex shrink-0 flex-col border-b pt-[var(--nexus-safe-top)]',
              )}
            >
              <TopBar embedded sidebarWidth={0} isMobile={isCompactNav} />
              <TopAlertStrips embedded isMobile={isMobile} />
            </div>
          ) : null}
          <div
            className={cn(
              'min-w-0',
              (lockToViewport || isGameImmersive) && 'flex min-h-0 flex-1 flex-col overflow-hidden',
              showBottomNav && !isGameImmersive && 'pb-[var(--nexus-dock-clearance)]',
            )}
          >
            {isEmailFullscreen ? (
              <div className="flex h-full min-h-0 flex-col overflow-hidden p-2 sm:p-3">
                <Outlet />
              </div>
            ) : isFullBleed ? (
              <Outlet />
            ) : isGameImmersive ? (
              <div className="flex h-full min-h-0 w-full flex-1 flex-col">
                <Outlet />
              </div>
            ) : isViewportFillPage ? (
              <div className="mx-auto flex h-full min-h-0 w-full min-w-0 max-w-[1600px] flex-col overflow-hidden px-4 pt-4 sm:px-6 sm:pt-6">
                <Outlet />
              </div>
            ) : (
              <div className="mx-auto min-w-0 max-w-[1600px] p-4 sm:p-6">
                <Outlet />
              </div>
            )}
          </div>
        </main>
        {showBottomNav && <BottomNav />}
        <TeamRosterPanel hidden={isFullBleed || isViewportFillPage || isGameImmersive || isMobile} />
      </div>
    </UserPresenceGate>
  );
}
