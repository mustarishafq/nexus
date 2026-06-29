import React, { useMemo, useState } from 'react';
import db from '@/api/apiClient';
import {
  Bot,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Link2,
  RefreshCw,
  Shield,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

const DEFAULT_CATALOG_PATH = '/api/mcp-catalog';

const AUTH_SOURCE_LABELS = {
  mcp_api_key: 'MCP API key',
  webhook_secret: 'Webhook secret',
  api_key: 'SSO API key',
};

const AUTH_MODE_OPTIONS = [
  { value: 'bearer', label: 'Authorization: Bearer' },
  { value: 'x-api-key', label: 'X-API-Key header' },
];

const SETUP_PROMPT = `Please add an endpoint GET /api/mcp-catalog that returns a JSON array describing every endpoint another internal system might reasonably need to call. It should require the same service-to-service auth this system already uses for other internal API calls (e.g. the API key Nexus already authenticates with). For each endpoint include:

[
  {
    "method": "GET",
    "path": "/api/leads/{id}",
    "description": "Fetch a single lead by ID, including contact details and status.",
    "auth_required": true,
    "params": [
      { "name": "id", "in": "path", "type": "integer", "required": true, "description": "Lead ID" }
    ],
    "response_example": { "id": 1, "name": "Jane Doe", "status": "open" }
  }
]

Rules:
- method: one of GET, POST, PUT, PATCH, DELETE.
- path: relative path only (no host), using {param} for path parameters.
- description: one sentence, plain language.
- auth_required: true unless the endpoint is genuinely public.
- params: list query/body/path parameters. Omit if there are no parameters.
- response_example: a small realistic example. Omit if the response is large.
- Only include endpoints meant for server-to-server use.
- GET /api/mcp-catalog itself does not need to appear in its own output.`;

function resolveAuthSource({ mcpApiKey, webhookSecret, apiKey }) {
  if (mcpApiKey?.trim()) {
    return 'mcp_api_key';
  }
  if (webhookSecret?.trim()) {
    return 'webhook_secret';
  }
  if (apiKey?.trim()) {
    return 'api_key';
  }
  return null;
}

export default function ApplicationMcpConfigEditor({
  applicationId,
  enabled,
  onEnabledChange,
  catalogPath,
  onCatalogPathChange,
  mcpApiKey,
  onMcpApiKeyChange,
  mcpAuthMode = 'bearer',
  onMcpAuthModeChange,
  baseUrl,
  apiKey,
  webhookSecret,
  notificationConfig,
  resetKey = 0,
}) {
  const [open, setOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const effectiveCatalogPath = catalogPath?.trim() || DEFAULT_CATALOG_PATH;
  const catalogUrl = useMemo(() => {
    const trimmedBase = baseUrl?.trim().replace(/\/$/, '');
    if (!trimmedBase) {
      return null;
    }
    return `${trimmedBase}${effectiveCatalogPath.startsWith('/') ? '' : '/'}${effectiveCatalogPath}`;
  }, [baseUrl, effectiveCatalogPath]);

  const authSource = resolveAuthSource({ mcpApiKey, webhookSecret, apiKey });

  const generateMcpApiKey = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    let key = '';
    for (let i = 0; i < 32; i++) {
      key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    onMcpApiKeyChange(key);
  };

  const copyMcpApiKey = () => {
    if (!mcpApiKey) return;
    navigator.clipboard.writeText(mcpApiKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const copySetupPrompt = () => {
    navigator.clipboard.writeText(SETUP_PROMPT);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
    toast.success('Setup prompt copied — paste it into your target system\'s codebase.');
  };

  const runCatalogTest = async () => {
    if (!applicationId) {
      toast.error('Save the application first to test the catalog connection.');
      return;
    }

    if (!baseUrl?.trim()) {
      toast.error('Base URL is required to test the MCP catalog.');
      return;
    }

    setTestLoading(true);
    setTestResult(null);

    try {
      const result = await db.testApplicationMcpCatalog(applicationId, {
        base_url: baseUrl?.trim() || undefined,
        mcp_catalog_path: catalogPath?.trim() || undefined,
        mcp_api_key: mcpApiKey || undefined,
        mcp_auth_mode: mcpAuthMode || undefined,
        api_key: apiKey || undefined,
        notification_config: notificationConfig,
      });
      setTestResult(result);

      if (result?.ok) {
        toast.success(result.message || 'Catalog connection succeeded.');
      } else {
        toast.error(result?.message || 'Catalog connection failed.');
      }
    } catch (error) {
      toast.error(error?.data?.message || error.message || 'Catalog test failed.');
    } finally {
      setTestLoading(false);
    }
  };

  return (
    <div
      key={`mcp-${applicationId ?? 'new'}-${resetKey}`}
      className="rounded-2xl border border-violet-500/20 bg-card/50 overflow-hidden shadow-sm"
    >
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="relative w-full flex items-center justify-between gap-3 px-4 py-3.5 hover:bg-muted/30 transition-colors text-left"
      >
        <div className="absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-violet-500/8 via-transparent to-transparent pointer-events-none" />
        <div className="relative flex items-center gap-3 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-violet-600 dark:text-violet-400">
            <Bot className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold">MCP access</p>
              <Badge
                variant="outline"
                className={cn(
                  'text-[10px] h-5',
                  enabled
                    ? 'border-violet-500/35 bg-violet-500/10 text-violet-700 dark:text-violet-300'
                    : 'text-muted-foreground'
                )}
              >
                {enabled ? 'Enabled' : 'Off'}
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground truncate">
              Let Nexus discover and call this system&apos;s API on a user&apos;s behalf.
            </p>
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
          <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1 min-w-0">
                <Label className="text-sm">Enable MCP</Label>
                <p className="text-[11px] text-muted-foreground">
                  When enabled, Nexus&apos;s MCP server can list and call this application for authorized users.
                </p>
              </div>
              <Switch checked={enabled} onCheckedChange={onEnabledChange} />
            </div>
          </div>

          <div className={cn('space-y-4', !enabled && 'opacity-50 pointer-events-none')}>
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Link2 className="w-3.5 h-3.5 text-muted-foreground" />
                  <Label>Catalog path</Label>
                </div>
                <Input
                  value={catalogPath}
                  onChange={(event) => onCatalogPathChange(event.target.value)}
                  placeholder={DEFAULT_CATALOG_PATH}
                  disabled={!enabled}
                  className="bg-background/80"
                />
                <p className="text-[11px] text-muted-foreground">
                  Relative path on this system&apos;s Base URL where it publishes its API catalog. Defaults to{' '}
                  <code className="rounded bg-muted px-1 py-0.5 text-[10px]">{DEFAULT_CATALOG_PATH}</code> when blank.
                </p>
              </div>

              {catalogUrl ? (
                <div className="space-y-2">
                  <Label>Resolved catalog URL</Label>
                  <div className="rounded-lg border border-border/70 bg-muted/30 px-3 py-2 font-mono text-[11px] break-all leading-relaxed">
                    {catalogUrl}
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-border/80 bg-muted/10 px-3 py-2.5 text-[11px] text-muted-foreground">
                  Set a Base URL above to preview the full catalog URL Nexus will call.
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Shield className="w-3.5 h-3.5 text-muted-foreground" />
                  <Label>API auth header</Label>
                </div>
                <Select
                  value={mcpAuthMode || 'bearer'}
                  onValueChange={onMcpAuthModeChange}
                  disabled={!enabled}
                >
                  <SelectTrigger className="bg-background/80">
                    <SelectValue placeholder="Choose auth header" />
                  </SelectTrigger>
                  <SelectContent>
                    {AUTH_MODE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  How Nexus sends the credential when calling this system. Use X-API-Key for APIs that expect{' '}
                  <code className="rounded bg-muted px-1 py-0.5 text-[10px]">X-API-Key: …</code> instead of Bearer.
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Shield className="w-3.5 h-3.5 text-muted-foreground" />
                  <Label>MCP API key <span className="text-muted-foreground font-normal">(optional)</span></Label>
                </div>
                <div className="flex gap-2">
                  <Input
                    value={mcpApiKey}
                    onChange={(event) => onMcpApiKeyChange(event.target.value)}
                    placeholder="Dedicated API credential for Nexus → system calls"
                    autoComplete="off"
                    spellCheck={false}
                    type="password"
                    disabled={!enabled}
                    className="bg-background/80"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={generateMcpApiKey}
                    title="Generate MCP API key"
                    disabled={!enabled}
                  >
                    <RefreshCw className="w-4 h-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={copyMcpApiKey}
                    disabled={!enabled || !mcpApiKey}
                    title="Copy MCP API key"
                  >
                    {copiedKey ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Sent using the auth header above when Nexus calls this system. If blank, Nexus falls back to the webhook secret, then the SSO API key.
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Auth that will be used:{' '}
                  <span className="font-medium text-foreground">
                    {authSource ? AUTH_SOURCE_LABELS[authSource] : 'None configured'}
                  </span>
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-border/70 bg-muted/10 p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-violet-500" />
                    <p className="text-sm font-medium">Target system setup</p>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    The connected system must expose a live catalog endpoint. Copy this prompt for its maintainers or an AI coding session.
                  </p>
                </div>
                <Button type="button" variant="outline" size="sm" className="shrink-0 gap-1.5" onClick={copySetupPrompt}>
                  {copiedPrompt ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  Copy prompt
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={runCatalogTest}
                disabled={!enabled || testLoading || !applicationId}
              >
                {testLoading ? 'Testing…' : 'Test catalog connection'}
              </Button>
              {!applicationId ? (
                <p className="text-[11px] text-muted-foreground">Save the application first to run a live catalog test.</p>
              ) : null}
            </div>

            {testResult ? (
              <div
                className={cn(
                  'rounded-lg border px-3 py-2.5 text-[11px] space-y-2',
                  testResult.ok
                    ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-900 dark:text-emerald-100'
                    : 'border-amber-500/30 bg-amber-500/5 text-amber-950 dark:text-amber-100'
                )}
              >
                <p className="font-medium">{testResult.message}</p>
                {testResult.http_status ? (
                  <p>HTTP {testResult.http_status}</p>
                ) : null}
                {typeof testResult.endpoint_count === 'number' ? (
                  <p>{testResult.endpoint_count} endpoint(s) returned</p>
                ) : null}
                {Array.isArray(testResult.endpoints) && testResult.endpoints.length > 0 ? (
                  <pre className="overflow-x-auto rounded bg-background/60 p-2 text-[10px] leading-relaxed">
                    {JSON.stringify(testResult.endpoints, null, 2)}
                  </pre>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
