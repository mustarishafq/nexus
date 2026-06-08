import React, { useEffect, useState } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import BirthdayCelebrationGate from '@/components/celebrations/BirthdayCelebrationGate';

export default function AppLayout() {
  const isMobile = useIsMobile();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const isFullBleed = /^\/applications\/\d+\/view$/.test(location.pathname);

  useEffect(() => {
    if (!isMobile) {
      setMobileSidebarOpen(false);
    }
  }, [isMobile]);

  const sidebarWidth = isMobile ? 0 : (collapsed ? 72 : 260);

  return (
    <div className="min-h-screen bg-background">
      <BirthdayCelebrationGate />
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed(!collapsed)}
        isMobile={isMobile}
        mobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
      />
      {!isFullBleed ? (
        <TopBar
          sidebarWidth={sidebarWidth}
          isMobile={isMobile}
          onMenuToggle={() => setMobileSidebarOpen((open) => !open)}
        />
      ) : null}
      <main
        className={`min-h-screen transition-all duration-200${isFullBleed ? ' overflow-hidden' : ' pt-16'}`}
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
    </div>
  );
}