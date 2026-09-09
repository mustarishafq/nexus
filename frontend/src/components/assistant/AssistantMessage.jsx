import React, { useCallback, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Bot, CheckCircle2, Loader2, Wrench, XCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import MediaLightbox from '@/components/media/MediaLightbox';
import LightboxZoomableImage from '@/components/media/LightboxZoomableImage';
import { cn } from '@/lib/utils';

const IMAGE_URL_PATTERN = /\.(png|jpe?g|gif|webp|bmp|svg)(\?|#|$)/i;

function isHttpUrl(value) {
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function looksLikeImageUrl(value) {
  if (!isHttpUrl(value)) return false;
  const href = String(value);
  if (IMAGE_URL_PATTERN.test(href)) return true;
  return /\/(storage|uploads|media|images?|files?|attachments?)\//i.test(href);
}

function MarkdownImage({ src, alt }) {
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const href = String(src || '');
  const label = alt || 'Image';

  const close = useCallback(() => {
    setOpen(false);
    setLoading(true);
    setError('');
  }, []);

  const openLightbox = useCallback(() => {
    if (!isHttpUrl(href) || failed) return;
    setLoading(true);
    setError('');
    setOpen(true);
  }, [failed, href]);

  if (!isHttpUrl(href) || failed) {
    if (!href) return null;
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-primary underline underline-offset-2 hover:text-primary/80"
      >
        {label || 'Open image'}
      </a>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={openLightbox}
        className="my-2 block max-w-full overflow-hidden rounded-xl border border-border/70 bg-muted/30 text-left transition hover:border-primary/40 hover:ring-1 hover:ring-primary/20"
        title="Open image"
      >
        <img
          src={href}
          alt={label}
          loading="lazy"
          referrerPolicy="no-referrer"
          className="max-h-72 w-full object-contain"
          onError={() => setFailed(true)}
        />
      </button>

      <MediaLightbox
        open={open}
        onClose={close}
        ariaLabel={label || 'Image preview'}
        contentClassName="absolute inset-0 max-h-none max-w-none"
      >
        {loading && !error ? (
          <div className="pointer-events-none absolute inset-0 z-[1] flex flex-col items-center justify-center gap-3 text-white/80">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="text-sm">Loading image…</span>
          </div>
        ) : null}

        {error ? (
          <div className="absolute inset-0 z-[1] flex items-center justify-center p-6">
            <div className="rounded-2xl bg-white/10 px-6 py-16 text-center text-sm text-white/80">
              {error}
            </div>
          </div>
        ) : null}

        <LightboxZoomableImage
          src={href}
          alt={label}
          className={cn((loading || error) && 'invisible')}
          imgClassName="max-h-[min(88vh,900px)] max-w-[min(94vw,1100px)] rounded-none"
          onDismiss={close}
          onLoad={() => setLoading(false)}
          onError={() => {
            setLoading(false);
            setError('Unable to load image.');
          }}
        />
      </MediaLightbox>
    </>
  );
}

function ToolSteps({ steps }) {
  if (!Array.isArray(steps) || steps.length === 0) return null;

  return (
    <div className="mb-3 overflow-hidden rounded-xl border border-border/70 bg-background/70">
      <div className="flex items-center gap-1.5 border-b border-border/60 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        <Wrench className="h-3 w-3" />
        Tools
      </div>
      <div className="space-y-0.5 p-1.5">
        {steps.map((step, index) => (
          <div
            key={`${step.name}-${index}`}
            className="flex items-start gap-2 rounded-lg px-2 py-1.5 text-[11px] text-muted-foreground"
          >
            {step.ok ? (
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
            ) : (
              <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
            )}
            <span className="min-w-0 break-words leading-snug">{step.summary || step.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const markdownComponents = {
  p: ({ children }) => <p className="mb-2.5 last:mb-0 leading-relaxed">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  ul: ({ children }) => <ul className="mb-2.5 list-disc space-y-1 pl-5 last:mb-0">{children}</ul>,
  ol: ({ children }) => <ol className="mb-2.5 list-decimal space-y-1 pl-5 last:mb-0">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed [&>ul]:mt-1 [&>ol]:mt-1">{children}</li>,
  a: ({ href, children }) => {
    const label = typeof children === 'string' ? children : '';
    if (looksLikeImageUrl(href)) {
      return <MarkdownImage src={href} alt={label || 'Image'} />;
    }
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-primary underline underline-offset-2 hover:text-primary/80"
      >
        {children}
      </a>
    );
  },
  img: ({ src, alt }) => <MarkdownImage src={src} alt={alt} />,
  code: ({ children, className }) => {
    const isBlock = typeof className === 'string' && className.includes('language-');
    if (isBlock) {
      return (
        <code className="block overflow-x-auto rounded-lg bg-muted/80 px-3 py-2 font-mono text-[12px] leading-relaxed">
          {children}
        </code>
      );
    }
    return (
      <code className="rounded bg-muted/80 px-1 py-0.5 font-mono text-[12px]">
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="mb-2.5 overflow-x-auto rounded-lg bg-muted/80 last:mb-0">{children}</pre>
  ),
  h1: ({ children }) => <h3 className="mb-2 text-base font-semibold">{children}</h3>,
  h2: ({ children }) => <h3 className="mb-2 text-sm font-semibold">{children}</h3>,
  h3: ({ children }) => <h3 className="mb-1.5 text-sm font-semibold">{children}</h3>,
  blockquote: ({ children }) => (
    <blockquote className="mb-2.5 border-l-2 border-border pl-3 text-muted-foreground last:mb-0">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-3 border-border/70" />,
};

function AssistantMarkdown({ content }) {
  return (
    <div className="break-words text-sm text-foreground [&_p:empty]:hidden">
      <ReactMarkdown components={markdownComponents}>
        {content || ''}
      </ReactMarkdown>
    </div>
  );
}

export default function AssistantMessage({ message }) {
  const isUser = message.role === 'user';
  const toolSteps = Array.isArray(message.tool_steps) ? message.tool_steps : [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn('flex gap-2.5', isUser ? 'justify-end' : 'justify-start')}
    >
      {!isUser ? (
        <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-primary shadow-sm">
          <Bot className="h-4 w-4" />
        </div>
      ) : null}

      <div
        className={cn(
          'max-w-[min(92%,42rem)] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm sm:max-w-[75%]',
          isUser
            ? 'rounded-br-md bg-primary text-primary-foreground'
            : 'rounded-bl-md border border-border/70 bg-card text-foreground',
        )}
      >
        {!isUser ? (
          <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground">
            Assistant
          </p>
        ) : null}

        <ToolSteps steps={toolSteps} />

        {message.pending ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/40 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span className="text-xs">Working with the system…</span>
          </div>
        ) : isUser ? (
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        ) : (
          <AssistantMarkdown content={message.content} />
        )}
      </div>
    </motion.div>
  );
}
