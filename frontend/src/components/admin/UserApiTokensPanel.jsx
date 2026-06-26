import db from '@/api/base44Client';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Copy, Check, AlertTriangle, ChevronsUpDown, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import { useAuth } from '@/lib/AuthContext';
import { cn } from '@/lib/utils';
import { getDisplayName } from '@/lib/profile';

export const API_TOKENS_QUERY_KEY = ['admin-api-tokens'];

function matchesUserSearch(user, term) {
  const haystack = [user.name, user.full_name, user.email, user.job_title]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return haystack.includes(term);
}

function SearchableUserSelect({ users, value, onChange, currentUser }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const searchInputRef = useRef(null);
  const listRef = useRef(null);
  const term = search.trim().toLowerCase();

  const normalizedValue = value && String(value) !== String(currentUser?.id) ? String(value) : '';
  const selfLabel = `Me (${currentUser?.email || 'current user'})`;
  const selectedUser = normalizedValue
    ? users.find((entry) => String(entry.id) === normalizedValue)
    : null;
  const displayLabel = selectedUser
    ? `${getDisplayName(selectedUser)} (${selectedUser.email})`
    : selfLabel;

  const filteredUsers = useMemo(() => {
    const others = users.filter((user) => String(user.id) !== String(currentUser?.id));
    const sorted = [...others].sort((a, b) => getDisplayName(a).localeCompare(getDisplayName(b)));
    if (!term) return sorted;
    return sorted.filter((user) => matchesUserSearch(user, term));
  }, [users, term, currentUser?.id]);

  const showSelf = !term || selfLabel.toLowerCase().includes(term) || term === 'me' || term.startsWith('me ');

  useEffect(() => {
    if (!open) {
      setSearch('');
      return;
    }

    const timer = window.setTimeout(() => {
      searchInputRef.current?.focus();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [open]);

  const selectUser = (nextValue) => {
    onChange(nextValue);
    setOpen(false);
    setSearch('');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className="truncate">{displayLabel}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          window.setTimeout(() => searchInputRef.current?.focus(), 0);
        }}
        onWheel={(event) => event.stopPropagation()}
      >
        <div className="flex items-center border-b px-3">
          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <Input
            ref={searchInputRef}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name or email..."
            className="h-10 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
          />
        </div>
        <div
          ref={listRef}
          className="max-h-[240px] overflow-y-auto overscroll-contain p-1"
          style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
          onWheel={(event) => event.stopPropagation()}
        >
          {showSelf ? (
            <button
              type="button"
              className={cn(
                'flex w-full items-center gap-2 rounded-sm px-2 py-2 text-left text-sm hover:bg-accent',
                !normalizedValue && 'bg-accent'
              )}
              onClick={() => selectUser('')}
            >
              <Check className={cn('h-4 w-4 shrink-0', !normalizedValue ? 'opacity-100' : 'opacity-0')} />
              <span className="truncate">{selfLabel}</span>
            </button>
          ) : null}
          {filteredUsers.length === 0 && !showSelf ? (
            <p className="px-2 py-4 text-center text-sm text-muted-foreground">No users found.</p>
          ) : null}
          {filteredUsers.map((user) => {
            const isSelected = normalizedValue === String(user.id);
            return (
              <button
                key={user.id}
                type="button"
                className={cn(
                  'flex w-full items-start gap-2 rounded-sm px-2 py-2 text-left text-sm hover:bg-accent',
                  isSelected && 'bg-accent'
                )}
                onClick={() => selectUser(String(user.id))}
              >
                <Check className={cn('mt-0.5 h-4 w-4 shrink-0', isSelected ? 'opacity-100' : 'opacity-0')} />
                <div className="min-w-0">
                  <p className="truncate">{getDisplayName(user)}</p>
                  <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                </div>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function TokenRevealDialog({ token, onClose }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>API token created</DialogTitle>
          <DialogDescription>
            Copy this token now. You will not be able to see it again.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-lg border border-warning/30 bg-warning/5 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm text-warning">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Store this token securely. It cannot be retrieved later.
          </div>
          <div className="flex items-start gap-2">
            <code className="flex-1 break-all rounded-md bg-muted px-3 py-2 text-xs font-mono">
              {token}
            </code>
            <Button type="button" variant="outline" size="icon" onClick={copy}>
              {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function UserApiTokensPanel({ users = [], createForUserId = null, createSignal = 0 }) {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [userId, setUserId] = useState('');
  const [expiresInDays, setExpiresInDays] = useState('never');
  const [revealedToken, setRevealedToken] = useState(null);
  const [revokeTarget, setRevokeTarget] = useState(null);

  useEffect(() => {
    if (!createSignal || !createForUserId) return;
    setUserId(String(createForUserId));
    setCreateOpen(true);
  }, [createSignal, createForUserId]);

  const openCreateDialog = (forUserId = null) => {
    setLabel('');
    setUserId(forUserId ? String(forUserId) : '');
    setExpiresInDays('never');
    setCreateOpen(true);
  };

  const closeCreateDialog = () => {
    setCreateOpen(false);
    setLabel('');
    setUserId('');
    setExpiresInDays('never');
  };

  const { data, isLoading } = useQuery({
    queryKey: API_TOKENS_QUERY_KEY,
    queryFn: () => db.listAdminApiTokens(),
  });

  const createMutation = useMutation({
    mutationFn: (payload) => db.createAdminApiToken(payload),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: API_TOKENS_QUERY_KEY });
      closeCreateDialog();
      setRevealedToken(result.token);
      toast.success('API token created');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create token');
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (tokenId) => db.revokeAdminApiToken(tokenId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: API_TOKENS_QUERY_KEY });
      setRevokeTarget(null);
      toast.success('API token revoked');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to revoke token');
    },
  });

  const items = data?.items ?? [];

  const handleCreate = (event) => {
    event.preventDefault();
    const payload = {
      label: label.trim(),
      ...(userId ? { user_id: Number(userId) } : {}),
      ...(expiresInDays !== 'never' ? { expires_in_days: Number(expiresInDays) } : {}),
    };
    createMutation.mutate(payload);
  };

  return (
    <>
      <Card className="rounded-2xl border-border/70">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base">API tokens</CardTitle>
            <CardDescription>
              Generate bearer tokens for MCP, system events, and other integrations.
              Use <code className="rounded bg-muted px-1 text-xs">Authorization: Bearer</code> in requests.
            </CardDescription>
          </div>
          <Button size="sm" className="w-full sm:w-auto" onClick={() => openCreateDialog()}>
            <Plus className="mr-2 h-4 w-4" />
            Generate token
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading tokens...</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No API tokens yet. Generate one to get started.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Label</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Last used</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead className="w-[80px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.label}</TableCell>
                      <TableCell>
                        <div className="text-sm">{item.user?.name}</div>
                        <div className="text-xs text-muted-foreground">{item.user?.email}</div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {item.created_at ? format(new Date(item.created_at), 'MMM d, yyyy') : '—'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {item.last_used_at
                          ? formatDistanceToNow(new Date(item.last_used_at), { addSuffix: true })
                          : 'Never'}
                      </TableCell>
                      <TableCell>
                        {item.is_expired ? (
                          <Badge variant="destructive">Expired</Badge>
                        ) : item.expires_at ? (
                          <span className="text-sm text-muted-foreground">
                            {format(new Date(item.expires_at), 'MMM d, yyyy')}
                          </span>
                        ) : (
                          <Badge variant="secondary">Never</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setRevokeTarget(item)}
                          aria-label={`Revoke ${item.label}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={(open) => { if (!open) closeCreateDialog(); else setCreateOpen(true); }}>
        <DialogContent onOpenAutoFocus={(event) => event.preventDefault()}>
          <form onSubmit={handleCreate}>
            <DialogHeader>
              <DialogTitle>Generate API token</DialogTitle>
              <DialogDescription>
                Create a named token for API access. The token inherits the selected user&apos;s permissions.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="token-label">Label</Label>
                <Input
                  id="token-label"
                  value={label}
                  onChange={(event) => setLabel(event.target.value)}
                  placeholder="e.g. MCP integration"
                  required
                  maxLength={120}
                />
              </div>
              <div className="space-y-2">
                <Label>User</Label>
                <SearchableUserSelect
                  users={users}
                  value={userId}
                  onChange={setUserId}
                  currentUser={currentUser}
                />
              </div>
              <div className="space-y-2">
                <Label>Expiration</Label>
                <Select value={expiresInDays} onValueChange={setExpiresInDays}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="never">Never expires</SelectItem>
                    <SelectItem value="30">30 days</SelectItem>
                    <SelectItem value="90">90 days</SelectItem>
                    <SelectItem value="365">1 year</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeCreateDialog}>
                Cancel
              </Button>
              <Button type="submit" disabled={!label.trim() || createMutation.isPending}>
                {createMutation.isPending ? 'Creating...' : 'Generate'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {revealedToken ? (
        <TokenRevealDialog token={revealedToken} onClose={() => setRevealedToken(null)} />
      ) : null}

      <AlertDialog open={Boolean(revokeTarget)} onOpenChange={(open) => { if (!open) setRevokeTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke API token?</AlertDialogTitle>
            <AlertDialogDescription>
              {revokeTarget
                ? `“${revokeTarget.label}” will stop working immediately. Any integration using it will need a new token.`
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => revokeMutation.mutate(revokeTarget.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Revoke
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
