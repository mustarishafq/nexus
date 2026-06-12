import React, { useCallback, useState } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { Outlet, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import Sidebar from './Sidebar';
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
  const [collapsed, setCollapsed] = useState(true);
  const [broadcastStripVisible, setBroadcastStripVisible] = useState(false);
  const isFullBleed = /^\/applications\/\d+\/view$/.test(location.pathname);
  const showBottomNav = isMobile && !isFullBleed;

  const sidebarWidth = isMobile ? 0 : (collapsed ? 72 : 260);
  const handleBroadcastStripVisibility = useCallback((visible) => {
    setBroadcastStripVisible(visible);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <BirthdayCelebrationGate />
      <BroadcastAnnouncementGate />
      {!isMobile && (
        <Sidebar
          collapsed={collapsed}
          onToggle={() => setCollapsed(!collapsed)}
        />
      )}
      {!isFullBleed ? (
        <div
          className="fixed top-0 right-0 z-30 flex flex-col transition-all duration-200"
          style={{ left: sidebarWidth }}
        >
          <TopBar embedded sidebarWidth={sidebarWidth} isMobile={isMobile} />
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
          !isFullBleed && broadcastStripVisible && 'pt-[7rem]',
          showBottomNav && 'pb-[calc(4rem+env(safe-area-inset-bottom))]'
        )}
        style={{ marginLeft: sidebarWidth }}
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