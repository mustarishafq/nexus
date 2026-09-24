// @ts-nocheck
import {
  Building2,
  Clock,
  Image,
  MapPin,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import AttendancePeerSyncBanner from '@/components/settings/AttendancePeerSyncBanner';

/** Brain attendance tabs (Insan also has Holidays + Leaders). */
export const ATTENDANCE_SETTING_TABS = [
  {
    id: 'locations',
    label: 'Locations',
    icon: MapPin,
    title: 'Shared locations',
    description: 'Geofence sites departments can share. Assign the same location to multiple teams.',
  },
  {
    id: 'rules',
    label: 'Company rules',
    icon: Clock,
    title: 'Company clock rules',
    description: 'Grace, overtime, short hours, and clock exceptions for every department.',
  },
  {
    id: 'departments',
    label: 'Departments',
    icon: Building2,
    title: 'Department settings',
    description: 'Location, timezone, and shifts per department. Company clock rules live under Company rules.',
  },
  {
    id: 'watermark',
    label: 'Watermark',
    icon: Image,
    title: 'Attendance watermark',
    description: 'Clock in/out camera overlay fields, styling, and live preview.',
  },
];

export default function AttendanceSettingsShell({
  peerLocal = 'brain',
  syncMeta = null,
  tab,
  onTabChange,
  tabs = ATTENDANCE_SETTING_TABS,
  showPeerSync = true,
  children,
}) {
  const active = tabs.find((item) => item.id === tab) || tabs[0];

  return (
    <div className="space-y-5">
      <div className="sticky top-[calc(4rem+0.5rem)] z-10 -mx-1 space-y-3 bg-background/95 px-1 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:top-24">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div
            className="flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            role="tablist"
            aria-label="Attendance settings"
          >
            {tabs.map((item) => {
              const Icon = item.icon;
              const selected = item.id === active.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => onTabChange(item.id)}
                  className={cn(
                    'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-medium transition-colors min-h-[36px]',
                    selected
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-background text-muted-foreground hover:border-primary/30 hover:text-foreground',
                  )}
                >
                  {Icon ? <Icon className="h-3.5 w-3.5 shrink-0" /> : null}
                  {item.label}
                </button>
              );
            })}
          </div>
          {showPeerSync ? (
            <AttendancePeerSyncBanner
              peerLocal={peerLocal}
              syncMeta={syncMeta}
              className="shrink-0 sm:text-right"
            />
          ) : null}
        </div>
      </div>

      {(active?.title || active?.description) ? (
        <div className="min-w-0">
          {active.title ? (
            <h2 className="text-lg font-semibold tracking-tight">{active.title}</h2>
          ) : null}
          {active.description ? (
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{active.description}</p>
          ) : null}
        </div>
      ) : null}

      <div className="min-w-0 space-y-4">{children}</div>
    </div>
  );
}
