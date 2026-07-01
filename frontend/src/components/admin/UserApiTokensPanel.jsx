import db from '@/api/apiClient';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Copy, Check, AlertTriangle, ChevronsUpDown, Search, Shield, Link2, Eye, PencilLine, ShieldCheck, Ban, RotateCcw, Layers } from 'lucide-react';
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
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import { useAuth } from '@/lib/AuthContext';
import { cn } from '@/lib/utils';
import { getDisplayName } from '@/lib/profile';
import { DEFAULT_BRAND_COLOR } from '@/lib/imageColor';
import { toAbsoluteUrl } from '@/lib/media';

export const API_TOKENS_QUERY_KEY = ['admin-api-tokens'];

const MCP_ACCESS_LABELS = {
  inherit: 'Use default',
  none: 'No MCP access',
  read: 'Read only',
  write: 'Write only',
  both: 'Read & write',
};

const MCP_DEFAULT_OPTIONS = [
  {
    value: 'none',
    label: MCP_ACCESS_LABELS.none,
    description: 'Block all MCP tools unless an application override grants access.',
  },
  {
    value: 'read',
    label: MCP_ACCESS_LABELS.read,
    description: 'Default for all applications: list systems, describe APIs, and GET requests only.',
  },
  {
    value: 'write',
    label: MCP_ACCESS_LABELS.write,
    description: 'Default for all applications: POST, PUT, PATCH, and DELETE only.',
  },
  {
    value: 'both',
    label: MCP_ACCESS_LABELS.both,
    description: 'Default for all applications: full read and write access.',
  },
];

const MCP_PER_APP_OPTIONS = [
  { value: 'inherit', label: 'Default', shortLabel: 'Default', icon: Link2 },
  { value: 'none', label: MCP_ACCESS_LABELS.none, shortLabel: 'None', icon: Ban },
  { value: 'read', label: MCP_ACCESS_LABELS.read, shortLabel: 'Read', icon: Eye },
  { value: 'write', label: MCP_ACCESS_LABELS.write, shortLabel: 'Write', icon: PencilLine },
  { value: 'both', label: MCP_ACCESS_LABELS.both, shortLabel: 'Full', icon: ShieldCheck },
];

function effectiveAccessForApp(defaultAccess, overrideValue) {
  return !overrideValue || overrideValue === 'inherit' ? defaultAccess : overrideValue;
}

