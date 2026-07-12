import React, { useEffect, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import db from '@/api/apiClient';
import AdminSettingsToggleRow from '@/components/admin/AdminSettingsToggleRow';
import UserAvatar from '@/components/users/UserAvatar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { getDisplayName } from '@/lib/profile';
import { cn } from '@/lib/utils';

function useDebouncedValue(value, delay = 250) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

export default function FeedModerationSettingsPanel({ settings, onChange }) {
  const requireApproval = Boolean(settings?.feed_posts_require_approval);
  const selectedUsers = Array.isArray(settings?.feed_post_approval_exempt_users)
    ? settings.feed_post_approval_exempt_users
    : [];
  const selectedIds = new Set(
    (Array.isArray(settings?.feed_post_approval_exempt_user_ids)
      ? settings.feed_post_approval_exempt_user_ids
      : selectedUsers.map((user) => user.id)
    ).map((id) => String(id))
  );

  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const debouncedQuery = useDebouncedValue(query.trim());

  useEffect(() => {
    if (!requireApproval || debouncedQuery.length < 1) {
      setResults([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    db.searchUsers(debouncedQuery, 8)
      .then((users) => {
        if (!cancelled) {
          setResults(Array.isArray(users) ? users : []);
        }
      })
      .catch(() => {
        if (!cancelled) setResults([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, requireApproval]);

  const updateExemptUsers = (nextUsers) => {
    const unique = [];
    const seen = new Set();

    nextUsers.forEach((user) => {
      const id = String(user.id);
      if (seen.has(id)) return;
      seen.add(id);
      unique.push(user);
    });

    onChange((current) => ({
      ...current,
      feed_post_approval_exempt_users: unique,
      feed_post_approval_exempt_user_ids: unique.map((user) => Number(user.id)),
    }));
  };

  const addUser = (user) => {
    if (selectedIds.has(String(user.id))) return;
    updateExemptUsers([...selectedUsers, user]);
    setQuery('');
    setResults([]);
  };

  const removeUser = (userId) => {
    updateExemptUsers(selectedUsers.filter((user) => String(user.id) !== String(userId)));
  };

  return (
    <div className="space-y-4">
      <AdminSettingsToggleRow
        label={<Label htmlFor="feed_posts_require_approval">Require approval for feed posts</Label>}
        description="When enabled, most employee posts stay pending until an admin or HR approves them. Admin and HR always publish immediately."
      >
        <Switch
          id="feed_posts_require_approval"
          checked={requireApproval}
          onCheckedChange={(checked) =>
            onChange((current) => ({ ...current, feed_posts_require_approval: checked }))
          }
        />
      </AdminSettingsToggleRow>

      {requireApproval ? (
        <div className="space-y-3 rounded-xl border p-4">
          <div>
            <Label htmlFor="feed_exempt_user_search">Post without approval</Label>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Selected users can publish to the company feed immediately, even when approval is required.
            </p>
          </div>

          {selectedUsers.length > 0 ? (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {selectedUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-primary"
                >
                  <UserAvatar user={user} className="h-8 w-8" fallbackClassName="bg-primary/15 text-xs" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{getDisplayName(user)}</p>
                    <p className="truncate text-xs opacity-70">{user.email}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeUser(user.id)}
                    className="shrink-0 rounded-md p-0.5 hover:bg-primary/15"
                    title="Remove user"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No exempt users yet. Search below to add people.</p>
          )}

          <div className="relative space-y-2">
            <Input
              id="feed_exempt_user_search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by name or email..."
              autoComplete="off"
            />
            {loading ? (
              <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching...
              </div>
            ) : null}
            {results.length > 0 ? (
              <div className="overflow-hidden rounded-xl border bg-background shadow-sm">
                {results.map((user) => {
                  const checked = selectedIds.has(String(user.id));
                  return (
                    <button
                      key={user.id}
                      type="button"
                      disabled={checked}
                      onClick={() => addUser(user)}
                      className={cn(
                        'flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors',
                        checked ? 'cursor-default opacity-50' : 'hover:bg-muted/60'
                      )}
                    >
                      <UserAvatar user={user} className="h-8 w-8" fallbackClassName="bg-muted text-xs" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{getDisplayName(user)}</p>
                        <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                      </div>
                      {checked ? <span className="text-[11px] text-muted-foreground">Added</span> : null}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
