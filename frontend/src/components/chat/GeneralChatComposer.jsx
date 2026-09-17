import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Paperclip, Send, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const MAX_ATTACHMENTS = 5;

function nextId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function GeneralChatComposer({ disabled, sending, onSend, placeholder }) {
  const [draft, setDraft] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const textareaRef = useRef(null);
  const fileRef = useRef(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = '0px';
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  }, [draft]);

  useEffect(() => () => {
    attachments.forEach((item) => {
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    });
  }, []);

  const busy = disabled || sending || uploading;

  const addFiles = (fileList) => {
    const incoming = Array.from(fileList || []);
    if (incoming.length === 0) return;
    setAttachments((prev) => {
      const room = MAX_ATTACHMENTS - prev.length;
      if (room <= 0) {
        toast.error(`You can attach up to ${MAX_ATTACHMENTS} files.`);
        return prev;
      }
      const next = incoming.slice(0, room).map((file) => ({
        id: nextId(),
        file,
        name: file.name,
        mime: file.type || '',
        size: file.size || 0,
        previewUrl: file.type?.startsWith('image/') ? URL.createObjectURL(file) : null,
      }));
      if (incoming.length > room) {
        toast.error(`You can attach up to ${MAX_ATTACHMENTS} files.`);
      }
      return [...prev, ...next];
    });
  };

  const removeAttachment = (id) => {
    setAttachments((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((item) => item.id !== id);
    });
  };

  const submit = async () => {
    const value = draft.trim();
    if ((!value && attachments.length === 0) || busy) return;

    const pending = attachments.map((item) => ({
      file: item.file,
      name: item.name,
      mime: item.mime || '',
      size: item.size || 0,
      previewUrl: item.previewUrl || null,
      kind: item.mime?.startsWith('image/') || Boolean(item.previewUrl) ? 'image' : 'file',
    }));
    setDraft('');
    setAttachments([]);
    setUploading(true);
    try {
      await onSend(value, pending);
    } catch (error) {
      setDraft(value);
      setAttachments(pending.map((item) => ({
        ...item,
        id: item.id || nextId(),
      })));
      toast.error(error?.message || 'Could not send attachments.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <form
      className="shrink-0 border-t border-white/10 bg-white/5 p-3 backdrop-blur-xl dark:bg-black/20"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      {attachments.length > 0 ? (
        <div className="mb-2 flex flex-wrap gap-2">
          {attachments.map((item) => (
            <div
              key={item.id}
              className="relative overflow-hidden rounded-xl border border-white/15 bg-white/10"
            >
              {item.previewUrl ? (
                <img src={item.previewUrl} alt="" className="h-16 w-16 object-cover" />
              ) : (
                <div className="flex h-16 max-w-[10rem] items-center px-3 text-[11px] text-foreground">
                  <span className="truncate">{item.name}</span>
                </div>
              )}
              <button
                type="button"
                className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-white"
                onClick={() => removeAttachment(item.id)}
                aria-label="Remove attachment"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex items-end gap-2 rounded-2xl border border-white/15 bg-white/10 p-2 shadow-sm backdrop-blur-md dark:bg-white/5">
        <input
          ref={fileRef}
          type="file"
          multiple
          accept="image/*,.pdf,.txt,.md,.csv,.json,.doc,.docx,.xls,.xlsx"
          className="hidden"
          onChange={(event) => {
            addFiles(event.target.files);
            event.target.value = '';
          }}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-10 w-10 shrink-0 rounded-xl text-muted-foreground"
          disabled={busy || attachments.length >= MAX_ATTACHMENTS}
          onClick={() => fileRef.current?.click()}
          aria-label="Attach files"
        >
          <Paperclip className="h-4 w-4" />
        </Button>
        <textarea
          ref={textareaRef}
          value={draft}
          disabled={disabled || sending}
          rows={1}
          placeholder={placeholder || 'Ask anything…'}
          className={cn(
            'max-h-32 min-h-[40px] flex-1 resize-none bg-transparent px-1.5 py-2 text-sm leading-5',
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
          disabled={busy || (!draft.trim() && attachments.length === 0)}
        >
          {sending || uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          <span className="sr-only">Send</span>
        </Button>
      </div>
    </form>
  );
}
