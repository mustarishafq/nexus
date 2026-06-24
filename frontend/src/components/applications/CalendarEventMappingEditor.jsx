import React, { useMemo, useState } from 'react';
import db, { API_ORIGIN } from '@/api/base44Client';
import {
  buildNestedSampleCalendarEvent,
  DEFAULT_CALENDAR_EVENT_MAPPING,
  fieldMappingsToForm,
  formToFieldMappings,
  NESTED_CALENDAR_FIELD_MAPPINGS,
  normalizeCalendarEventMapping,
  CALENDAR_FIELD_LABELS,
} from '@/lib/calendarEventMapping';
import { Calendar as CalendarIcon } from 'lucide-react';
import { toast } from 'sonner';
import CalendarEventPreview from '@/components/applications/CalendarEventPreview';
import WebhookIntegrationEditor from '@/components/applications/WebhookIntegrationEditor';

const mappingFields = Object.keys(DEFAULT_CALENDAR_EVENT_MAPPING.field_mappings);

export default function CalendarEventMappingEditor({
  value,
  onChange,
  applicationId,
}) {
  const config = useMemo(
    () => normalizeCalendarEventMapping(value),
    [value]
  );
  const [mappingForm, setMappingForm] = useState(() => fieldMappingsToForm(config.field_mappings));
  const [previewInput, setPreviewInput] = useState(JSON.stringify(buildNestedSampleCalendarEvent(), null, 2));
  const [previewOutput, setPreviewOutput] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);

  const webhookUrl = applicationId
    ? `${API_ORIGIN}/api/applications/${applicationId}/calendar-webhook`
    : '';

  const updateConfig = (patch) => {
    onChange(normalizeCalendarEventMapping({ ...config, ...patch }));
  };

  const updateFieldMapping = (nextForm) => {
    setMappingForm(nextForm);
    updateConfig({
      field_mappings: formToFieldMappings(nextForm),
    });
  };

  const applyNestedPreset = () => {
    const nextForm = fieldMappingsToForm(NESTED_CALENDAR_FIELD_MAPPINGS);
    setMappingForm(nextForm);
    updateConfig({ field_mappings: { ...NESTED_CALENDAR_FIELD_MAPPINGS } });
    setPreviewInput(JSON.stringify(buildNestedSampleCalendarEvent(), null, 2));
  };

  const runPreview = async () => {
    if (!applicationId) {
      toast.error('Save the application first to preview mapping.');
      return;
    }

    let event;
    try {
      event = JSON.parse(previewInput);
    } catch {
      toast.error('Sample event JSON is invalid.');
      return;
    }

    setPreviewLoading(true);
    try {
      const result = await db.previewApplicationCalendarMapping(applicationId, event, config);
      setPreviewOutput(JSON.stringify(result?.payload || {}, null, 2));
    } catch (error) {
      toast.error(error?.data?.message || error.message || 'Preview failed');
      setPreviewOutput('');
    } finally {
      setPreviewLoading(false);
    }
  };

  return (
    <WebhookIntegrationEditor
      icon={CalendarIcon}
      title="Calendar"
      subtitle="Map webhook events into Nexus calendar entries"
      accent="sky"
      enabled={config.auto_sync}
      onEnabledChange={(checked) => updateConfig({ auto_sync: checked })}
      enableLabel="Auto-sync calendar events"
      enableDescription="Create, update, reschedule, or cancel calendar events from webhooks."
      webhookSecret={config.webhook_secret || ''}
      onWebhookSecretChange={(secret) => updateConfig({ webhook_secret: secret })}
      webhookUrl={webhookUrl}
      webhookUrlLabel="Calendar webhook URL"
      mappingFields={mappingFields}
      fieldLabels={CALENDAR_FIELD_LABELS}
      defaultFieldMappings={DEFAULT_CALENDAR_EVENT_MAPPING.field_mappings}
      requiredFields={['title', 'start_at', 'end_at', 'external_event_id']}
      mappingForm={mappingForm}
      onMappingChange={updateFieldMapping}
      samplePayload={previewInput}
      onSamplePayloadChange={setPreviewInput}
      onApplyNestedPreset={applyNestedPreset}
      nestedPresetLabel="Use nested preset"
      targetTitle="Nexus calendar fields"
      targetDescription="Map external fields to calendar event properties and lifecycle actions."
      payloadDescription="Paste a webhook body with meeting details, then map fields for create, reschedule, or cancel actions."
      onRunPreview={runPreview}
      previewLoading={previewLoading}
      previewOutput={previewOutput}
      previewVisual={(payload) => <CalendarEventPreview payload={payload} />}
    />
  );
}
