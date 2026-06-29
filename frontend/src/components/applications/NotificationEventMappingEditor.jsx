import React, { useMemo, useState } from 'react';
import db, { API_ORIGIN } from '@/api/apiClient';
import {
  buildNestedSampleEvent,
  DEFAULT_NOTIFICATION_EVENT_MAPPING,
  fieldMappingsToForm,
  formToFieldMappings,
  NESTED_PAYLOAD_FIELD_MAPPINGS,
  normalizeNotificationEventMapping,
  NOTIFICATION_FIELD_LABELS,
} from '@/lib/notificationEventMapping';
import { Bell } from 'lucide-react';
import { toast } from 'sonner';
import NotificationPreview from '@/components/notifications/NotificationPreview';
import WebhookIntegrationEditor from '@/components/applications/WebhookIntegrationEditor';

const mappingFields = Object.keys(DEFAULT_NOTIFICATION_EVENT_MAPPING.field_mappings);

export default function NotificationEventMappingEditor({
  value,
  onChange,
  applicationId,
  resetKey = 0,
}) {
  const config = useMemo(
    () => normalizeNotificationEventMapping(value),
    [value]
  );
  const [mappingForm, setMappingForm] = useState(() => fieldMappingsToForm(config.field_mappings));
  const [previewInput, setPreviewInput] = useState(JSON.stringify(buildNestedSampleEvent(), null, 2));
  const [previewOutput, setPreviewOutput] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);

  const webhookUrl = applicationId
    ? `${API_ORIGIN}/api/applications/${applicationId}/event-webhook`
    : '';

  const updateConfig = (patch) => {
    onChange(normalizeNotificationEventMapping({ ...config, ...patch }));
  };

  const updateFieldMapping = (nextForm) => {
    setMappingForm(nextForm);
    updateConfig({
      field_mappings: formToFieldMappings(nextForm),
    });
  };

  const applyNestedPreset = () => {
    const nextForm = fieldMappingsToForm(NESTED_PAYLOAD_FIELD_MAPPINGS);
    setMappingForm(nextForm);
    updateConfig({ field_mappings: { ...NESTED_PAYLOAD_FIELD_MAPPINGS } });
    setPreviewInput(JSON.stringify(buildNestedSampleEvent(), null, 2));
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

    const previewConfig = normalizeNotificationEventMapping({
      ...config,
      field_mappings: formToFieldMappings(mappingForm),
    });

    setPreviewLoading(true);
    try {
      const result = await db.previewApplicationEventMapping(applicationId, event, previewConfig);
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
      icon={Bell}
      title="Notifications"
      subtitle="Map webhook events into in-app notification payloads"
      accent="amber"
      enabled={config.auto_notify}
      onEnabledChange={(checked) => updateConfig({ auto_notify: checked })}
      enableLabel="Auto-create notifications"
      enableDescription="Incoming webhook events are converted and delivered to users."
      webhookSecret={config.webhook_secret || ''}
      onWebhookSecretChange={(secret) => updateConfig({ webhook_secret: secret })}
      webhookUrl={webhookUrl}
      webhookUrlLabel="Notification webhook URL"
      mappingFields={mappingFields}
      fieldLabels={NOTIFICATION_FIELD_LABELS}
      defaultFieldMappings={DEFAULT_NOTIFICATION_EVENT_MAPPING.field_mappings}
      requiredFields={['title']}
      mappingForm={mappingForm}
      onMappingChange={updateFieldMapping}
      samplePayload={previewInput}
      onSamplePayloadChange={setPreviewInput}
      onApplyNestedPreset={applyNestedPreset}
      nestedPresetLabel="Use nested preset"
      targetTitle="Nexus notification fields"
      targetDescription="Drop source fields here. First matching path wins at runtime."
      payloadDescription="Paste a webhook body from the external system, then drag fields onto Nexus notification targets."
      onRunPreview={runPreview}
      previewLoading={previewLoading}
      previewOutput={previewOutput}
      previewVisual={(payload) => <NotificationPreview payload={payload} />}
    />
  );
}
