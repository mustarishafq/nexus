import React, { useCallback, useState } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { Outlet, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import TopBar from './TopBar';
import BottomNav from './BottomNav';
import BirthdayCelebrationGate from '@/components/celebrations/BirthdayCelebrationGate';
import BroadcastAnnouncementGate from '@/components/broadcasts/BroadcastAnnouncementGate';
import GlobalBroadcastStrip from '@/components/broadcasts/GlobalBroadcastStrip';
import { useNetworkHealthMonitor } from '@/hooks/useNetworkHealthMonitor';

export default function AppLayout() {
  useNetworkHealthMonitor();
  const isMobile = useIsMobile();
  const location = useLocation();
  const [broadcastStripVisible, setBroadcastStripVisible] = useState(false);
  const isFullBleed = /^\/applications\/\d+\/view$/.test(location.pathname);
  const showBottomNav = !isFullBleed;

  const handleBroadcastStripVisibility = useCallback((visible) => {
    setBroadcastStripVisible(visible);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <BirthdayCelebrationGate />
      <BroadcastAnnouncementGate />
      {!isFullBleed ? (
        <div className="fixed top-0 left-0 right-0 z-30 flex flex-col transition-all duration-200">
          <TopBar embedded sidebarWidth={0} isMobile={isMobile} />
          <GlobalBroadcastStrip
            embedded
            isMobile={isMobile}
            onVisibilityChange={handleBroadcastStripVisibility}
          />
        </div>
      ) : null}
      <main
        className={cn(
          'min-h-screen transition-all duration-200',
          isFullBleed ? 'overflow-hidden' : 'pt-16',
          !isFullBleed && broadcastStripVisible && 'pt-[calc(4rem+1.75rem)] sm:pt-21',
          showBottomNav && 'pb-[calc(4.75rem+env(safe-area-inset-bottom))]'
        )}
      >
        {isFullBleed ? (
          <Outlet />
        ) : (
          <div className="p-4 sm:p-6 max-w-[1600px] mx-auto">
            <Outlet />
          </div>
        )}
      </main>
      {showBottomNav && <BottomNav />}
    </div>
  );
}
