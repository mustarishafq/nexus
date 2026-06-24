import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Sparkles,
  Link2,
  Shield,
  Workflow,
} from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import IntegrationFieldMappingBuilder from '@/components/applications/mapping/IntegrationFieldMappingBuilder';

const ACCENT_STYLES = {
  amber: {
    iconWrap: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
    border: 'border-amber-500/20',
    headerGlow: 'from-amber-500/8 via-transparent to-transparent',
    activeBadge: 'border-amber-500/35 bg-amber-500/10 text-amber-700 dark:text-amber-300',
    tabActive: 'data-[state=active]:text-amber-700 dark:data-[state=active]:text-amber-300',
  },
  sky: {
    iconWrap: 'bg-sky-500/15 text-sky-600 dark:text-sky-400',
    border: 'border-sky-500/20',
    headerGlow: 'from-sky-500/8 via-transparent to-transparent',
    activeBadge: 'border-sky-500/35 bg-sky-500/10 text-sky-700 dark:text-sky-300',
    tabActive: 'data-[state=active]:text-sky-700 dark:data-[state=active]:text-sky-300',
  },
};

export default function WebhookIntegrationEditor({
  icon: Icon,
  title,
  subtitle,
  accent = 'amber',
  enabled,
  onEnabledChange,
  enableLabel,
  enableDescription,
  webhookSecret,
  onWebhookSecretChange,
  webhookUrl,
  webhookUrlLabel = 'Webhook URL',
  mappingFields,
  fieldLabels,
  defaultFieldMappings,
  requiredFields = [],
  mappingForm,
  onMappingChange,
  samplePayload,
  onSamplePayloadChange,
  onApplyNestedPreset,
  nestedPresetLabel,
  targetTitle,
  targetDescription,
  payloadDescription,
  onRunPreview,
  previewLoading,
  previewOutput,
  previewVisual,
  saveFirstMessage = 'Save the application first to preview mapping.',
}) {
  const [open, setOpen] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [activeTab, setActiveTab] = useState('connection');

  const styles = ACCENT_STYLES[accent] || ACCENT_STYLES.amber;

  const copyWebhookUrl = () => {
    if (!webhookUrl) return;
    navigator.clipboard.writeText(webhookUrl);
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 2000);
  };

  const previewPayload = (() => {
    if (!previewOutput) return null;
    try {
      return JSON.parse(previewOutput);
    } catch {
      return null;
    }
  })();

  return (
    <div className={cn('rounded-2xl border bg-card/50 overflow-hidden shadow-sm', styles.border)}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="relative w-full flex items-center justify-between gap-3 px-4 py-3.5 hover:bg-muted/30 transition-colors text-left"
      >
        <div className={cn('absolute inset-x-0 top-0 h-12 bg-gradient-to-b pointer-events-none', styles.headerGlow)} />
        <div className="relative flex items-center gap-3 min-w-0">
          <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', styles.iconWrap)}>
            <Icon className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold">{title}</p>
              <Badge
                variant="outline"
                className={cn(
                  'text-[10px] h-5',
                  enabled ? styles.activeBadge : 'text-muted-foreground'
                )}
              >
                {enabled ? 'Active' : 'Off'}
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground truncate">{subtitle}</p>
          </div>
        </div>
        {open ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
        )}
      </button>

      {open ? (
        <div className="border-t border-border/60 px-4 pb-4 pt-3 space-y-4">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="w-full grid grid-cols-3 h-9 bg-muted/50">
              <TabsTrigger value="connection" className={cn('text-xs gap-1.5', styles.tabActive)}>
                <Link2 className="w-3.5 h-3.5" />
                Connection
              </TabsTrigger>
              <TabsTrigger value="mapping" className={cn('text-xs gap-1.5', styles.tabActive)}>
                <Workflow className="w-3.5 h-3.5" />
                Mapping
              </TabsTrigger>
              <TabsTrigger value="preview" className={cn('text-xs gap-1.5', styles.tabActive)}>
                <Sparkles className="w-3.5 h-3.5" />
                Preview
              </TabsTrigger>
            </TabsList>

            <TabsContent value="connection" className="mt-4 space-y-4">
              <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-1 min-w-0">
                    <Label htmlFor={`${title}-enabled`} className="text-sm">{enableLabel}</Label>
                    <p className="text-[11px] text-muted-foreground">{enableDescription}</p>
                  </div>
                  <Switch
                    id={`${title}-enabled`}
                    checked={enabled}
                    onCheckedChange={onEnabledChange}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Shield className="w-3.5 h-3.5 text-muted-foreground" />
                    <Label htmlFor={`${title}-secret`}>Webhook secret</Label>
                  </div>
                  <Input
                    id={`${title}-secret`}
                    value={webhookSecret || ''}
                    onChange={(event) => onWebhookSecretChange(event.target.value)}
                    placeholder="Shared secret for X-Webhook-Secret header"
                    autoComplete="off"
                    className="bg-background/80"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Send this value in the <code className="rounded bg-muted px-1 py-0.5 text-[10px]">X-Webhook-Secret</code> header on every request.
                  </p>
                </div>

                {webhookUrl ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Link2 className="w-3.5 h-3.5 text-muted-foreground" />
                      <Label>{webhookUrlLabel}</Label>
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1 rounded-lg border border-border/70 bg-muted/30 px-3 py-2 font-mono text-[11px] break-all leading-relaxed">
                        {webhookUrl}
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={copyWebhookUrl}
                        title="Copy webhook URL"
                        className="shrink-0"
                      >
                        {copiedWebhook ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-border/80 bg-muted/10 px-3 py-2.5 text-[11px] text-muted-foreground">
                    Save this application to reveal the webhook endpoint URL.
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="mapping" className="mt-4">
              {!enabled ? (
                <div className="mb-4 rounded-lg border border-dashed border-border/80 bg-muted/15 px-3 py-2 text-[11px] text-muted-foreground">
                  Integration is off — you can configure mapping now and enable when ready.
                </div>
              ) : null}
              <IntegrationFieldMappingBuilder
                mappingFields={mappingFields}
                fieldLabels={fieldLabels}
                defaultFieldMappings={defaultFieldMappings}
                requiredFields={requiredFields}
                mappingForm={mappingForm}
                onMappingChange={onMappingChange}
                samplePayload={samplePayload}
                onSamplePayloadChange={onSamplePayloadChange}
                onApplyNestedPreset={onApplyNestedPreset}
                nestedPresetLabel={nestedPresetLabel}
                targetTitle={targetTitle}
                targetDescription={targetDescription}
                payloadDescription={payloadDescription}
              />
            </TabsContent>

            <TabsContent value="preview" className="mt-4 space-y-4">
              <div className="rounded-xl border border-border/70 bg-muted/15 p-4 space-y-3">
                <div>
                  <Label className="text-sm">Test mapping</Label>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Uses the sample payload from the Mapping tab with your current field rules.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onRunPreview}
                  disabled={previewLoading}
                  className="gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {previewLoading ? 'Running preview...' : 'Run preview'}
                </Button>
                {!webhookUrl ? (
                  <p className="text-[11px] text-muted-foreground">{saveFirstMessage}</p>
                ) : null}
              </div>

              {previewPayload ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    {previewVisual ? previewVisual(previewPayload) : null}
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Mapped payload (JSON)</Label>
                      <pre className="rounded-xl border border-border/70 bg-muted/30 p-3 text-[11px] font-mono overflow-x-auto whitespace-pre-wrap max-h-64 overflow-y-auto">
                        {previewOutput}
                      </pre>
                    </div>
                  </div>
                  <div className="rounded-xl border border-border/70 bg-background/60 p-3">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-2">
                      Raw sample input
                    </p>
                    <pre className="text-[11px] font-mono text-muted-foreground overflow-x-auto whitespace-pre-wrap max-h-80 overflow-y-auto">
                      {samplePayload}
                    </pre>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-border/70 px-4 py-8 text-center">
                  <Sparkles className="w-5 h-5 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Run a preview to see the mapped output</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      ) : null}
    </div>
  );
}
