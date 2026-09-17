import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bot } from 'lucide-react';
import db from '@/api/apiClient';
import AssistantAppPicker from '@/components/assistant/AssistantAppPicker';
import AssistantChat from '@/components/assistant/AssistantChat';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { useAssistantFullscreen } from '@/hooks/useAssistantFullscreen';
import { useAuth } from '@/lib/AuthContext';
import { canUseAssistant, canUseGeneralChat } from '@/lib/roles';
import { useMetaTags } from '@/hooks/useMetaTags';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import GeneralChat from '@/pages/GeneralChat';

function nextMessageId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function mapStoredMessage(message) {
  return {
    id: String(message.id),
    role: message.role,
    content: message.content || '',
    tool_steps: Array.isArray(message.tool_steps) ? message.tool_steps : [],
    usage: message.usage || null,
  };
}

export default function Assistant() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const canChat = canUseGeneralChat(user);
  const canApps = canUseAssistant(user);
  const appSlug = canApps ? (searchParams.get('app') || '') : '';
  const [searchQuery, setSearchQuery] = useState('');
  const [messagesBySlug, setMessagesBySlug] = useState({});
  const [mobileListOpen, setMobileListOpen] = useState(false);
  const { isFullscreen, toggleFullscreen } = useAssistantFullscreen();

  useMetaTags({
    description: canChat
      ? 'Ask Nexus Assistant, or talk to MCP-connected systems'
      : 'Ask MCP-connected systems using Nexus Assistant',
  });

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['assistant-applications'],
    queryFn: () => db.listAssistantApplications(),
    enabled: canApps,
  });

  const applications = useMemo(
    () => (Array.isArray(data?.applications) ? data.applications : []),
    [data],
  );

  const filteredApplications = useMemo(() => {
    const needle = searchQuery.trim().toLowerCase();
    if (!needle) return applications;
    return applications.filter((app) => {
      const haystack = [app.name, app.slug, app.description].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(needle);
    });
  }, [applications, searchQuery]);

  const selectedApp = useMemo(
    () => applications.find((app) => app.slug === appSlug) || null,
    [applications, appSlug],
  );

  useEffect(() => {
    if (!canApps || !appSlug || isLoading || applications.length === 0) return;
    if (!applications.some((app) => app.slug === appSlug)) {
      toast.error('That system is not available for Assistant.');
      setSearchParams({}, { replace: true });
    }
  }, [appSlug, applications, canApps, isLoading, setSearchParams]);

  const conversationQuery = useQuery({
    queryKey: ['assistant-conversation', appSlug],
    queryFn: () => db.getAssistantConversation(appSlug),
    enabled: Boolean(appSlug && selectedApp),
  });

  useEffect(() => {
    if (!appSlug || !conversationQuery.isSuccess) return;
    const mapped = Array.isArray(conversationQuery.data?.messages)
      ? conversationQuery.data.messages.map(mapStoredMessage)
      : [];
    setMessagesBySlug((prev) => {
      const current = prev[appSlug] || [];
      if (current.some((item) => item.pending)) return prev;
      return { ...prev, [appSlug]: mapped };
    });
  }, [appSlug, conversationQuery.isSuccess, conversationQuery.dataUpdatedAt]);

  const messages = messagesBySlug[appSlug] || [];
  const systemsTab = Boolean(appSlug) || searchParams.get('tab') === 'systems';
  const showGeneralChat = canChat && !systemsTab;
  const showAppChat = Boolean(appSlug && selectedApp);
  const showRightPane = showAppChat || showGeneralChat || systemsTab;
  const hidePickerOnMobile = showRightPane && !mobileListOpen;
  const hideRightOnMobile = !showRightPane || mobileListOpen;

  const selectApp = (app) => {
    setMobileListOpen(false);
    setSearchParams(app?.slug ? { app: app.slug } : { tab: 'systems' }, { replace: false });
  };

  const selectChat = () => {
    setSearchParams({}, { replace: false });
  };

  const selectSystemsTab = () => {
    if (appSlug) return;
    setSearchParams({ tab: 'systems' }, { replace: false });
  };

  const handleBack = () => {
    setMobileListOpen(true);
    if (!canChat) {
      setSearchParams({}, { replace: false });
    }
  };

  const chatMutation = useMutation({
    mutationFn: ({ application_slug, message, history }) =>
      db.assistantChat({ application_slug, message, history }),
    onError: (err) => {
      toast.error(err?.message || 'Assistant request failed.');
    },
  });

  const clearMutation = useMutation({
    mutationFn: (slug) => db.clearAssistantConversation(slug),
    onError: (err) => {
      toast.error(err?.message || 'Could not clear conversation.');
    },
  });

  const clearThread = async () => {
    if (!appSlug || clearMutation.isPending || chatMutation.isPending) return;
    try {
      await clearMutation.mutateAsync(appSlug);
      setMessagesBySlug((prev) => ({ ...prev, [appSlug]: [] }));
      queryClient.setQueryData(['assistant-conversation', appSlug], {
        conversation: null,
        messages: [],
      });
    } catch {
      // toast handled in mutation
    }
  };

  const sendMessage = async (text) => {
    if (!selectedApp || chatMutation.isPending) return;

    const content = String(text || '').trim();
    if (!content) return;

    const slug = selectedApp.slug;
    const userTempId = nextMessageId();
    const pendingId = nextMessageId();
    const history = messages
      .filter((item) => item.role === 'user' || item.role === 'assistant')
      .filter((item) => !item.pending && item.content)
      .map((item) => ({ role: item.role, content: item.content }));

    setMessagesBySlug((prev) => ({
      ...prev,
      [slug]: [
        ...(prev[slug] || []),
        { id: userTempId, role: 'user', content },
        { id: pendingId, role: 'assistant', content: '', pending: true },
      ],
    }));

    try {
      const result = await chatMutation.mutateAsync({
        application_slug: slug,
        message: content,
        history,
      });

      setMessagesBySlug((prev) => {
        const kept = (prev[slug] || []).filter(
          (item) => item.id !== pendingId && item.id !== userTempId,
        );
        return {
          ...prev,
          [slug]: [
            ...kept,
            mapStoredMessage(result.user_message || { id: userTempId, role: 'user', content }),
            mapStoredMessage(
              result.assistant_message || {
                id: nextMessageId(),
                role: 'assistant',
                content: result?.message || 'No response.',
                tool_steps: result?.tool_steps,
                usage: result?.usage,
              },
            ),
          ],
        };
      });
      queryClient.invalidateQueries({ queryKey: ['assistant-conversation', slug] });
    } catch (err) {
      const payload = err?.data;
      if (payload?.user_message && payload?.assistant_message) {
        setMessagesBySlug((prev) => {
          const kept = (prev[slug] || []).filter(
            (item) => item.id !== pendingId && item.id !== userTempId,
          );
          return {
            ...prev,
            [slug]: [
              ...kept,
              mapStoredMessage(payload.user_message),
              mapStoredMessage(payload.assistant_message),
            ],
          };
        });
        queryClient.invalidateQueries({ queryKey: ['assistant-conversation', slug] });
        return;
      }

      setMessagesBySlug((prev) => ({
        ...prev,
        [slug]: (prev[slug] || [])
          .filter((item) => item.id !== pendingId)
          .concat({
            id: nextMessageId(),
            role: 'assistant',
            content: err?.message || 'Something went wrong.',
            tool_steps: [],
          }),
      }));
    }
  };

  if (canApps && isError && !canChat) {
    return (
      <EmptyState
        icon={Bot}
        title="Could not load Assistant"
        description={error?.message || 'Try again in a moment.'}
        action={(
          <Button type="button" variant="outline" size="sm" onClick={() => navigate(0)}>
            Retry
          </Button>
        )}
      />
    );
  }

  if (canApps && !canChat && !isLoading && applications.length === 0) {
    return (
      <EmptyState
        icon={Bot}
        title="No systems ready to ask"
        description="Ask an admin to enable MCP on an application assigned to you, then refresh this page."
        action={(
          <Button asChild variant="outline" size="sm">
            <Link to="/applications">Go to Applications</Link>
          </Button>
        )}
      />
    );
  }

  if (canChat && !canApps) {
    return <GeneralChat />;
  }

  const shell = (picker, pane) => (
    <div
      className={cn(
        'flex h-full min-h-0 flex-1 overflow-hidden bg-card shadow-sm ring-1 ring-black/5 dark:ring-white/5',
        isFullscreen
          ? 'rounded-none border-0 sm:rounded-xl sm:border sm:border-border'
          : 'rounded-2xl border border-border',
      )}
    >
      <div className={cn('w-full shrink-0 lg:w-[300px] xl:w-[320px]', hidePickerOnMobile && 'hidden lg:block')}>
        {picker}
      </div>
      <div className={cn('flex min-h-0 min-w-0 flex-1 flex-col bg-background/40', hideRightOnMobile && 'hidden lg:flex')}>
        {pane}
      </div>
    </div>
  );

  const picker = (chatSidebar) => (
    <AssistantAppPicker
      applications={filteredApplications}
      selectedSlug={appSlug}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      onSelect={selectApp}
      onSelectChat={selectChat}
      onSelectSystems={selectSystemsTab}
      showGeneralChat={canChat}
      chatSelected={showGeneralChat}
      chatSidebar={chatSidebar}
      isLoading={canApps && isLoading}
      isFullscreen={isFullscreen}
      onToggleFullscreen={toggleFullscreen}
    />
  );

  const systemPane = (
    <AssistantChat
      application={selectedApp}
      messages={messages}
      sending={chatMutation.isPending}
      clearing={clearMutation.isPending}
      loadingConversation={Boolean(appSlug && conversationQuery.isLoading)}
      onSend={sendMessage}
      onClear={clearThread}
      onBack={handleBack}
      showBack
      isFullscreen={isFullscreen}
      onToggleFullscreen={toggleFullscreen}
    />
  );

  if (canChat) {
    return (
      <GeneralChat embedded onBack={handleBack} onThreadOpened={() => setMobileListOpen(false)}>
        {({ sidebar, main }) => shell(picker(sidebar), showGeneralChat ? main : systemPane)}
      </GeneralChat>
    );
  }

  return shell(picker(null), systemPane);
}
