import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Bot, Eraser, Maximize2, Minimize2, Sparkles } from 'lucide-react';
import AssistantComposer from '@/components/assistant/AssistantComposer';
import AssistantMessage from '@/components/assistant/AssistantMessage';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { APPLICATION_TILE_ICON_CLASS } from '@/lib/applicationIcon';
import { DEFAULT_BRAND_COLOR } from '@/lib/imageColor';
import { toAbsoluteUrl } from '@/lib/media';

const PROMPT_EXAMPLES = [
  'What can this system’s API do?',
  'List recent records I can access.',
  'Summarize the available endpoints.',
];

export default function AssistantChat({
  application,
  messages,
  sending,
  clearing,
  loadingConversation,
  onSend,
  onClear,
  onBack,
  showBack,
  isFullscreen,
  onToggleFullscreen,
}) {
  const bottomRef = useRef(null);
  const scrollerRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, sending]);

  if (!application) {
    return (
      <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.08),transparent_55%)]" />
        <EmptyState
          variant="inline"
          icon={Bot}
          title="Select a system"
          description="Choose an MCP-enabled application to start asking questions."
          className="relative z-[1] flex-1"
        />
      </div>
    );
  }

  const logoUrl = application.icon_url ? toAbsoluteUrl(application.icon_url) : null;
  const brandColor = application.color || DEFAULT_BRAND_COLOR;

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.07),transparent_50%)]" />

      <div className="relative z-[1] flex shrink-0 items-center gap-3 border-b border-border/60 bg-background/70 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/55">
        {showBack ? (
          <Button type="button" variant="ghost" size="icon" className="lg:hidden" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
        ) : null}
        <div
          className="h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-border/60 shadow-sm ring-1 ring-black/5"
          style={{ backgroundColor: brandColor }}
        >
          {logoUrl ? (
            <img src={logoUrl} alt="" className={APPLICATION_TILE_ICON_CLASS} />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <span className="text-sm font-bold text-white/90">{application.name?.[0]?.toUpperCase()}</span>
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{application.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            MCP · {application.slug}
            {application.can_write
              ? ' · Read & write'
              : application.can_read
                ? ' · Read only'
                : ''}
          </p>
        </div>
        {onToggleFullscreen ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 text-muted-foreground lg:hidden"
            onClick={onToggleFullscreen}
            aria-label={isFullscreen ? 'Exit full screen' : 'View full screen'}
            title={isFullscreen ? 'Exit full screen' : 'Full screen'}
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="gap-1.5 text-muted-foreground"
          disabled={messages.length === 0 || sending || clearing}
          onClick={onClear}
        >
          <Eraser className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{clearing ? 'Clearing…' : 'Clear'}</span>
        </Button>
      </div>

      <div
        ref={scrollerRef}
        className="relative z-[1] min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-5"
      >
        {loadingConversation && messages.length === 0 ? (
          <div className="flex h-full min-h-[12rem] items-center justify-center">
            <p className="text-sm text-muted-foreground">Loading conversation…</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="mx-auto flex max-w-lg flex-col items-center py-12 text-center">
            <div
              className="h-16 w-16 overflow-hidden rounded-2xl border border-border/60 shadow-md ring-1 ring-black/5"
              style={{ backgroundColor: brandColor }}
            >
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt=""
                  className={APPLICATION_TILE_ICON_CLASS}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <span className="text-xl font-bold text-white/90">
                    {application.name?.[0]?.toUpperCase()}
                  </span>
                </div>
              )}
            </div>
            <p className="mt-5 text-base font-semibold tracking-tight">
              Ask anything about {application.name}
            </p>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
              Conversations are saved for this system. The assistant uses the MCP catalog and API to answer.
            </p>
            <div className="mt-6 grid w-full gap-2">
              {PROMPT_EXAMPLES.map((example) => (
                <button
                  key={example}
                  type="button"
                  disabled={sending}
                  onClick={() => onSend(example)}
                  className="group flex items-start gap-2 rounded-2xl border border-border/80 bg-card/80 px-3.5 py-3 text-left text-xs text-muted-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:bg-primary/[0.04] hover:text-foreground hover:shadow-md"
                >
                  <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary/70 transition-colors group-hover:text-primary" />
                  <span>{example}</span>
                </button>
              ))}
            </div>
            <Button asChild variant="link" size="sm" className="mt-4 h-auto p-0 text-xs">
              <Link to="/applications">Manage applications</Link>
            </Button>
          </div>
        ) : (
          <div className="flex w-full flex-col gap-3.5">
            {messages.map((message) => (
              <AssistantMessage key={message.id} message={message} />
            ))}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="relative z-[1]">
        <AssistantComposer sending={sending} onSend={onSend} />
      </div>
    </div>
  );
}
