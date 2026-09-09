import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { ChartNoAxesColumn, ChevronLeft, ChevronRight, Eye, Loader2, RefreshCw } from 'lucide-react';
import db from '@/api/apiClient';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  glassDialogMutedText,
  glassDialogTitleText,
  glassPanelStyles,
} from '@/components/layout/glassStyles';
import { cn } from '@/lib/utils';

function formatTokens(value) {
  const n = Number(value) || 0;
  return n.toLocaleString();
}

function formatCost(value) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  const n = Number(value);
  if (n === 0) return '$0';
  if (n < 0.0001) return `$${n.toFixed(8)}`;
  if (n < 0.01) return `$${n.toFixed(6)}`;
  return `$${n.toFixed(4)}`;
}

function SectionLabel({ children }) {
  return (
    <p className={cn('text-xs font-medium uppercase tracking-wide', glassDialogMutedText)}>
      {children}
    </p>
  );
}

function StatTile({ label, value }) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/40 px-3 py-2.5">
      <p className={cn('text-[10px] font-medium uppercase tracking-wide', glassDialogMutedText)}>
        {label}
      </p>
      <p className={cn('mt-1 text-lg font-semibold tabular-nums leading-none', glassDialogTitleText)}>
        {value}
      </p>
    </div>
  );
}

function ContentBlock({ title, text, emptyFallback }) {
  return (
    <div className="space-y-2.5">
      <SectionLabel>{title}</SectionLabel>
      {text ? (
        <div className="max-h-[36vh] overflow-y-auto rounded-xl border border-border/60 bg-background/40 px-3 py-2.5">
          <pre className={cn('whitespace-pre-wrap break-words font-sans text-sm leading-relaxed', glassDialogTitleText)}>
            {text}
          </pre>
        </div>
      ) : (
        <p className={cn('text-sm', glassDialogMutedText)}>{emptyFallback}</p>
      )}
    </div>
  );
}

