import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function AssistantComposer({ disabled, sending, onSend, placeholder }) {
  const [draft, setDraft] = useState('');
  const textareaRef = useRef(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = '0px';
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  }, [draft]);

  const submit = () => {
    const value = draft.trim();
    if (!value || disabled || sending) return;
    onSend(value);
    setDraft('');
  };

  return (
    <form
      className="shrink-0 border-t border-border/60 bg-background/90 p-3 backdrop-blur supports-[backdrop-filter]:bg-background/75"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <div className="flex items-end gap-2 rounded-2xl border border-border bg-card p-2 shadow-sm ring-1 ring-black/5 dark:ring-white/5">
        <textarea
          ref={textareaRef}
          value={draft}
          disabled={disabled || sending}
          rows={1}
          placeholder={placeholder || 'Ask anything about this system…'}
          className={cn(
            'max-h-32 min-h-[40px] flex-1 resize-none bg-transparent px-2.5 py-2 text-sm leading-5',
            'outline-none placeholder:text-muted-foreground',
            'disabled:cursor-not-allowed disabled:opacity-60',
          )}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
        />
        <Button
          type="submit"
          size="icon"
          className="h-10 w-10 shrink-0 rounded-xl"
          disabled={disabled || sending || !draft.trim()}
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          <span className="sr-only">Send</span>
        </Button>
      </div>
    </form>
  );
}
