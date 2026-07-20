import React, { useCallback, useEffect, useState } from 'react';
import GlobalBroadcastStrip from '@/components/broadcasts/GlobalBroadcastStrip';
import AttendanceReminderStrip from '@/components/attendance/AttendanceReminderStrip';
import ImpersonationStrip from '@/components/layout/ImpersonationStrip';

/**
 * Stacks compact top alerts below the header.
 * Preview (impersonation) first, then attendance reminders, then broadcasts.
 */
export default function TopAlertStrips({ embedded = false, isMobile = false, onLayoutChange }) {
  const [impersonationVisible, setImpersonationVisible] = useState(false);
  const [attendanceVisible, setAttendanceVisible] = useState(false);
  const [broadcastVisible, setBroadcastVisible] = useState(false);

  const stripCount = (impersonationVisible ? 1 : 0)
    + (attendanceVisible ? 1 : 0)
    + (broadcastVisible ? 1 : 0);

  useEffect(() => {
    onLayoutChange?.({
      stripCount,
      impersonationVisible,
      attendanceVisible,
      broadcastVisible,
    });
  }, [stripCount, impersonationVisible, attendanceVisible, broadcastVisible, onLayoutChange]);

  const handleImpersonationVisibility = useCallback((visible) => {
    setImpersonationVisible(visible);
  }, []);

  const handleAttendanceVisibility = useCallback((visible) => {
    setAttendanceVisible(visible);
  }, []);

  const handleBroadcastVisibility = useCallback((visible) => {
    setBroadcastVisible(visible);
  }, []);

  return (
    <div className="flex w-full flex-col">
      <ImpersonationStrip embedded={embedded} onVisibilityChange={handleImpersonationVisibility} />
      <AttendanceReminderStrip embedded={embedded} onVisibilityChange={handleAttendanceVisibility} />
      <GlobalBroadcastStrip
        embedded={embedded}
        isMobile={isMobile}
        onVisibilityChange={handleBroadcastVisibility}
      />
    </div>
  );
}