function ApplicationAccessRow({ app, defaultAccess, value, onChange }) {
  const effective = effectiveAccessForApp(defaultAccess, value);
  const isOverride = value && value !== 'inherit';
  const logoUrl = app.icon_url ? toAbsoluteUrl(app.icon_url) : null;
  const brandColor = app.color || DEFAULT_BRAND_COLOR;

  return (
    <div
      className={cn(
        'rounded-xl border px-3 py-3 transition-colors',
        isOverride
          ? 'border-primary/30 bg-primary/5'
          : 'border-border/70 bg-card/40'
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={app.name}
              className="h-10 w-10 shrink-0 rounded-xl object-cover ring-1 ring-black/10"
            />
          ) : (
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xs font-semibold text-white ring-1 ring-black/10"
              style={{ backgroundColor: brandColor }}
            >
              {app.name?.[0]?.toUpperCase() || '?'}
            </div>
          )}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium truncate">{app.name}</p>
              <code className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">{app.slug}</code>
              {isOverride ? (
                <Badge variant="outline" className="text-[10px] h-5 border-primary/30 text-primary">
                  Override
                </Badge>
              ) : null}
            </div>
            <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
              <span>Effective</span>
              {mcpAccessBadge(effective, { compact: true })}
            </div>
          </div>
        </div>

        <div className="grid w-full shrink-0 grid-cols-5 gap-1.5 sm:max-w-[400px] sm:justify-self-end">
          {MCP_PER_APP_OPTIONS.map((option) => {
            const Icon = option.icon;
            const isSelected = value === option.value;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={isSelected}
                title={option.label}
                onClick={() => onChange(option.value)}
                className={cn(
                  'inline-flex items-center justify-center gap-1 rounded-lg border px-3 py-2 text-xs font-medium leading-none transition-colors',
                  isSelected
                    ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary/30'
                    : 'border-border/70 bg-background text-muted-foreground hover:border-border hover:text-foreground'
                )}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span>{option.shortLabel}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function mcpAccessBadge(access, { hasOverrides = false, compact = false } = {}) {
  const className = compact ? 'text-[10px] px-1.5 py-0' : '';
  if (hasOverrides && access === 'none') {
    return <Badge className={cn('bg-amber-500/15 text-amber-700 border-amber-500/20 dark:text-amber-400', className)}>Custom per app</Badge>;
  }
  if (access === 'both') {
    return <Badge className={cn('bg-success/15 text-success border-success/20', className)}>Read & write</Badge>;
  }
  if (access === 'write') {
    return <Badge className={cn('bg-sky-500/15 text-sky-600 border-sky-500/20 dark:text-sky-400', className)}>Write only</Badge>;
  }
  if (access === 'read') {
    return (
      <Badge className={cn('bg-muted text-muted-foreground border-border/70', className)}>
        {hasOverrides && !compact ? 'Read only · custom' : 'Read only'}
      </Badge>
    );
  }
  return <Badge variant="outline" className={className}>No access</Badge>;
}

function McpAccessDialog({ target, saving, onClose, onSave }) {
  const [defaultAccess, setDefaultAccess] = useState('none');
  const [appOverrides, setAppOverrides] = useState({});
  const [appSearch, setAppSearch] = useState('');
  const [appFilter, setAppFilter] = useState('all');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-user-mcp-access', target?.user?.id],
    queryFn: () => db.getAdminApiTokenUserMcpAccess(target.user.id),
    enabled: Boolean(target?.user?.id),
  });

  useEffect(() => {
    if (!data) return;
    setDefaultAccess(data.mcp_access || 'none');
    const next = {};
    for (const app of data.applications ?? []) {
      if (app.override) {
        next[app.application_id] = app.override;
      }
    }
    setAppOverrides(next);
    setAppSearch('');
    setAppFilter('all');
  }, [data]);

  if (!target) return null;

  const applications = data?.applications ?? [];
  const overrideCount = Object.keys(appOverrides).length;

  const filteredApplications = useMemo(() => {
    const term = appSearch.trim().toLowerCase();
    return applications.filter((app) => {
      const selected = appOverrides[app.application_id] || 'inherit';
      const matchesFilter = appFilter === 'all'
        || (appFilter === 'overridden' && selected !== 'inherit')
        || (appFilter === 'default' && selected === 'inherit');
      if (!matchesFilter) return false;
      if (!term) return true;
      return [app.name, app.slug].filter(Boolean).join(' ').toLowerCase().includes(term);
    });
  }, [applications, appOverrides, appFilter, appSearch]);

  const hasChanges = data
    ? defaultAccess !== (data.mcp_access || 'none')
      || applications.some((app) => {
        const current = appOverrides[app.application_id] || 'inherit';
        const initial = app.override || 'inherit';
        return current !== initial;
      })
    : false;

  const setAppOverride = (applicationId, next) => {
    setAppOverrides((prev) => {
      const updated = { ...prev };
      if (next === 'inherit') {
        delete updated[applicationId];
      } else {
        updated[applicationId] = next;
      }
      return updated;
    });
  };

  const resetAllOverrides = () => setAppOverrides({});

  const handleSave = () => {
    onSave({
      mcp_access: defaultAccess,
      application_overrides: applications.map((app) => ({
        application_id: app.application_id,
        mcp_access: appOverrides[app.application_id] || 'inherit',
      })),
    });
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="!flex h-[min(90vh,820px)] max-h-[90vh] w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="shrink-0 border-b border-border/70 px-6 py-4">
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            Manage MCP access
          </DialogTitle>
          <DialogDescription>
            Configure what <span className="font-medium text-foreground">{target.user?.name}</span> can do through MCP connectors and API tokens.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <p className="px-6 py-8 text-sm text-muted-foreground">Loading MCP access...</p>
        ) : (
          <div
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-4"
            style={{ WebkitOverflowScrolling: 'touch' }}
            onWheel={(event) => event.stopPropagation()}
          >
            <div className="space-y-6 pb-2">
              <div className="rounded-2xl border border-border/70 bg-muted/20 px-4 py-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Account</p>
                    <p className="text-sm font-medium">{target.user?.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Default access</span>
                    {mcpAccessBadge(defaultAccess, { compact: true })}
                  </div>
                </div>
              </div>

              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-semibold">Default for all applications</Label>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {MCP_DEFAULT_OPTIONS.map((option) => {
                    const isSelected = defaultAccess === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setDefaultAccess(option.value)}
                        className={cn(
                          'rounded-xl border px-4 py-3 text-left transition-colors',
                          isSelected
                            ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                            : 'border-border/70 hover:border-border hover:bg-muted/40'
                        )}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm font-medium">{option.label}</span>
                          {isSelected ? <Check className="h-4 w-4 text-primary shrink-0" /> : null}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{option.description}</p>
                      </button>
                    );
                  })}
                </div>
              </section>

              <Separator />

              <section className="space-y-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <Label className="text-sm font-semibold">Per-application overrides</Label>
                    <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                      Optional. Pick <span className="font-medium text-foreground">Default</span> to inherit the setting above, or choose a different level for a specific system.
                    </p>
                  </div>
                  {overrideCount > 0 ? (
                    <Button type="button" variant="ghost" size="sm" className="h-8 shrink-0" onClick={resetAllOverrides}>
                      <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                      Reset overrides
                    </Button>
                  ) : null}
                </div>

                {applications.length === 0 ? (
                  <p className="text-sm text-muted-foreground rounded-xl border border-dashed px-4 py-8 text-center">
                    No MCP-enabled applications are available to this user yet.
                  </p>
                ) : (
                  <>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          value={appSearch}
                          onChange={(event) => setAppSearch(event.target.value)}
                          placeholder="Search applications..."
                          className="h-9 pl-9"
                        />
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {[
                          { id: 'all', label: `All (${applications.length})` },
                          { id: 'overridden', label: `Overridden (${overrideCount})` },
                          { id: 'default', label: `Using default (${applications.length - overrideCount})` },
                        ].map((filter) => (
                          <button
                            key={filter.id}
                            type="button"
                            onClick={() => setAppFilter(filter.id)}
                            className={cn(
                              'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                              appFilter === filter.id
                                ? 'border-primary bg-primary/10 text-primary'
                                : 'border-border/70 text-muted-foreground hover:text-foreground'
                            )}
                          >
                            {filter.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      {filteredApplications.length === 0 ? (
                        <p className="text-sm text-muted-foreground rounded-xl border border-dashed px-4 py-6 text-center">
                          No applications match your search or filter.
                        </p>
                      ) : (
                        filteredApplications.map((app) => (
                          <ApplicationAccessRow
                            key={app.application_id}
                            app={app}
                            defaultAccess={defaultAccess}
                            value={appOverrides[app.application_id] || 'inherit'}
                            onChange={(next) => setAppOverride(app.application_id, next)}
                          />
                        ))
                      )}
                    </div>
                  </>
                )}
              </section>
            </div>
          </div>
        )}

        <DialogFooter className="shrink-0 border-t border-border/70 px-6 py-4">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={saving || isLoading || !hasChanges}
          >
            {saving ? 'Saving...' : 'Save access'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

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
  const [mcpAccessTarget, setMcpAccessTarget] = useState(null);

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

  const mcpAccessMutation = useMutation({
    mutationFn: (payload) => db.updateAdminApiTokenUserMcpAccess(payload.userId, payload.body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: API_TOKENS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-user-mcp-access'] });
      setMcpAccessTarget(null);
      toast.success('MCP access updated');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update MCP access');
    },
  });

  const saveMcpAccess = (body) => {
    if (!mcpAccessTarget?.user?.id) return;
    mcpAccessMutation.mutate({ userId: mcpAccessTarget.user.id, body });
  };

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
              MCP OAuth connections appear here automatically when a user clicks Allow on a custom connector.
              New connections default to read-only. Use Manage access to set a default or override per application.
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
            <p className="text-sm text-muted-foreground">
              No API tokens or MCP connections yet. Tokens appear here when you generate them or when a user connects a custom MCP client.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Label</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>MCP access</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Last used</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.label}</TableCell>
                      <TableCell>
                        <Badge variant={item.source === 'oauth' ? 'default' : 'outline'} className="text-xs">
                          {item.source === 'oauth' ? 'OAuth' : 'Manual'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{item.user?.name}</div>
                        <div className="text-xs text-muted-foreground">{item.user?.email}</div>
                      </TableCell>
                      <TableCell>
                        {mcpAccessBadge(item.user?.mcp_access || 'none', {
                          hasOverrides: Boolean(item.user?.has_application_overrides),
                        })}
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
                      <TableCell className="text-right">
                        <div className="flex justify-end items-center gap-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8"
                            disabled={mcpAccessMutation.isPending}
                            onClick={() => setMcpAccessTarget(item)}
                          >
                            <Shield className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                            Manage access
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setRevokeTarget(item)}
                            aria-label={`Revoke ${item.label}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
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
                Create a named token for API access. MCP tools available depend on the selected user&apos;s MCP access level.
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

      {mcpAccessTarget ? (
        <McpAccessDialog
          target={mcpAccessTarget}
          saving={mcpAccessMutation.isPending}
          onClose={() => setMcpAccessTarget(null)}
          onSave={saveMcpAccess}
        />
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