function UsageDetailSheet({ log, open, onOpenChange }) {
  const hasContent = Boolean(log?.input_text || log?.output_text);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        overlayClassName="bg-black/25 backdrop-blur-sm"
        className={cn(
          'flex w-full flex-col gap-0 border-l p-0 md:max-w-md',
          'rounded-bl-2xl md:rounded-none',
          glassPanelStyles,
        )}
      >
        <SheetHeader className="border-b border-border/50 px-6 py-5 text-left">
          <SheetTitle className={cn('flex items-center gap-2', glassDialogTitleText)}>
            <ChartNoAxesColumn className="h-4 w-4 text-primary" />
            Usage detail
          </SheetTitle>
          <SheetDescription className={glassDialogMutedText}>
            Token counts from OpenRouter for the full request loop, plus stored user input and assistant output.
          </SheetDescription>
        </SheetHeader>

        {log ? (
          <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
            <div className="grid grid-cols-2 gap-2">
              <StatTile label="Inbound" value={formatTokens(log.prompt_tokens)} />
              <StatTile label="Outbound" value={formatTokens(log.completion_tokens)} />
              <StatTile label="Total" value={formatTokens(log.total_tokens)} />
              <StatTile label="Cost" value={formatCost(log.cost)} />
            </div>

            <div className="space-y-1.5">
              <SectionLabel>Request</SectionLabel>
              <div className="rounded-xl border border-border/60 bg-background/40 px-3 py-2.5 text-sm">
                <p className={glassDialogTitleText}>
                  <span className="font-medium">{log.user?.name || 'Unknown user'}</span>
                  {log.user?.email ? (
                    <span className={cn('mt-0.5 block text-xs', glassDialogMutedText)}>{log.user.email}</span>
                  ) : null}
                </p>
                <p className={cn('mt-2 text-xs', glassDialogMutedText)}>
                  {log.application_slug || '—'} · {log.model || '—'}
                  {log.request_count > 1 ? ` · ${log.request_count} calls` : ''}
                </p>
                {(log.reasoning_tokens > 0 || log.cached_tokens > 0) ? (
                  <p className={cn('mt-1 text-xs', glassDialogMutedText)}>
                    {log.cached_tokens > 0 ? `Cached ${formatTokens(log.cached_tokens)}` : null}
                    {log.cached_tokens > 0 && log.reasoning_tokens > 0 ? ' · ' : ''}
                    {log.reasoning_tokens > 0 ? `Reasoning ${formatTokens(log.reasoning_tokens)}` : null}
                  </p>
                ) : null}
                {log.created_at ? (
                  <p className={cn('mt-1 text-xs', glassDialogMutedText)}>
                    {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                  </p>
                ) : null}
              </div>
            </div>

            {hasContent ? (
              <>
                <ContentBlock
                  title="User input"
                  text={log.input_text}
                  emptyFallback="No user input stored."
                />
                <ContentBlock
                  title="Assistant output"
                  text={log.output_text}
                  emptyFallback={log.ok ? 'No assistant output stored.' : (log.error_message || 'Request failed before a reply.')}
                />
              </>
            ) : (
              <div className="rounded-xl border border-dashed border-border/70 px-4 py-8 text-center">
                <p className={cn('text-sm', glassDialogMutedText)}>
                  Content wasn’t stored for this older request. New Assistant chats will keep input and output here.
                </p>
              </div>
            )}
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function SummaryStat({ label, value }) {
  return (
    <div className="rounded-xl border border-border/70 bg-muted/30 px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums">{value}</p>
    </div>
  );
}

export default function OpenRouterUsageLogPanel() {
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState(null);

  const { data, isLoading, isFetching, refetch, isError, error } = useQuery({
    queryKey: ['admin-llm-usage-logs', page],
    queryFn: () => db.listLlmUsageLogs({ page, per_page: 20, feature: 'assistant' }),
    placeholderData: (previous) => previous,
  });

  const logs = Array.isArray(data?.logs) ? data.logs : [];
  const summary = data?.summary || {};
  const meta = data?.meta || {};
  const lastPage = Number(meta.last_page || 1);
  const currentPage = Number(meta.current_page || page);
  const selectedLog = useMemo(
    () => logs.find((log) => log.id === selectedId) || null,
    [logs, selectedId],
  );

  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Usage log</CardTitle>
            <CardDescription>
              Inbound (prompt) and outbound (completion) tokens, with a detail view of stored input/output.
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => refetch()}
            disabled={isFetching}
            title="Refresh"
          >
            {isFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <SummaryStat label="Requests" value={formatTokens(summary.requests)} />
          <SummaryStat label="Inbound" value={formatTokens(summary.prompt_tokens)} />
          <SummaryStat label="Outbound" value={formatTokens(summary.completion_tokens)} />
          <SummaryStat label="Total tokens" value={formatTokens(summary.total_tokens)} />
          <SummaryStat label="Cost" value={formatCost(summary.cost)} />
        </div>

        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : isError ? (
          <p className="py-6 text-center text-sm text-destructive">
            {error?.message || 'Failed to load usage logs.'}
          </p>
        ) : logs.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No Assistant usage yet. Ask a question in Assistant to generate the first log.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[780px] text-left text-xs">
              <thead className="border-b border-border bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">When</th>
                  <th className="px-3 py-2 font-medium">User</th>
                  <th className="px-3 py-2 font-medium">App</th>
                  <th className="px-3 py-2 font-medium">Model</th>
                  <th className="px-3 py-2 font-medium text-right">In</th>
                  <th className="px-3 py-2 font-medium text-right">Out</th>
                  <th className="px-3 py-2 font-medium text-right">Cost</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium text-right">View</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr
                    key={log.id}
                    className="border-b border-border/60 last:border-0 hover:bg-muted/20"
                  >
                    <td className="px-3 py-2 align-top text-muted-foreground whitespace-nowrap">
                      {log.created_at
                        ? formatDistanceToNow(new Date(log.created_at), { addSuffix: true })
                        : '—'}
                    </td>
                    <td className="px-3 py-2 align-top">
                      <div className="max-w-[140px] truncate font-medium">{log.user?.name || '—'}</div>
                      {log.user?.email ? (
                        <div className="max-w-[140px] truncate text-[11px] text-muted-foreground">{log.user.email}</div>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 align-top">
                      <code className="rounded bg-muted px-1.5 py-0.5 text-[11px]">
                        {log.application_slug || '—'}
                      </code>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <div className="max-w-[180px] truncate" title={log.model || undefined}>
                        {log.model || '—'}
                      </div>
                      {log.request_count > 1 ? (
                        <div className="text-[11px] text-muted-foreground">{log.request_count} calls</div>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 align-top text-right tabular-nums">
                      {formatTokens(log.prompt_tokens)}
                    </td>
                    <td className="px-3 py-2 align-top text-right tabular-nums">
                      {formatTokens(log.completion_tokens)}
                    </td>
                    <td className="px-3 py-2 align-top text-right tabular-nums">
                      <div>{formatCost(log.cost)}</div>
                      {log.upstream_cost != null ? (
                        <div className="text-[11px] text-muted-foreground" title="Upstream inference cost">
                          up {formatCost(log.upstream_cost)}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 align-top">
                      <Badge
                        variant="outline"
                        className={cn(
                          'border-0 text-[10px]',
                          log.ok
                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                            : 'bg-destructive/10 text-destructive',
                        )}
                      >
                        {log.ok ? 'OK' : 'Error'}
                      </Badge>
                      {!log.ok && log.error_message ? (
                        <p className="mt-1 max-w-[160px] truncate text-[11px] text-muted-foreground" title={log.error_message}>
                          {log.error_message}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 align-top text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setSelectedId(log.id)}
                        title="View input / output"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {lastPage > 1 ? (
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              Page {currentPage} of {lastPage}
            </p>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={currentPage <= 1 || isFetching}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={currentPage >= lastPage || isFetching}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>

      <UsageDetailSheet
        log={selectedLog}
        open={Boolean(selectedLog)}
        onOpenChange={(next) => {
          if (!next) setSelectedId(null);
        }}
      />
    </Card>
  );
}
