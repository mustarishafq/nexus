import db from '@/api/base44Client';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow, parse } from 'date-fns';
import {
  ArrowLeft, ChevronDown, Forward, Inbox, Loader2, LogOut, Mail, MailOpen, MoreHorizontal, Paperclip,
  PenSquare, RefreshCw, Reply, ReplyAll, Search, Send, Trash2, X,
} from 'lucide-react';
import { useGoBack } from '@/hooks/useGoBack';
import { useMetaTags } from '@/hooks/useMetaTags';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { BACKGROUND_POLL_INTERVAL_MS } from '@/lib/polling';
import { useVisibleRefetchInterval } from '@/hooks/useVisibleRefetchInterval';
import { EmptyState } from '@/components/ui/empty-state';
import { UnreadBadge } from '@/components/ui/unread-badge';
import EmailMessageBody from '@/components/email/EmailMessageBody';

const MAIL_STATUS_QUERY_KEY = ['mail-status'];

function mailInboxQueryKey(search, unreadOnly) {
  return ['mail-inbox', search, unreadOnly ? 'unread' : 'all'];
}

function parseMailDate(value) {
  if (!value) return null;
  try {
    return parse(value, 'EEE, d MMM yyyy HH:mm:ss Z', new Date());
  } catch {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
}

function formatMailDate(value) {
  const parsed = parseMailDate(value);
  if (!parsed) return value || '';
  return formatDistanceToNow(parsed, { addSuffix: true });
}

function extractEmails(value) {
  if (!value) return [];
  const matches = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi);
  return matches ? [...new Set(matches.map((email) => email.toLowerCase()))] : [];
}

function prefixSubject(subject, prefix) {
  const normalized = (subject || '(No subject)').trim();
  const pattern = new RegExp(`^${prefix}:\\s*`, 'i');
  return pattern.test(normalized) ? normalized : `${prefix}: ${normalized}`;
}

function quoteBody(message) {
  const lines = (message?.body || '').split('\n').map((line) => `> ${line}`);
  return `\n\nOn ${message?.date || 'unknown date'}, ${message?.from || 'unknown sender'} wrote:\n${lines.join('\n')}`;
}

function buildReplyDraft(message, { replyAll = false, userEmail } = {}) {
  const ownEmail = (userEmail || '').toLowerCase();
  const sender = message?.reply_to || extractEmails(message?.from || '')[0] || '';
  let to = sender;
  let cc = '';

  if (replyAll) {
    const recipients = [
      ...extractEmails(message?.from || ''),
      ...extractEmails(message?.to || ''),
      ...extractEmails(message?.cc || ''),
    ].filter((email) => email !== ownEmail);

    to = recipients[0] || sender;
    cc = recipients.slice(1).join(', ');
  }

  return {
    to,
    cc,
    subject: prefixSubject(message?.subject, 'Re'),
    body: quoteBody(message),
    in_reply_to: message?.message_id || null,
    references: message?.message_id || null,
  };
}

function buildForwardDraft(message) {
  return {
    to: '',
    cc: '',
    subject: prefixSubject(message?.subject, 'Fwd'),
    body: `\n\n--- Forwarded message ---\nFrom: ${message?.from || ''}\nDate: ${message?.date || ''}\nSubject: ${message?.subject || ''}\nTo: ${message?.to || ''}\n\n${message?.body || ''}`,
    in_reply_to: null,
    references: null,
  };
}

function EmailMessageActions({
  markUnreadPending,
  onReply,
  onReplyAll,
  onForward,
  onMarkUnread,
  onDelete,
  compact = false,
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant={compact ? 'ghost' : 'outline'}
          size={compact ? 'icon' : 'sm'}
          className={compact ? 'h-8 w-8 shrink-0' : 'gap-1.5'}
          aria-label="Message actions"
        >
          <MoreHorizontal className="h-4 w-4" />
          {!compact ? 'Actions' : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onClick={onReply}>
          <Reply className="mr-2 h-4 w-4" />
          Reply
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onReplyAll}>
          <ReplyAll className="mr-2 h-4 w-4" />
          Reply all
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onForward}>
          <Forward className="mr-2 h-4 w-4" />
          Forward
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onMarkUnread} disabled={markUnreadPending}>
          <MailOpen className="mr-2 h-4 w-4" />
          Mark unread
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function InboxListItem({ message, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-start gap-3 border-b border-border/50 px-4 py-3 text-left transition-colors hover:bg-muted/40',
        active && 'bg-primary/5',
        !message.seen && 'bg-muted/20'
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className={cn('truncate text-sm', !message.seen && 'font-semibold')}>{message.from || 'Unknown sender'}</p>
          <span className="shrink-0 text-[10px] text-muted-foreground">{formatMailDate(message.date)}</span>
        </div>
        <p className={cn('mt-0.5 truncate text-sm', !message.seen ? 'font-medium text-foreground' : 'text-foreground/90')}>
          {message.subject || '(No subject)'}
        </p>
        {message.has_attachments ? (
          <p className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
            <Paperclip className="h-3 w-3" />
            Attachment
          </p>
        ) : null}
      </div>
      {!message.seen ? <UnreadBadge count={1} className="mt-1" /> : null}
    </button>
  );
}

