import React from 'react';
import { Bot, Maximize2, Minimize2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/empty-state';
import { APPLICATION_TILE_ICON_CLASS } from '@/lib/applicationIcon';
import { DEFAULT_BRAND_COLOR } from '@/lib/imageColor';
import { toAbsoluteUrl } from '@/lib/media';
import { cn } from '@/lib/utils';

export default function AssistantAppPicker({
  applications,
  selectedSlug,
  searchQuery,
  onSearchChange,
  onSelect,
  isLoading,
  isFullscreen,
  onToggleFullscreen,
}) {
  return (
    <div className="flex h-full min-h-0 flex-col border-r border-border/60 bg-gradient-to-b from-card/80 to-muted/20">
      <div className="shrink-0 space-y-3 border-b border-border/60 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Bot className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-semibold tracking-tight">Assistant</h1>
              <p className="text-[11px] text-muted-foreground">Ask connected systems</p>
            </div>
          </div>
          {onToggleFullscreen ? (
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={onToggleFullscreen}
              aria-label={isFullscreen ? 'Exit full screen' : 'View full screen'}
              title={isFullscreen ? 'Exit full screen' : 'Full screen'}
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
          ) : null}
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search systems…"
            className="h-9 rounded-xl border-border/80 bg-background/80 pl-8"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {isLoading ? (
          <div className="space-y-2 p-1">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-16 animate-pulse rounded-xl bg-muted/70" />
            ))}
          </div>
        ) : applications.length === 0 ? (
          <EmptyState
            variant="compact"
            icon={Bot}
            title="No systems ready"
            description="Enable MCP on an application to ask it questions."
          />
        ) : (
          <div className="space-y-1">
            {applications.map((app) => {
              const logoUrl = app.icon_url ? toAbsoluteUrl(app.icon_url) : null;
              const brandColor = app.color || DEFAULT_BRAND_COLOR;
              const active = app.slug === selectedSlug;

              return (
                <button
                  key={app.id}
                  type="button"
                  onClick={() => onSelect(app)}
                  className={cn(
                    'group flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-all',
                    active
                      ? 'bg-primary/10 ring-1 ring-primary/25'
                      : 'hover:bg-muted/60',
                  )}
                >
                  <div
                    className="h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-border/60 shadow-sm ring-1 ring-black/5"
                    style={{ backgroundColor: brandColor }}
                  >
                    {logoUrl ? (
                      <img src={logoUrl} alt="" className={APPLICATION_TILE_ICON_CLASS} />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <span className="text-sm font-bold text-white/90">{app.name?.[0]?.toUpperCase()}</span>
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className={cn('truncate text-sm font-semibold', active && 'text-primary')}>
                        {app.name}
                      </p>
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-violet-500/20 bg-violet-500/10 px-1.5 py-0.5 text-[10px] text-violet-700 dark:text-violet-300">
                        <Bot className="h-2.5 w-2.5" />
                        MCP
                      </span>
                      {app.can_write ? (
                        <span className="inline-flex shrink-0 rounded-md border border-border/70 bg-muted/50 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                          Read & write
                        </span>
                      ) : app.can_read ? (
                        <span className="inline-flex shrink-0 rounded-md border border-border/70 bg-muted/50 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                          Read only
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                      {app.description?.trim() || app.slug}
                    </p>
                  </div>
                  {active ? (
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                  ) : null}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
