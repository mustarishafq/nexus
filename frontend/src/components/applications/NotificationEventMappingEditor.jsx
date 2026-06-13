import React, { useMemo, useState } from 'react';
import db, { API_ORIGIN } from '@/api/base44Client';
import {
  buildNestedSampleEvent,
  fieldMappingsToForm,
  formToFieldMappings,
  NESTED_PAYLOAD_FIELD_MAPPINGS,
  normalizeNotificationEventMapping,
} from '@/lib/notificationEventMapping';
import { Bell, ChevronDown, ChevronUp, Copy, Check, Sparkles } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import NotificationPreview from '@/components/notifications/NotificationPreview';
import NotificationFieldMappingBuilder from '@/components/applications/mapping/NotificationFieldMappingBuilder';

export default function NotificationEventMappingEditor({
  value,
  onChange,
  applicationId,
}) {
  const [open, setOpen] = useState(false);
  const config = useMemo(
    () => normalizeNotificationEventMapping(value),
    [value]
  );
  const [mappingForm, setMappingForm] = useState(() => fieldMappingsToForm(config.field_mappings));
  const [previewInput, setPreviewInput] = useState(JSON.stringify(buildNestedSampleEvent(), null, 2));
  const [previewOutput, setPreviewOutput] = useState('');
  const previewPayload = useMemo(() => {
    if (!previewOutput) return null;
    try {
      return JSON.parse(previewOutput);
    } catch {
      return null;
    }
  }, [previewOutput]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);

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

  const copyWebhookUrl = () => {
    if (!webhookUrl) return;
    navigator.clipboard.writeText(webhookUrl);
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 2000);
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
      const result = await db.previewApplicationEventMapping(applicationId, event, config);
      setPreviewOutput(JSON.stringify(result?.payload || {}, null, 2));
    } catch (error) {
      toast.error(error?.data?.message || error.message || 'Preview failed');
      setPreviewOutput('');
    } finally {
      setPreviewLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-border/80 bg-muted/20 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors"
      >
        <div className="flex items-center gap-2 text-left">
          <Bell className="w-4 h-4 text-primary shrink-0" />
          <div>
            <p className="text-sm font-medium">Notification Event Mapping</p>
            <p className="text-[11px] text-muted-foreground">
              Map this system&apos;s webhook events into Nexus notification payloads
            </p>
          </div>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {open ? (
        <div className="px-4 pb-4 space-y-4 border-t border-border/70">
          <div className="flex items-center justify-between gap-3 pt-4">
            <div className="space-y-1">
              <Label htmlFor="auto-notify">Auto-create notifications</Label>
              <p className="text-[11px] text-muted-foreground">
                When enabled, incoming events are converted using this mapping.
              </p>
            </div>
            <Switch
              id="auto-notify"
              checked={config.auto_notify}
              onCheckedChange={(checked) => updateConfig({ auto_notify: checked })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="webhook-secret">Webhook secret</Label>
            <Input
              id="webhook-secret"
              value={config.webhook_secret || ''}
              onChange={(event) => updateConfig({ webhook_secret: event.target.value })}
              placeholder="Shared secret for X-Webhook-Secret header"
              autoComplete="off"
            />
            <p className="text-[11px] text-muted-foreground">
              External systems send this value in the <code className="bg-muted px-1 rounded">X-Webhook-Secret</code> header.
            </p>
          </div>

          {webhookUrl ? (
            <div className="space-y-2">
              <Label>Webhook URL</Label>
              <div className="flex gap-2">
                <Input value={webhookUrl} readOnly className="font-mono text-xs" />
                <Button type="button" variant="outline" size="icon" onClick={copyWebhookUrl} title="Copy webhook URL">
                  {copiedWebhook ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          ) : null}

          <NotificationFieldMappingBuilder
            mappingForm={mappingForm}
            onMappingChange={updateFieldMapping}
            samplePayload={previewInput}
            onSamplePayloadChange={setPreviewInput}
            onApplyNestedPreset={applyNestedPreset}
          />

          <div className="space-y-2 rounded-lg border border-border/70 bg-background/80 p-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <Label>Preview mapping</Label>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Test the mapping against the sample payload above.
            </p>
            <Button type="button" variant="outline" size="sm" onClick={runPreview} disabled={previewLoading}>
              {previewLoading ? 'Previewing...' : 'Preview payload'}
            </Button>
            {previewPayload ? (
              <>
                <NotificationPreview payload={previewPayload} />
                <pre className="rounded-md bg-muted/60 border border-border p-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap">
                  {previewOutput}
                </pre>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
