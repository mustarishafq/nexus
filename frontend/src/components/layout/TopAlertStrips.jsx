import React, { useCallback, useEffect, useState } from 'react';
import GlobalBroadcastStrip from '@/components/broadcasts/GlobalBroadcastStrip';
import AttendanceReminderStrip from '@/components/attendance/AttendanceReminderStrip';

/**
 * Stacks compact top alerts below the header.
 * Attendance reminders render first (action required), then broadcasts.
 */
export default function TopAlertStrips({ embedded = false, isMobile = false, onLayoutChange }) {
  const [attendanceVisible, setAttendanceVisible] = useState(false);
  const [broadcastVisible, setBroadcastVisible] = useState(false);

  const stripCount = (attendanceVisible ? 1 : 0) + (broadcastVisible ? 1 : 0);

  useEffect(() => {
    onLayoutChange?.({
      stripCount,
      attendanceVisible,
      broadcastVisible,
    });
  }, [stripCount, attendanceVisible, broadcastVisible, onLayoutChange]);

  const handleAttendanceVisibility = useCallback((visible) => {
    setAttendanceVisible(visible);
  }, []);

  const handleBroadcastVisibility = useCallback((visible) => {
    setBroadcastVisible(visible);
  }, []);

  return (
    <div className="flex w-full flex-col">
      <AttendanceReminderStrip embedded={embedded} onVisibilityChange={handleAttendanceVisibility} />
      <GlobalBroadcastStrip
        embedded={embedded}
        isMobile={isMobile}
        onVisibilityChange={handleBroadcastVisibility}
      />
    </div>
  );
}
