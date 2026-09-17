// @ts-nocheck
import AttendancePeerSyncBanner from '@/components/settings/AttendancePeerSyncBanner';
import SettingsSectionNav from '@/components/settings/SettingsSectionNav';

export const ATTENDANCE_SETTING_TABS = [
  { id: 'locations', label: 'Locations' },
  { id: 'rules', label: 'Rules' },
  { id: 'watermark', label: 'Watermark' },
];

export default function AttendanceSettingsShell({
  peerLocal = 'insan',
  syncMeta = null,
  tab,
  onTabChange,
  tabs = ATTENDANCE_SETTING_TABS,
  children,
}) {
  const active = tabs.find((item) => item.id === tab) || tabs[0];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SettingsSectionNav
          type="underline"
          items={tabs}
          value={active.id}
          onChange={onTabChange}
          ariaLabel="Attendance settings tabs"
        />
        <AttendancePeerSyncBanner peerLocal={peerLocal} syncMeta={syncMeta} />
      </div>

      <div className="min-w-0 rounded-2xl border bg-card p-4 sm:p-5">
        {children}
      </div>
    </div>
  );
}