function ConnectMailbox({ status, onConnect, connecting }) {
  const [password, setPassword] = useState('');

  if (!status?.configured) {
    return (
      <EmptyState
        icon={Inbox}
        title="Email not configured"
        description="An admin needs to set SMTP/IMAP server settings before staff can use email here."
      />
    );
  }

  if (status?.configured && status?.reachable === false) {
    return (
      <EmptyState
        icon={Inbox}
        title="Mail server unreachable"
        description="The configured mail host could not be found. Ask an admin to fix the IMAP/SMTP host in Settings."
      />
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 rounded-2xl border border-border bg-card p-6">
      <div className="space-y-1 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
          <Inbox className="h-6 w-6 text-primary" />
        </div>
        <h2 className="text-lg font-semibold">Connect mailbox</h2>
        <p className="text-sm text-muted-foreground">
          Sign in with your cPanel mailbox password for <span className="font-medium text-foreground">{status.email}</span>.
        </p>
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onConnect(password);
        }}
        className="space-y-4"
      >
        <div className="space-y-2">
          <Label htmlFor="mail-password">Mailbox password</Label>
          <Input
            id="mail-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Your webmail password"
            required
          />
        </div>
        <Button type="submit" className="w-full gap-2" disabled={connecting || !password}>
          {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
          Connect email
        </Button>
      </form>
    </div>
  );
}

const MAX_ATTACHMENTS = 5;
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function ComposeForm({ initialDraft, onSend, sending, onCancel }) {
  const fileInputRef = useRef(null);
  const [to, setTo] = useState(initialDraft?.to || '');
  const [cc, setCc] = useState(initialDraft?.cc || '');
  const [subject, setSubject] = useState(initialDraft?.subject || '');
  const [body, setBody] = useState(initialDraft?.body || '');
  const [attachments, setAttachments] = useState([]);

  useEffect(() => {
    setTo(initialDraft?.to || '');
    setCc(initialDraft?.cc || '');
    setSubject(initialDraft?.subject || '');
    setBody(initialDraft?.body || '');
    setAttachments([]);
  }, [initialDraft]);

  const addAttachments = (fileList) => {
    const files = Array.from(fileList || []);
    if (files.length === 0) return;

    setAttachments((current) => {
      const next = [...current];

      for (const file of files) {
        if (next.length >= MAX_ATTACHMENTS) {
          toast.error(`Maximum ${MAX_ATTACHMENTS} attachments.`);
          break;
        }
        if (file.size > MAX_ATTACHMENT_BYTES) {
          toast.error(`${file.name} is too large (max 10MB).`);
          continue;
        }
        if (next.some((item) => item.name === file.name && item.size === file.size)) {
          continue;
        }
        next.push(file);
      }

      return next;
    });
  };

  const removeAttachment = (index) => {
    setAttachments((current) => current.filter((_, itemIndex) => itemIndex !== index));
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSend({
          to,
          cc: cc || undefined,
          subject,
          body,
          attachments,
          in_reply_to: initialDraft?.in_reply_to || undefined,
          references: initialDraft?.references || undefined,
        });
      }}
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
    >
      <div className="shrink-0 space-y-3 border-b border-border/60 p-3 sm:p-4">
        <div className="space-y-2">
          <Label htmlFor="compose-to">To</Label>
          <Input
            id="compose-to"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            placeholder="name@company.com"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="compose-cc">Cc</Label>
          <Input
            id="compose-cc"
            value={cc}
            onChange={(event) => setCc(event.target.value)}
            placeholder="Optional"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="compose-subject">Subject</Label>
          <Input
            id="compose-subject"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            placeholder="Subject"
            required
          />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
        <Textarea
          id="compose-body"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Write your message..."
          className="min-h-[min(280px,36vh)] w-full resize-y"
          required
        />
        {attachments.length > 0 ? (
          <ul className="mt-3 space-y-2">
            {attachments.map((file, index) => (
              <li
                key={`${file.name}-${file.size}-${index}`}
                className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-sm"
              >
                <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => removeAttachment(index)}
                  aria-label={`Remove ${file.name}`}
                >
                  <X className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(event) => {
          addAttachments(event.target.files);
          event.target.value = '';
        }}
      />
      <div className="flex shrink-0 items-center justify-between gap-2 border-t border-border/60 bg-card p-3 sm:p-4">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => fileInputRef.current?.click()}
          disabled={attachments.length >= MAX_ATTACHMENTS}
        >
          <Paperclip className="h-4 w-4" />
          Attach
        </Button>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
          <Button type="submit" className="gap-2" disabled={sending}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Send
          </Button>
        </div>
      </div>
    </form>
  );
}

