import React, { useEffect, useMemo, useState } from 'react';
import db, { API_ORIGIN } from '@/api/base44Client';
import {
  buildSampleEvent,
  DEFAULT_NOTIFICATION_EVENT_MAPPING,
  fieldMappingsToForm,
  formToFieldMappings,
  normalizeNotificationEventMapping,
  NOTIFICATION_FIELD_LABELS,
} from '@/lib/notificationEventMapping';
import { Bell, ChevronDown, ChevronUp, Copy, Check, Sparkles } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

export default function NotificationEventMappingEditor({
  value,
  onChange,
  applicationId,
}) {
  const [open, setOpen] = useState(false);
  const [mappingForm, setMappingForm] = useState(() =>
    fieldMappingsToForm(normalizeNotificationEventMapping(value).field_mappings)
  );
  const [previewInput, setPreviewInput] = useState(JSON.stringify(buildSampleEvent(), null, 2));
  const [previewOutput, setPreviewOutput] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  const config = useMemo(
    () => normalizeNotificationEventMapping(value),
    [value]
  );

  useEffect(() => {
    setMappingForm(fieldMappingsToForm(config.field_mappings));
  }, [config.field_mappings]);

  const webhookUrl = applicationId
    ? `${API_ORIGIN}/api/applications/${applicationId}/event-webhook`
    : '';

  const updateConfig = (patch) => {
    onChange(normalizeNotificationEventMapping({ ...config, ...patch }));
  };

  const updateFieldMapping = (field, rawValue) => {
    const nextForm = { ...mappingForm, [field]: rawValue };
    setMappingForm(nextForm);
    updateConfig({
      field_mappings: formToFieldMappings(nextForm),
    });
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
      const result = await db.previewApplicationEventMapping(applicationId, event);
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

          <div className="space-y-3">
            <div>
              <Label>Field mappings</Label>
              <p className="text-[11px] text-muted-foreground mt-1">
                Comma-separated source field names from your system&apos;s event JSON. First match wins.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3">
              {Object.keys(DEFAULT_NOTIFICATION_EVENT_MAPPING.field_mappings).map((field) => (
                <div key={field} className="space-y-1.5">
                  <Label className="text-xs">{NOTIFICATION_FIELD_LABELS[field] || field}</Label>
                  <Input
                    value={mappingForm[field] || ''}
                    onChange={(event) => updateFieldMapping(field, event.target.value)}
                    placeholder={DEFAULT_NOTIFICATION_EVENT_MAPPING.field_mappings[field].join(', ')}
                    className="font-mono text-xs"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2 rounded-lg border border-border/70 bg-background/80 p-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <Label>Preview mapping</Label>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Paste a sample event from your system and preview the Nexus notification payload.
            </p>
            <Textarea
              value={previewInput}
              onChange={(event) => setPreviewInput(event.target.value)}
              rows={8}
              className="font-mono text-xs"
            />
            <Button type="button" variant="outline" size="sm" onClick={runPreview} disabled={previewLoading}>
              {previewLoading ? 'Previewing...' : 'Preview payload'}
            </Button>
            {previewOutput ? (
              <pre className="rounded-md bg-muted/60 border border-border p-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap">
                {previewOutput}
              </pre>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
