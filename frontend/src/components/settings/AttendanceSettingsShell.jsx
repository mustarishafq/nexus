// @ts-nocheck
import { cn } from '@/lib/utils';
import AttendancePeerSyncBanner from '@/components/settings/AttendancePeerSyncBanner';

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
        <div className="flex gap-1 rounded-lg border bg-muted/40 p-1">
          {tabs.map((item) => {
            const selected = item.id === active.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onTabChange(item.id)}
                className={cn(
                  'min-h-[36px] flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors sm:flex-none',
                  selected
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {item.label}
              </button>
            );
          })}
        </div>
        <AttendancePeerSyncBanner peerLocal={peerLocal} syncMeta={syncMeta} />
      </div>

      <div className="min-w-0 rounded-2xl border bg-card p-4 sm:p-5">
        {children}
      </div>
    </div>
  );
}
