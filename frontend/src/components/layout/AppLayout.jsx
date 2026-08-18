import React, { useEffect } from 'react';
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
  const isViewportFillPage = (isAnalyticsPage || isEmailPage || isMessagesPage) && !isFullBleed;
  const showBottomNav = !isFullBleed;

  const lockToViewport = isFullBleed || isViewportFillPage;

  return (
    <UserPresenceGate>
      <div
        className={cn(
          'flex min-w-0 max-w-full flex-col overflow-x-hidden bg-background',
          // Viewport-fill pages (email, messages, analytics) must not grow with
          // list content — otherwise panes expand and action bars scroll away.
          lockToViewport
            ? 'h-[100dvh] max-h-[100dvh] overflow-hidden'
            : 'min-h-screen',
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
        {!isFullBleed ? (
          <div className="relative z-30 flex shrink-0 flex-col pt-[var(--nexus-safe-top)]">
            <TopBar embedded sidebarWidth={0} isMobile={isMobile} />
            <TopAlertStrips embedded isMobile={isMobile} />
          </div>
        ) : null}
        <main
          className={cn(
            'min-w-0 max-w-full flex-1',
            lockToViewport && 'min-h-0 overflow-hidden',
            showBottomNav
              && !isGameImmersive
              && (standalone
                ? 'pb-[var(--nexus-dock-clearance)]'
                : 'pb-[4.5rem]')
          )}
        >
          {isEmailFullscreen ? (
            <div className="flex h-full min-h-0 flex-col overflow-hidden p-2 sm:p-3">
              <Outlet />
            </div>
          ) : isFullBleed ? (
            <Outlet />
          ) : isGameImmersive ? (
            <div className="flex-1 flex flex-col min-h-0 w-full">
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
        </main>
        {showBottomNav && <BottomNav />}
        <TeamRosterPanel hidden={isFullBleed || isViewportFillPage || isGameImmersive || isMobile} />
      </div>
    </UserPresenceGate>
  );
}
