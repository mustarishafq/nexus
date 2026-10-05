import db from '@/api/apiClient';
import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Loader2, Search, Send } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import UserAvatar from '@/components/users/UserAvatar';
import { useAuth } from '@/lib/AuthContext';
import { getDisplayName } from '@/lib/profile';
import { MESSAGES_INBOX_QUERY_KEY } from '@/lib/queryKeys';
import { cn } from '@/lib/utils';

const MAX_RECIPIENTS = 10;
const MAX_BODY_LENGTH = 2000;

function useDebouncedValue(value, delay = 250) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

export default function ShareToMessagesDialog({ open, onOpenChange, shareUrl }) {
  const { user: authUser } = useAuth();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState('');
  const [note, setNote] = useState('');
  const [selected, setSelected] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [sending, setSending] = useState(false);
  const trimmedQuery = query.trim();
  const debouncedQuery = useDebouncedValue(trimmedQuery);
  const selfId = authUser?.id != null ? String(authUser.id) : null;

  const { data: inboxData, isLoading: inboxLoading } = useQuery({
    queryKey: MESSAGES_INBOX_QUERY_KEY,
    queryFn: () => db.messages.listConversations(),
    enabled: open,
  });

  const recentUsers = useMemo(() => {
    const conversations = Array.isArray(inboxData?.conversations) ? inboxData.conversations : [];
    return conversations
      .map((conversation) => conversation?.other_user)
      .filter((user) => user?.id != null && String(user.id) !== selfId)
      .slice(0, 8);
  }, [inboxData, selfId]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setNote('');
      setSelected([]);
      setSearchResults([]);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !debouncedQuery) {
      setSearchResults([]);
      return undefined;
    }

    let cancelled = false;
    setSearching(true);

    db.searchUsers(debouncedQuery, 8)
      .then((users) => {
        if (cancelled) return;
        const list = Array.isArray(users) ? users : [];
        setSearchResults(list.filter((user) => !user?.isAll && String(user.id) !== selfId));
      })
      .catch(() => {
        if (!cancelled) setSearchResults([]);
      })
      .finally(() => {
        if (!cancelled) setSearching(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, debouncedQuery, selfId]);

  const isSelected = (user) => selected.some((entry) => String(entry.id) === String(user.id));

  const toggleUser = (user) => {
    setSelected((prev) => {
      if (prev.some((entry) => String(entry.id) === String(user.id))) {
        return prev.filter((entry) => String(entry.id) !== String(user.id));
      }
      if (prev.length >= MAX_RECIPIENTS) {
        toast.error(`You can share with up to ${MAX_RECIPIENTS} people at once.`);
        return prev;
      }
      return [...prev, user];
    });
  };

  const absoluteUrl = useMemo(() => {
    if (!shareUrl) return '';
    try {
      return new URL(shareUrl, window.location.origin).toString();
    } catch {
      return shareUrl;
    }
  }, [shareUrl]);

  const body = [note.trim(), absoluteUrl].filter(Boolean).join('\n\n');
  const tooLong = body.length > MAX_BODY_LENGTH;

  const handleSend = async () => {
    if (!selected.length || !absoluteUrl || tooLong || sending) return;

    setSending(true);
    const results = await Promise.allSettled(
      selected.map((user) => db.messages.startConversation(user.id, body))
    );
    setSending(false);

    const sentConversationIds = results
      .filter((result) => result.status === 'fulfilled')
      .map((result) => result.value?.conversation?.id)
      .filter(Boolean);
    const failed = results.filter((result) => result.status === 'rejected').length;

    queryClient.invalidateQueries({ queryKey: MESSAGES_INBOX_QUERY_KEY });
    sentConversationIds.forEach((id) => {
      queryClient.invalidateQueries({ queryKey: ['messages-thread', id] });
    });

    if (failed === 0) {
      toast.success(selected.length === 1 ? `Sent to ${getDisplayName(selected[0])}.` : `Sent to ${selected.length} people.`);
      onOpenChange(false);
      return;
    }

    const failedUsers = selected.filter((_, index) => results[index].status === 'rejected');
    setSelected(failedUsers);
    toast.error(
      failed === selected.length
        ? 'Could not send the post.'
        : `Sent to ${selected.length - failed}, but ${failed} failed. Try again.`
    );
  };

  const list = trimmedQuery ? searchResults : recentUsers;
  const listLoading = trimmedQuery ? searching || trimmedQuery !== debouncedQuery : inboxLoading;

  return (
    <Dialog open={open} onOpenChange={(next) => !sending && onOpenChange(next)}>
      <DialogContent className="max-w-md gap-3">
        <DialogHeader>
          <DialogTitle>Send in Messages</DialogTitle>
          <DialogDescription>Share this post with colleagues in a direct message.</DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search colleagues"
            className="pl-9"
            autoFocus
          />
        </div>

        {selected.length ? (
          <div className="flex flex-wrap gap-1.5">
            {selected.map((user) => (
              <button
                key={user.id}
                type="button"
                onClick={() => toggleUser(user)}
                className="inline-flex max-w-[11rem] items-center gap-1 truncate rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/15"
                title="Remove"
              >
                <span className="truncate">{getDisplayName(user)}</span>
                <span aria-hidden>×</span>
              </button>
            ))}
          </div>
        ) : null}

        <div className="-mx-1 max-h-64 min-h-[8rem] overflow-y-auto">
          {!trimmedQuery ? (
            <p className="px-2 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Recent</p>
          ) : null}
          {listLoading ? (
            <div className="flex items-center gap-2 px-3 py-3 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {trimmedQuery ? 'Searching...' : 'Loading...'}
            </div>
          ) : list.length === 0 ? (
            <p className="px-3 py-3 text-xs text-muted-foreground">
              {trimmedQuery ? 'No colleagues found.' : 'No recent conversations. Search for a colleague above.'}
            </p>
          ) : (
            list.map((user) => {
              const active = isSelected(user);
              return (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => toggleUser(user)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-muted/60',
                    active && 'bg-primary/5'
                  )}
                >
                  <UserAvatar user={user} className="h-9 w-9" fallbackClassName="text-xs" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{getDisplayName(user)}</p>
                    {user.department ? (
                      <p className="truncate text-[11px] text-muted-foreground">{user.department}</p>
                    ) : null}
                  </div>
                  <span
                    className={cn(
                      'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border',
                      active ? 'border-primary bg-primary text-primary-foreground' : 'border-border'
                    )}
                  >
                    {active ? <Check className="h-3 w-3" /> : null}
                  </span>
                </button>
              );
            })
          )}
        </div>

        <Textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Add a message (optional)"
          rows={2}
          className="resize-none"
        />
        {tooLong ? <p className="text-xs text-destructive">Message is too long.</p> : null}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={sending}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSend} disabled={!selected.length || tooLong || sending} className="gap-1.5">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {selected.length > 1 ? `Send to ${selected.length}` : 'Send'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
