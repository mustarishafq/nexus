import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import {
  ArrowLeft,
  Brain,
  Download,
  Maximize2,
  Menu,
  Minimize2,
  Pin,
  PinOff,
  Plus,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import db from '@/api/apiClient';
import AssistantMessage from '@/components/assistant/AssistantMessage';
import GeneralChatComposer from '@/components/chat/GeneralChatComposer';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Switch } from '@/components/ui/switch';
import { glassPanelStyles } from '@/components/layout/glassStyles';
import { useAssistantFullscreen } from '@/hooks/useAssistantFullscreen';
import { useMetaTags } from '@/hooks/useMetaTags';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const PROMPT_EXAMPLES = [
  'Explain this idea in simple terms.',
  'Help me draft a polite email.',
  'Give me a few options to solve a problem at work.',
];

const LIST_KEY = ['general-chat-conversations'];

function nextMessageId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function mapStoredMessage(message) {
  return {
    id: String(message.id),
    role: message.role,
    content: message.content || '',
    attachments: Array.isArray(message.attachments) ? message.attachments : [],
    tool_steps: [],
    usage: message.usage || null,
    pendingLabel: 'Thinking…',
  };
}

function formatTokens(value) {
  return Number(value || 0).toLocaleString();
}

function QuotaBar({ quota, blocked }) {
  if (!quota) return null;

  const used = Number(quota.used) || 0;
  const limit = Number(quota.effective_limit) || 0;
  const remaining = Number(quota.remaining) || 0;
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : (blocked ? 100 : 0);
  let resetLabel = '';
  if (quota.resets_at) {
    try {
      resetLabel = formatDistanceToNow(new Date(quota.resets_at), { addSuffix: true });
    } catch {
      resetLabel = '';
    }
  }

  return (
    <div className="min-w-0 flex-1">
      <p className="truncate text-xs text-muted-foreground">
        {formatTokens(remaining)} tokens left
        {limit ? ` of ${formatTokens(limit)}` : ''}
        {resetLabel ? ` · resets ${resetLabel}` : ''}
      </p>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/15">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            blocked || pct >= 100 ? 'bg-destructive' : pct >= 85 ? 'bg-amber-500' : 'bg-primary',
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function ConversationRow({ conversation, active, onSelect, onPin, onDelete, tone = 'glass' }) {
  const panel = tone === 'panel';
  return (
    <div
      className={cn(
        'group flex items-center gap-1 rounded-xl px-1.5 py-1 transition-colors',
        active
          ? (panel ? 'bg-primary/10' : 'bg-white/20 dark:bg-white/10')
          : (panel ? 'hover:bg-muted/60' : 'hover:bg-white/10'),
      )}
    >
      <button
        type="button"
        onClick={() => onSelect(conversation.id)}
        className="min-w-0 flex-1 rounded-lg px-2 py-1.5 text-left"
      >
        <p className="truncate text-sm font-medium text-foreground">{conversation.title || 'New chat'}</p>
      </button>
      <button
        type="button"
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:bg-white/15 hover:text-foreground"
        onClick={() => onPin(conversation)}
        aria-label={conversation.pinned ? 'Unpin chat' : 'Pin chat'}
        title={conversation.pinned ? 'Unpin' : 'Pin'}
      >
        {conversation.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
      </button>
      <button
        type="button"
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:bg-destructive/15 hover:text-destructive"
        onClick={() => onDelete(conversation)}
        aria-label="Delete chat"
        title="Delete"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export default function GeneralChat({ embedded = false, onBack, onThreadOpened, children }) {
  const splitLayout = typeof children === 'function';
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [memoryDraft, setMemoryDraft] = useState('');
  const [pendingUseMemory, setPendingUseMemory] = useState(null);
  const { isFullscreen, toggleFullscreen } = useAssistantFullscreen();

  useMetaTags({
    description: splitLayout || embedded
      ? 'Ask Nexus Assistant, or talk to MCP-connected systems'
      : 'Ask general questions in Chat. This chat cannot change company systems.',
  });

  const listQuery = useQuery({
    queryKey: LIST_KEY,
    queryFn: () => db.listGeneralChatConversations(),
  });

  const conversations = Array.isArray(listQuery.data?.conversations) ? listQuery.data.conversations : [];
  const pinned = conversations.filter((item) => item.pinned);
  const recents = conversations.filter((item) => !item.pinned);
  const memories = Array.isArray(listQuery.data?.memories) ? listQuery.data.memories : [];
  const autoMemory = listQuery.data?.auto_memory !== false;
  const quota = listQuery.data?.quota || null;
  const blocked = Boolean(quota?.blocked);

  const conversationQuery = useQuery({
    queryKey: ['general-chat-conversation', activeId],
    queryFn: () => db.getGeneralChatConversation(activeId),
    enabled: Boolean(activeId),
  });

  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      return;
    }
    if (!conversationQuery.isSuccess) return;
    setMessages((prev) => {
      if (prev.some((item) => item.pending)) return prev;
      return Array.isArray(conversationQuery.data?.messages)
        ? conversationQuery.data.messages.map(mapStoredMessage)
        : [];
    });
  }, [activeId, conversationQuery.isSuccess, conversationQuery.dataUpdatedAt]);

  const pinMutation = useMutation({
    mutationFn: ({ id, pinned: nextPinned }) => db.updateGeneralChatConversation(id, { pinned: nextPinned }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: LIST_KEY });
    },
    onError: (error) => toast.error(error?.message || 'Could not update chat.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => db.deleteGeneralChatConversation(id),
    onSuccess: (_result, id) => {
      if (activeId === id) {
        setActiveId(null);
        setMessages([]);
      }
      queryClient.invalidateQueries({ queryKey: LIST_KEY });
    },
    onError: (error) => toast.error(error?.message || 'Could not delete chat.'),
  });

  const forgetMemoryMutation = useMutation({
    mutationFn: (id) => db.deleteGeneralChatMemory(id),
    onSuccess: (result) => {
      queryClient.setQueryData(LIST_KEY, (current) => ({
        ...(current || {}),
        memories: result?.memories || [],
      }));
    },
  });

  const clearMemoriesMutation = useMutation({
    mutationFn: () => db.clearGeneralChatMemories(),
    onSuccess: () => {
      queryClient.setQueryData(LIST_KEY, (current) => ({
        ...(current || {}),
        memories: [],
      }));
    },
  });

  const addMemoryMutation = useMutation({
    mutationFn: (body) => db.createGeneralChatMemory(body),
    onSuccess: (result) => {
      setMemoryDraft('');
      queryClient.setQueryData(LIST_KEY, (current) => ({
        ...(current || {}),
        memories: result?.memories || current?.memories,
      }));
    },
    onError: (error) => toast.error(error?.message || 'Could not save memory.'),
  });

  const importMemoryMutation = useMutation({
    mutationFn: (markdown) => db.importGeneralChatMemories(markdown),
    onSuccess: (result) => {
      queryClient.setQueryData(LIST_KEY, (current) => ({
        ...(current || {}),
        memories: result?.memories || current?.memories,
      }));
      toast.success('Memory loaded.');
    },
    onError: (error) => toast.error(error?.message || 'Could not load memory.'),
  });

  const autoMemoryMutation = useMutation({
    mutationFn: (next) => db.updateGeneralChatMemorySettings(next),
    onSuccess: (result) => {
      queryClient.setQueryData(LIST_KEY, (current) => ({
        ...(current || {}),
        auto_memory: result?.auto_memory,
        memories: result?.memories || current?.memories,
      }));
      queryClient.invalidateQueries({ queryKey: LIST_KEY });
    },
  });

  const chatMemoryMutation = useMutation({
    mutationFn: ({ id, use_memory }) => db.updateGeneralChatConversation(id, { use_memory }),
    onSuccess: (result) => {
      const next = result?.conversation;
      if (!next) return;
      queryClient.setQueryData(LIST_KEY, (current) => ({
        ...(current || {}),
        conversations: (current?.conversations || []).map((item) => (
          item.id === next.id ? { ...item, ...next } : item
        )),
      }));
      setPendingUseMemory(null);
    },
    onError: (error) => toast.error(error?.message || 'Could not update this chat.'),
  });

  const chatMutation = useMutation({
    mutationFn: ({ message, history, conversation_id, attachments, use_memory }) => (
      db.generalChat({ message, history, conversation_id, attachments, use_memory })
    ),
  });

  const startNewChat = () => {
    setActiveId(null);
    setMessages([]);
    setPendingUseMemory(null);
    setSidebarOpen(false);
    onThreadOpened?.();
  };

  const exportMemories = async () => {
    if (memories.length === 0) return;
    try {
      await db.exportGeneralChatMemories();
      toast.success('Memory exported.');
    } catch (error) {
      toast.error(error?.message || 'Could not export memory.');
    }
  };

  const sendMessage = async (text, attachments = []) => {
    const message = String(text || '').trim();
    if ((!message && attachments.length === 0) || chatMutation.isPending || blocked) return;

    const userTempId = nextMessageId();
    const pendingId = nextMessageId();
    const history = messages
      .filter((item) => item.role === 'user' || item.role === 'assistant')
      .filter((item) => !item.pending && item.content)
      .map((item) => ({ role: item.role, content: item.content }));

    setMessages((prev) => [
      ...prev,
      {
        id: userTempId,
        role: 'user',
        content: message,
        attachments,
      },
      { id: pendingId, role: 'assistant', content: '', pending: true, pendingLabel: 'Thinking…' },
    ]);

    try {
      const uploaded = [];
      for (const item of attachments) {
        if (item?.file) {
          const result = await db.integrations.Core.UploadFile({
            file: item.file,
            folder: 'general-chat',
          });
          const path = String(result.path || '').replace(/^\/storage\//, '');
          const url = String(result.file_url || result.url || (path ? `/storage/${path}` : '')).trim();
          if (!url) {
            throw new Error('Upload did not return a file URL.');
          }
          const mime = result.mime_type || item.mime || '';
          uploaded.push({
            url,
            name: item.name,
            mime,
            size: item.size || 0,
            kind: mime.startsWith('image/') || item.kind === 'image' ? 'image' : (item.kind || 'file'),
            previewUrl: item.previewUrl || null,
          });
        } else if (item?.url && !String(item.url).startsWith('blob:') && !String(item.url).startsWith('data:')) {
          uploaded.push(item);
        }
      }

      if (attachments.length > 0 && uploaded.length === 0) {
        throw new Error('Could not upload the attachment.');
      }

      const result = await chatMutation.mutateAsync({
        message,
        history,
        conversation_id: activeId,
        attachments: uploaded.map(({ url, name, mime, size, kind }) => ({
          url,
          name,
          mime,
          size,
          kind,
        })),
        ...(typeof pendingUseMemory === 'boolean' ? { use_memory: pendingUseMemory } : {}),
      });
      const conversation = result.conversation;
      if (conversation?.id) {
        setActiveId(conversation.id);
      }
      const userMessage = {
        ...mapStoredMessage(
          result.user_message || { id: userTempId, role: 'user', content: message, attachments: uploaded },
        ),
        attachments: (result.user_message?.attachments || uploaded).map((item, index) => ({
          ...item,
          previewUrl: item.previewUrl || uploaded[index]?.previewUrl || null,
        })),
      };
      const assistantMessage = mapStoredMessage(
        result.assistant_message || {
          id: nextMessageId(),
          role: 'assistant',
          content: result.message || '',
        },
      );

      setMessages((prev) => {
        const kept = prev.filter((item) => item.id !== pendingId && item.id !== userTempId);
        return [...kept, userMessage, assistantMessage];
      });
      queryClient.setQueryData(LIST_KEY, (current) => {
        const existing = Array.isArray(current?.conversations) ? current.conversations : [];
        const nextItem = conversation;
        const without = existing.filter((item) => item.id !== nextItem?.id);
        return {
          ...(current || {}),
          conversations: nextItem ? [nextItem, ...without] : existing,
          quota: result.quota || current?.quota,
          memories: result.memories || current?.memories,
          auto_memory: result.auto_memory ?? current?.auto_memory,
        };
      });
      if (conversation?.id) {
        queryClient.setQueryData(['general-chat-conversation', conversation.id], (current) => {
          const existing = Array.isArray(current?.messages) ? current.messages : [];
          const withoutTemps = existing.filter(
            (item) => String(item.id) !== String(userTempId) && String(item.id) !== String(pendingId),
          );
          return {
            ...(current || {}),
            conversation,
            messages: [
              ...withoutTemps,
              result.user_message || userMessage,
              result.assistant_message || assistantMessage,
            ],
            quota: result.quota || current?.quota,
          };
        });
      }
    } catch (err) {
      if (err?.status === 429 && err?.data?.quota) {
        queryClient.setQueryData(LIST_KEY, (current) => ({
          ...(current || {}),
          quota: err.data.quota,
        }));
      }
      setMessages((prev) => prev
        .filter((item) => item.id !== pendingId)
        .concat({
          id: nextMessageId(),
          role: 'assistant',
          content: err?.data?.message || err?.message || 'Something went wrong.',
          tool_steps: [],
        }));
    }
  };

  const activeConversation = useMemo(
    () => conversations.find((item) => item.id === activeId) || conversationQuery.data?.conversation || null,
    [conversations, activeId, conversationQuery.data],
  );

  const memoryActive = activeConversation
    ? Boolean(activeConversation.memory_active)
    : (typeof pendingUseMemory === 'boolean' ? pendingUseMemory : autoMemory);

  const setChatMemory = (useMemory) => {
    if (activeId) {
      chatMemoryMutation.mutate({ id: activeId, use_memory: useMemory });
      return;
    }
    setPendingUseMemory(useMemory);
  };

  if (listQuery.isError && !splitLayout) {
    return (
      <EmptyState
        icon={Sparkles}
        title="Could not load Assistant"
        description={listQuery.error?.message || 'Try again in a moment.'}
        action={(
          <Button type="button" variant="outline" size="sm" onClick={() => listQuery.refetch()}>
            Retry
          </Button>
        )}
      />
    );
  }

  const rowTone = splitLayout ? 'panel' : 'glass';
  const sidebar = (
    <div className="flex h-full min-h-0 w-full flex-col">
      <div className="flex items-center justify-between gap-2 px-3 pb-2 pt-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Chats</p>
        <Button type="button" size="sm" className="h-8 gap-1 rounded-xl" onClick={startNewChat}>
          <Plus className="h-3.5 w-3.5" />
          New
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {listQuery.isLoading && conversations.length === 0 ? (
          <p className="px-3 py-6 text-xs text-muted-foreground">Loading chats…</p>
        ) : conversations.length === 0 ? (
          <p className="px-3 py-6 text-xs text-muted-foreground">No chats yet. Start a new one.</p>
        ) : (
          <>
            {pinned.length > 0 ? (
              <div className="mb-3">
                <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Pinned</p>
                {pinned.map((conversation) => (
                  <ConversationRow
                    key={conversation.id}
                    conversation={conversation}
                    active={conversation.id === activeId}
                    tone={rowTone}
                    onSelect={(id) => {
                      setActiveId(id);
                      setSidebarOpen(false);
                      onThreadOpened?.();
                    }}
                    onPin={(item) => pinMutation.mutate({ id: item.id, pinned: !item.pinned })}
                    onDelete={(item) => deleteMutation.mutate(item.id)}
                  />
                ))}
              </div>
            ) : null}
            <div>
              <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Recents</p>
              {recents.length === 0 ? (
                <p className="px-3 py-2 text-xs text-muted-foreground">Nothing here yet.</p>
              ) : recents.map((conversation) => (
                <ConversationRow
                  key={conversation.id}
                  conversation={conversation}
                  active={conversation.id === activeId}
                  tone={rowTone}
                    onSelect={(id) => {
                      setActiveId(id);
                      setSidebarOpen(false);
                      onThreadOpened?.();
                    }}
                  onPin={(item) => pinMutation.mutate({ id: item.id, pinned: !item.pinned })}
                  onDelete={(item) => deleteMutation.mutate(item.id)}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );

  const main = (
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.12),transparent_55%)]" />
        <div className="relative z-[1] flex shrink-0 items-center gap-3 border-b border-white/10 bg-white/10 px-3 py-3 backdrop-blur-xl dark:bg-black/20">
          {onBack ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 lg:hidden"
              onClick={onBack}
              aria-label="Back to Assistant"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          ) : null}
          {splitLayout ? null : (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 md:hidden"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open chats"
            >
              <Menu className="h-4 w-4" />
            </Button>
          )}
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-primary/15 text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <QuotaBar quota={quota} blocked={blocked} />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 text-muted-foreground"
            onClick={() => setMemoryOpen((open) => !open)}
            aria-label="Saved memories"
            title="Memories"
          >
            <Brain className="h-4 w-4" />
          </Button>
          {activeConversation ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 text-muted-foreground"
              onClick={() => pinMutation.mutate({
                id: activeConversation.id,
                pinned: !activeConversation.pinned,
              })}
              aria-label={activeConversation.pinned ? 'Unpin chat' : 'Pin chat'}
            >
              {activeConversation.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
            </Button>
          ) : null}
          {splitLayout ? null : (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 text-muted-foreground lg:hidden"
              onClick={toggleFullscreen}
              aria-label={isFullscreen ? 'Exit full screen' : 'View full screen'}
              title={isFullscreen ? 'Exit full screen' : 'Full screen'}
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
          )}
        </div>

        <div className="relative z-[1] flex min-h-0 flex-1">
          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-5">
            {activeId && conversationQuery.isLoading && messages.length === 0 ? (
              <div className="flex h-full min-h-[12rem] items-center justify-center">
                <p className="text-sm text-muted-foreground">Loading conversation…</p>
              </div>
            ) : messages.length === 0 ? (
              <div className="mx-auto flex max-w-lg flex-col items-center py-12 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/15 bg-primary/15 text-primary shadow-md backdrop-blur">
                  <Sparkles className="h-7 w-7" />
                </div>
                <p className="mt-5 text-base font-semibold tracking-tight">Ask anything</p>
                <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
                  General questions only. Chat cannot change this system, and it will not discuss product security.
                  Useful facts you share can be remembered across chats.
                </p>
                <div className="mt-6 grid w-full gap-2">
                  {PROMPT_EXAMPLES.map((example) => (
                    <button
                      key={example}
                      type="button"
                      disabled={chatMutation.isPending || blocked}
                      onClick={() => sendMessage(example)}
                      className="group flex items-start gap-2 rounded-2xl border border-white/15 bg-white/10 px-3.5 py-3 text-left text-xs text-muted-foreground shadow-sm backdrop-blur transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:bg-primary/[0.08] hover:text-foreground hover:shadow-md"
                    >
                      <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary/70 transition-colors group-hover:text-primary" />
                      <span>{example}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex w-full flex-col gap-3.5">
                {messages.map((message) => (
                  <AssistantMessage key={message.id} message={message} />
                ))}
              </div>
            )}
          </div>

          {memoryOpen ? (
            <aside className="hidden h-full w-72 shrink-0 overflow-y-auto border-l border-white/10 bg-white/10 p-3 backdrop-blur-xl sm:block dark:bg-black/20">
              <div className="mb-3 flex items-center justify-between gap-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Memory</p>
                <div className="flex items-center gap-0.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-[11px]"
                    disabled={memories.length === 0}
                    onClick={exportMemories}
                  >
                    <Download className="h-3 w-3" />
                    .md
                  </Button>
                  <label className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-md px-2 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground">
                    <Upload className="h-3 w-3" />
                    Load
                    <input
                      type="file"
                      accept=".md,text/markdown,text/plain"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        event.target.value = '';
                        if (!file) return;
                        file.text().then((markdown) => importMemoryMutation.mutate(markdown));
                      }}
                    />
                  </label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-[11px]"
                    disabled={memories.length === 0 || clearMemoriesMutation.isPending}
                    onClick={() => clearMemoriesMutation.mutate()}
                  >
                    Clear
                  </Button>
                </div>
              </div>

              <div className="mb-3 space-y-2 rounded-xl border border-white/10 bg-white/5 px-2.5 py-2">
                <label className="flex items-center justify-between gap-2">
                  <span className="text-[11px] leading-snug text-foreground">Auto memory</span>
                  <Switch
                    checked={autoMemory}
                    onCheckedChange={(checked) => autoMemoryMutation.mutate(Boolean(checked))}
                    aria-label="Auto memory"
                  />
                </label>
                <p className="text-[10px] leading-relaxed text-muted-foreground">
                  {autoMemory
                    ? 'New chats use saved memory and learn new facts by default.'
                    : 'New chats start without memory. Load saved memory when you want it.'}
                </p>
                <label className="flex items-center justify-between gap-2">
                  <span className="text-[11px] leading-snug text-foreground">This chat</span>
                  <Switch
                    checked={memoryActive}
                    onCheckedChange={(checked) => setChatMemory(Boolean(checked))}
                    aria-label="Use memory in this chat"
                  />
                </label>
              </div>

              <form
                className="mb-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  const body = memoryDraft.trim();
                  if (!body || addMemoryMutation.isPending) return;
                  addMemoryMutation.mutate(body);
                }}
              >
                <textarea
                  value={memoryDraft}
                  onChange={(event) => setMemoryDraft(event.target.value)}
                  rows={2}
                  maxLength={500}
                  placeholder="Add a fact to remember…"
                  className="w-full resize-none rounded-xl border border-white/15 bg-white/10 px-2.5 py-2 text-xs outline-none placeholder:text-muted-foreground"
                />
                <Button
                  type="submit"
                  size="sm"
                  className="mt-1.5 h-7 w-full rounded-xl text-[11px]"
                  disabled={!memoryDraft.trim() || addMemoryMutation.isPending}
                >
                  Add memory
                </Button>
              </form>

              {memories.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nothing saved yet. Add a fact, load a .md file, or keep auto memory on.</p>
              ) : (
                <ul className="space-y-2">
                  {memories.map((memory) => (
                    <li key={memory.id} className="rounded-xl border border-white/10 bg-white/5 px-2.5 py-2">
                      <p className="text-xs leading-relaxed text-foreground">{memory.body}</p>
                      <button
                        type="button"
                        className="mt-1 text-[11px] text-muted-foreground hover:text-destructive"
                        onClick={() => forgetMemoryMutation.mutate(memory.id)}
                      >
                        Forget
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </aside>
          ) : null}
        </div>

        {memoryOpen ? (
          <div className="relative z-[1] border-t border-white/10 bg-white/10 px-3 py-2 sm:hidden">
            <div className="mb-1 flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Memory</p>
              <div className="flex items-center gap-2">
                <label className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                  Load
                  <input
                    type="file"
                    accept=".md,text/markdown,text/plain"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.target.value = '';
                      if (!file) return;
                      file.text().then((markdown) => importMemoryMutation.mutate(markdown));
                    }}
                  />
                </label>
                <button
                  type="button"
                  className="text-[11px] text-muted-foreground"
                  disabled={memories.length === 0}
                  onClick={exportMemories}
                >
                  Export
                </button>
              </div>
            </div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-[11px]">Auto</span>
              <Switch checked={autoMemory} onCheckedChange={(checked) => autoMemoryMutation.mutate(Boolean(checked))} />
              <span className="text-[11px]">This chat</span>
              <Switch checked={memoryActive} onCheckedChange={(checked) => setChatMemory(Boolean(checked))} />
            </div>
            {memories.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nothing saved yet.</p>
            ) : (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {memories.map((memory) => (
                  <button
                    key={memory.id}
                    type="button"
                    className="max-w-[14rem] shrink-0 rounded-xl border border-white/10 bg-white/5 px-2 py-1.5 text-left text-[11px]"
                    onClick={() => forgetMemoryMutation.mutate(memory.id)}
                  >
                    {memory.body}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : null}

        {blocked ? (
          <p className="relative z-[1] border-t border-white/10 bg-destructive/10 px-4 py-2 text-center text-xs text-destructive">
            Token limit reached. Ask an admin to top up, or wait until the limit resets.
          </p>
        ) : null}

        <div className="relative z-[1]">
          <GeneralChatComposer
            sending={chatMutation.isPending}
            disabled={blocked}
            onSend={sendMessage}
            placeholder={blocked ? 'Token limit reached' : 'Ask anything…'}
          />
        </div>
      </div>
  );

  if (splitLayout) {
    if (listQuery.isError) {
      return children({
        sidebar: null,
        main: (
          <EmptyState
            icon={Sparkles}
            title="Could not load Assistant"
            description={listQuery.error?.message || 'Try again in a moment.'}
            action={(
              <Button type="button" variant="outline" size="sm" onClick={() => listQuery.refetch()}>
                Retry
              </Button>
            )}
          />
        ),
      });
    }

    return children({ sidebar, main });
  }

  return (
    <div
      className={cn(
        'relative flex h-full min-h-0 flex-1 overflow-hidden',
        !embedded && (isFullscreen
          ? 'rounded-none border-0 sm:rounded-xl sm:border sm:border-white/15'
          : 'rounded-2xl border border-white/15'),
        glassPanelStyles,
      )}
    >
      <aside className="hidden h-full w-[16.5rem] shrink-0 border-r border-white/10 bg-white/5 md:flex dark:bg-black/10">
        {sidebar}
      </aside>

      {sidebarOpen ? (
        <div className="absolute inset-0 z-20 flex md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Close chat list"
            onClick={() => setSidebarOpen(false)}
          />
          <div className={cn('relative z-[1] h-full w-[16.5rem] border-r border-white/15', glassPanelStyles)}>
            <div className="flex items-center justify-end px-2 pt-2">
              <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={() => setSidebarOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            {sidebar}
          </div>
        </div>
      ) : null}

      {main}
    </div>
  );
}
