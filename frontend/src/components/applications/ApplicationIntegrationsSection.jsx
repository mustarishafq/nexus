import React from 'react';
import { Plug } from 'lucide-react';
import NotificationEventMappingEditor from '@/components/applications/NotificationEventMappingEditor';
import CalendarEventMappingEditor from '@/components/applications/CalendarEventMappingEditor';

export default function ApplicationIntegrationsSection({
  notificationConfig,
  onNotificationConfigChange,
  calendarConfig,
  onCalendarConfigChange,
  applicationId,
}) {
  return (
    <div className="space-y-4 rounded-2xl border border-border/70 bg-gradient-to-b from-muted/25 to-transparent p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Plug className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">External integrations</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Connect webhooks so other systems can push notifications and calendar events into Nexus.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <NotificationEventMappingEditor
          key={`notifications-${applicationId ?? 'new'}`}
          value={notificationConfig}
          onChange={onNotificationConfigChange}
          applicationId={applicationId}
        />
        <CalendarEventMappingEditor
          key={`calendar-${applicationId ?? 'new'}`}
          value={calendarConfig}
          onChange={onCalendarConfigChange}
          applicationId={applicationId}
        />
      </div>
    </div>
  );
}