export default function Email() {
  const { uid } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const goBack = useGoBack('/email');
  const queryClient = useQueryClient();
  const pollInterval = useVisibleRefetchInterval(BACKGROUND_POLL_INTERVAL_MS);

  const isCompose = location.pathname.endsWith('/compose');
  const composeDraft = location.state?.composeDraft || null;
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [detailsExpanded, setDetailsExpanded] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setDetailsExpanded(false);
  }, [uid]);

  useMetaTags({
    title: 'Email - EMZI Nexus Brain',
    description: 'Company email inbox and compose',
  });

  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: MAIL_STATUS_QUERY_KEY,
    queryFn: () => db.mail.status(),
  });

  const inboxQueryKey = useMemo(
    () => mailInboxQueryKey(debouncedSearch, unreadOnly),
    [debouncedSearch, unreadOnly],
  );

  const { data: inboxData, isLoading: inboxLoading, refetch: refetchInbox, isFetching } = useQuery({
    queryKey: inboxQueryKey,
    queryFn: () => db.mail.listMessages({
      limit: 50,
      q: debouncedSearch || undefined,
      unread: unreadOnly,
    }),
    enabled: Boolean(status?.connected),
    refetchInterval: debouncedSearch ? false : pollInterval,
  });

  const { data: messageData, isLoading: messageLoading } = useQuery({
    queryKey: ['mail-message', uid],
    queryFn: () => db.mail.getMessage(uid),
    enabled: Boolean(uid) && !isCompose && Boolean(status?.connected),
  });

  useEffect(() => {
    if (!messageData?.uid) return;
    queryClient.invalidateQueries({ queryKey: ['mail-inbox'] });
  }, [messageData?.uid, queryClient]);

  const invalidateMail = () => {
    queryClient.invalidateQueries({ queryKey: MAIL_STATUS_QUERY_KEY });
    queryClient.invalidateQueries({ queryKey: ['mail-inbox'] });
  };

  const connectMailbox = useMutation({
    mutationFn: (password) => db.mail.connect(password),
    onSuccess: () => {
      invalidateMail();
      toast.success('Mailbox connected.');
    },
    onError: (error) => toast.error(error?.message || 'Could not connect mailbox.'),
  });

  const disconnectMailbox = useMutation({
    mutationFn: () => db.mail.disconnect(),
    onSuccess: () => {
      invalidateMail();
      navigate('/email');
      toast.success('Mailbox disconnected.');
    },
    onError: (error) => toast.error(error?.message || 'Could not disconnect mailbox.'),
  });

  const sendEmail = useMutation({
    mutationFn: (payload) => db.mail.send(payload),
    onSuccess: () => {
      toast.success('Email sent.');
      invalidateMail();
      navigate('/email');
    },
    onError: (error) => toast.error(error?.message || 'Could not send email.'),
  });

  const deleteEmail = useMutation({
    mutationFn: (messageUid) => db.mail.deleteMessage(messageUid),
    onSuccess: () => {
      setDeleteTarget(null);
      invalidateMail();
      queryClient.removeQueries({ queryKey: ['mail-message', uid] });
      navigate('/email');
      toast.success('Email deleted.');
    },
    onError: (error) => toast.error(error?.message || 'Could not delete email.'),
  });

  const markUnread = useMutation({
    mutationFn: (messageUid) => db.mail.markUnread(messageUid),
    onSuccess: () => {
      invalidateMail();
      toast.success('Marked as unread.');
    },
    onError: (error) => toast.error(error?.message || 'Could not mark as unread.'),
  });

  const messages = Array.isArray(inboxData?.messages) ? inboxData.messages : [];
  const showPanel = isCompose || Boolean(uid);

  const openCompose = (draft = null) => {
    navigate('/email/compose', { state: draft ? { composeDraft: draft } : undefined });
  };

  if (statusLoading) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!status?.connected) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center px-4">
        <ConnectMailbox
          status={status}
          connecting={connectMailbox.isPending}
          onConnect={(password) => connectMailbox.mutate(password)}
        />
      </div>
    );
  }

  return (
    <div className={cn(
      'mx-auto flex h-full min-h-0 w-full max-w-6xl flex-col',
      showPanel ? 'gap-0 lg:gap-4' : 'gap-2 sm:gap-4',
      showPanel && '-mx-4 -mt-4 w-[calc(100%+2rem)] sm:-mx-6 sm:-mt-6 sm:w-[calc(100%+3rem)] lg:mx-auto lg:mt-0 lg:w-full',
    )}>
      <div className={cn(
        'flex shrink-0 flex-wrap items-center justify-between gap-2 sm:gap-3',
        showPanel && 'hidden lg:flex',
      )}>
        <div className="flex min-w-0 items-center gap-2">
          <Inbox className="h-5 w-5 shrink-0 text-primary" />
          <div className="min-w-0">
            <h1 className="text-base font-semibold leading-tight sm:text-lg">Email</h1>
            <p className="truncate text-[11px] text-muted-foreground sm:text-xs">{status.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9 sm:hidden"
            onClick={() => refetchInbox()}
            disabled={isFetching}
            aria-label="Refresh inbox"
          >
            <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="hidden gap-1.5 sm:inline-flex"
            onClick={() => refetchInbox()}
            disabled={isFetching}
          >
            <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
            Refresh
          </Button>
          <Button type="button" size="icon" className="h-9 w-9 sm:hidden" onClick={() => openCompose()} aria-label="Compose email">
            <PenSquare className="h-4 w-4" />
          </Button>
          <Button type="button" size="sm" className="hidden gap-1.5 sm:inline-flex" onClick={() => openCompose()}>
            <PenSquare className="h-4 w-4" />
            Compose
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={() => disconnectMailbox.mutate()}
            disabled={disconnectMailbox.isPending}
            aria-label="Disconnect mailbox"
          >
            {disconnectMailbox.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <div className={cn(
        'grid min-h-0 flex-1 grid-cols-1 overflow-hidden bg-card lg:grid-cols-[320px_minmax(0,1fr)]',
        showPanel
          ? 'rounded-none border-0 lg:rounded-2xl lg:border lg:border-border'
          : 'rounded-2xl border border-border',
      )}>
        <div className={cn('flex min-h-0 flex-col border-b border-border lg:border-b-0 lg:border-r', showPanel && 'hidden lg:flex')}>
          <div className="shrink-0 border-b border-border/60 px-3 py-2.5 sm:px-4 sm:py-3">
            <p className="text-sm font-semibold">Inbox</p>
            <p className="text-xs text-muted-foreground">
              {inboxData?.unread_count ? `${inboxData.unread_count} unread` : 'All caught up'}
            </p>
            <div className="relative mt-3">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search mail..."
                className="h-9 pl-9"
              />
            </div>
            <div className="mt-2 flex gap-1 rounded-lg bg-muted/40 p-1">
              <button
                type="button"
                onClick={() => setUnreadOnly(false)}
                className={cn(
                  'flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors',
                  !unreadOnly ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setUnreadOnly(true)}
                className={cn(
                  'flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors',
                  unreadOnly ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                Unread
                {inboxData?.unread_count ? (
                  <span className="ml-1 text-[10px] text-primary">({inboxData.unread_count})</span>
                ) : null}
              </button>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {inboxLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : messages.length === 0 ? (
              <EmptyState
                variant="compact"
                icon={Inbox}
                title={
                  unreadOnly
                    ? 'No unread mail'
                    : debouncedSearch
                      ? 'No matches'
                      : 'Inbox is empty'
                }
                description={
                  unreadOnly
                    ? 'You have read all messages in your inbox.'
                    : debouncedSearch
                      ? 'Try a different search term.'
                      : 'New messages will appear here.'
                }
              />
            ) : (
              messages.map((message) => (
                <InboxListItem
                  key={message.uid}
                  message={message}
                  active={String(message.uid) === String(uid)}
                  onClick={() => navigate(`/email/${message.uid}`)}
                />
              ))
            )}
          </div>
        </div>

        <div className={cn('flex min-h-0 flex-col overflow-hidden', !showPanel && 'hidden lg:flex')}>
          {isCompose ? (
            <>
              <div className="flex shrink-0 items-center gap-2 border-b border-border/60 px-3 py-2 sm:px-4 sm:py-3">
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0 lg:hidden" onClick={goBack}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <p className="min-w-0 flex-1 truncate text-sm font-semibold">New message</p>
              </div>
              <ComposeForm
                initialDraft={composeDraft}
                sending={sendEmail.isPending}
                onCancel={() => navigate('/email')}
                onSend={(payload) => sendEmail.mutate(payload)}
              />
            </>
          ) : !uid ? (
            <EmptyState
              variant="inline"
              icon={Mail}
              title="Select a message"
              description="Choose an email from your inbox or compose a new one."
              className="flex-1"
              action={(
                <Button className="gap-2" onClick={() => openCompose()}>
                  <PenSquare className="h-4 w-4" />
                  Compose
                </Button>
              )}
            />
          ) : messageLoading ? (
            <div className="flex flex-1 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <div className="shrink-0 border-b border-border/60 px-3 py-2 sm:px-4 sm:py-3">
                <div className="flex items-start gap-1.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 lg:hidden"
                    onClick={goBack}
                    aria-label="Back to inbox"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <button
                    type="button"
                    onClick={() => setDetailsExpanded((expanded) => !expanded)}
                    className="min-w-0 flex-1 text-left"
                    aria-expanded={detailsExpanded}
                    aria-label={detailsExpanded ? 'Hide message details' : 'Show message details'}
                  >
                    <h2 className="line-clamp-2 text-sm font-semibold leading-snug sm:text-base">
                      {messageData?.subject || '(No subject)'}
                    </h2>
                    {!detailsExpanded ? (
                      <p className="mt-0.5 truncate text-[11px] text-muted-foreground sm:text-xs">
                        {messageData?.from || 'Unknown sender'}
                        {messageData?.date ? ` · ${formatMailDate(messageData.date)}` : ''}
                      </p>
                    ) : null}
                  </button>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 md:hidden"
                      onClick={() => openCompose(buildReplyDraft(messageData, { userEmail: status.email }))}
                      aria-label="Reply"
                    >
                      <Reply className="h-4 w-4" />
                    </Button>
                    <div className="md:hidden">
                      <EmailMessageActions
                        compact
                        markUnreadPending={markUnread.isPending}
                        onReply={() => openCompose(buildReplyDraft(messageData, { userEmail: status.email }))}
                        onReplyAll={() => openCompose(buildReplyDraft(messageData, { replyAll: true, userEmail: status.email }))}
                        onForward={() => openCompose(buildForwardDraft(messageData))}
                        onMarkUnread={() => markUnread.mutate(uid)}
                        onDelete={() => setDeleteTarget(messageData)}
                      />
                    </div>
                    <div className="hidden md:block">
                      <EmailMessageActions
                        markUnreadPending={markUnread.isPending}
                        onReply={() => openCompose(buildReplyDraft(messageData, { userEmail: status.email }))}
                        onReplyAll={() => openCompose(buildReplyDraft(messageData, { replyAll: true, userEmail: status.email }))}
                        onForward={() => openCompose(buildForwardDraft(messageData))}
                        onMarkUnread={() => markUnread.mutate(uid)}
                        onDelete={() => setDeleteTarget(messageData)}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="hidden h-8 w-8 shrink-0 text-muted-foreground md:inline-flex"
                      onClick={() => setDetailsExpanded((expanded) => !expanded)}
                      aria-expanded={detailsExpanded}
                      aria-label={detailsExpanded ? 'Hide message details' : 'Show message details'}
                    >
                      <ChevronDown className={cn('h-4 w-4 transition-transform', detailsExpanded && 'rotate-180')} />
                    </Button>
                  </div>
                </div>
                {detailsExpanded ? (
                  <div className="mt-2 space-y-0.5">
                    <p className="text-sm text-muted-foreground">
                      From <span className="text-foreground">{messageData?.from}</span>
                    </p>
                    {messageData?.to ? <p className="text-xs text-muted-foreground">To {messageData.to}</p> : null}
                    {messageData?.cc ? <p className="text-xs text-muted-foreground">Cc {messageData.cc}</p> : null}
                    {messageData?.date ? <p className="text-[11px] text-muted-foreground">{messageData.date}</p> : null}
                  </div>
                ) : null}
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
                <EmailMessageBody
                  html={messageData?.body_html}
                  text={messageData?.body_text || messageData?.body}
                />
              </div>
            </>
          )}
        </div>
      </div>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this email?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the message from your inbox on the mail server.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteEmail.mutate(deleteTarget.uid)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
