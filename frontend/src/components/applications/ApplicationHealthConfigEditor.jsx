import React, { useMemo, useState } from 'react';
import db from '@/api/base44Client';
import {
  Activity,
  ChevronDown,
  ChevronUp,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

const DEFAULT_HEALTH_PATH = '/api/health';

const MODE_OPTIONS = [
  {
    value: 'json_ok',
    label: 'JSON {"ok": true}',
    description: 'Standard health API — expects HTTP 2xx and {"ok": true}.',
  },
  {
    value: 'http_status',
    label: 'HTTP status only',
    description: 'For legacy apps without a health API — any 2xx response counts as healthy.',
  },
];

export default function ApplicationHealthConfigEditor({
  applicationId,
  enabled,
  onEnabledChange,
  healthPath,
  onHealthPathChange,
  healthMode,
  onHealthModeChange,
  baseUrl,
  resetKey = 0,
}) {
  const [open, setOpen] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const effectivePath = healthPath?.trim() || DEFAULT_HEALTH_PATH;
  const healthUrl = useMemo(() => {
    const trimmedBase = baseUrl?.trim().replace(/\/$/, '');
    if (!trimmedBase) {
      return null;
    }
    return `${trimmedBase}${effectivePath.startsWith('/') ? '' : '/'}${effectivePath}`;
  }, [baseUrl, effectivePath]);

  const runHealthTest = async () => {
    if (!applicationId) {
      toast.error('Save the application first to test the health endpoint.');
      return;
    }

    if (!baseUrl?.trim()) {
      toast.error('Base URL is required to test health.');
      return;
    }

    setTestLoading(true);
    setTestResult(null);

    try {
      const result = await db.testApplicationHealth(applicationId, {
        base_url: baseUrl?.trim() || undefined,
        health_check_enabled: enabled,
        health_check_path: healthPath?.trim() || undefined,
        health_check_mode: healthMode || undefined,
      });
      setTestResult(result);

      if (result?.ok) {
        toast.success(result.message || 'Health check passed.');
      } else {
        toast.error(result?.message || 'Health check failed.');
      }
    } catch (error) {
      toast.error(error?.data?.message || error.message || 'Health test failed.');
    } finally {
      setTestLoading(false);
    }
  };

  return (
    <div
      key={`health-${applicationId ?? 'new'}-${resetKey}`}
      className="rounded-2xl border border-emerald-500/20 bg-card/50 overflow-hidden shadow-sm"
    >
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="relative w-full flex items-center justify-between gap-3 px-4 py-3.5 hover:bg-muted/30 transition-colors text-left"
      >
        <div className="absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-emerald-500/8 via-transparent to-transparent pointer-events-none" />
        <div className="relative flex items-center gap-3 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
            <Activity className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold">Health monitoring</p>
              <Badge
                variant="outline"
                className={cn(
                  'text-[10px] h-5',
                  enabled
                    ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                    : 'text-muted-foreground'
                )}
              >
                {enabled ? 'Automatic' : 'Manual'}
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground truncate">
              Nexus probes this app on a schedule and updates its online status.
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
                <Label className="text-sm">Automatic health checks</Label>
                <p className="text-[11px] text-muted-foreground">
                  Turn off for apps without a probe endpoint — you manage status manually instead.
                </p>
              </div>
              <Switch checked={enabled} onCheckedChange={onEnabledChange} />
            </div>
          </div>

          {enabled ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Health path</Label>
                  <Input
                    value={healthPath}
                    onChange={(event) => onHealthPathChange(event.target.value)}
                    placeholder={DEFAULT_HEALTH_PATH}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Default is <code className="text-[10px]">/api/health</code>. Use <code className="text-[10px]">/up</code> or <code className="text-[10px]">/</code> for other stacks.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Check mode</Label>
                  <Select value={healthMode} onValueChange={onHealthModeChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MODE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">
                    {MODE_OPTIONS.find((option) => option.value === healthMode)?.description}
                  </p>
                </div>
              </div>

              {healthUrl ? (
                <p className="text-[11px] text-muted-foreground break-all">
                  Probe URL: <span className="font-mono text-foreground/80">{healthUrl}</span>
                </p>
              ) : null}

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  disabled={testLoading}
                  onClick={runHealthTest}
                >
                  <RefreshCw className={cn('w-3.5 h-3.5', testLoading && 'animate-spin')} />
                  {testLoading ? 'Testing...' : 'Test health check'}
                </Button>
              </div>

              {testResult ? (
                <div
                  className={cn(
                    'rounded-xl border px-3 py-2 text-xs',
                    testResult.ok
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200'
                      : 'border-destructive/30 bg-destructive/10 text-destructive'
                  )}
                >
                  <p className="font-medium">{testResult.message}</p>
                  {testResult.http_status != null ? (
                    <p className="mt-1 opacity-80">HTTP {testResult.http_status}{testResult.response_time_ms != null ? ` · ${testResult.response_time_ms}ms` : ''}</p>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              With monitoring off, Nexus will not probe this app. Set status manually in the field below.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
