import db from '@/api/base44Client';
import React, { useMemo, useState } from 'react';

import { useQuery } from '@tanstack/react-query';
import {
  Activity, Search, LogIn, LogOut, Plus, Pencil, Trash2,
  CheckCircle, XCircle, Eye, Download, Upload, X, Globe,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatDistanceToNow, format, isToday, isYesterday } from 'date-fns';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import UserAvatar from '@/components/users/UserAvatar';

const actionIcons = {
  login: LogIn, logout: LogOut, create: Plus, update: Pencil,
  delete: Trash2, approve: CheckCircle, reject: XCircle,
  view: Eye, export: Download, import: Upload, other: Activity,
};

const actionColors = {
  login: 'text-info bg-info/10 border-info/20',
  logout: 'text-muted-foreground bg-muted border-border',
  create: 'text-success bg-success/10 border-success/20',
  update: 'text-primary bg-primary/10 border-primary/20',
  delete: 'text-destructive bg-destructive/10 border-destructive/20',
  approve: 'text-success bg-success/10 border-success/20',
  reject: 'text-destructive bg-destructive/10 border-destructive/20',
  view: 'text-info bg-info/10 border-info/20',
  export: 'text-warning bg-warning/10 border-warning/20',
  import: 'text-warning bg-warning/10 border-warning/20',
  other: 'text-muted-foreground bg-muted border-border',
};

const actionLabels = {
  login: 'Login', logout: 'Logout', create: 'Create', update: 'Update',
  delete: 'Delete', approve: 'Approve', reject: 'Reject', view: 'View',
  export: 'Export', import: 'Import', other: 'Activity',
};

function getDateGroupLabel(dateStr) {
  const date = new Date(dateStr);
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  const currentYear = new Date().getFullYear();
  return date.getFullYear() === currentYear
    ? format(date, 'EEEE, MMM d')
    : format(date, 'EEEE, MMM d, yyyy');
}

function ActivityLogItem({ log, isAdmin, systemName }) {
  const Icon = actionIcons[log.action] || Activity;
  const colors = actionColors[log.action] || actionColors.other;
  const actionLabel = actionLabels[log.action] || actionLabels.other;
  const createdAt = new Date(log.created_date);

  return (
    <div className="group flex gap-3 p-3.5 rounded-xl transition-colors hover:bg-muted/40">
      <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border', colors)}>
        <Icon className="w-4 h-4" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {isAdmin && (log.user_name || log.user_id) ? (
              <div className="flex items-center gap-2 mb-1">
                <UserAvatar
                  user={{
                    full_name: log.user_name,
                    email: log.user_id,
                    profile_picture: log.profile_picture,
                  }}
                  className="h-5 w-5"
                  fallbackClassName="text-[9px]"
                />
                <span className="text-sm font-medium truncate">
                  {log.user_name || log.user_id}
                </span>
                <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded border capitalize', colors)}>
                  {actionLabel}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 mb-1">
                <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded border capitalize', colors)}>
                  {actionLabel}
                </span>
              </div>
            )}
            <p className="text-sm text-foreground/90 leading-snug">{log.description}</p>
          </div>

          <time
            className="text-[11px] text-muted-foreground whitespace-nowrap shrink-0 pt-0.5"
            title={format(createdAt, 'MMM d, yyyy · h:mm a')}
          >
            {format(createdAt, 'h:mm a')}
          </time>
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-2">
          {log.system_id && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
              <Globe className="w-2.5 h-2.5" />
              {systemName || log.system_id}
            </span>
          )}
          {isAdmin && log.ip_address && (
            <span className="text-[10px] text-muted-foreground font-mono">
              {log.ip_address}
            </span>
          )}
          <span className="text-[10px] text-muted-foreground ml-auto">
            {formatDistanceToNow(createdAt, { addSuffix: true })}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function ActivityTimeline() {
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [systemFilter, setSystemFilter] = useState('all');

  const { data: user } = useQuery({
    queryKey: ['current-user'],
    queryFn: () => db.auth.me(),
    staleTime: 0,
    refetchOnMount: 'always',
    retry: false,
  });

  const isAdmin = user?.role === 'admin';

  const { data: activities = [], isLoading } = useQuery({
    queryKey: ['activities-full'],
    queryFn: () => db.entities.ActivityLog.list('-created_date', 100),
  });

  const { data: systems = [] } = useQuery({
    queryKey: ['systems-list'],
    queryFn: () => db.entities.Application.list(),
  });

  const systemNames = useMemo(
    () => Object.fromEntries(systems.map(s => [s.slug, s.name])),
    [systems],
  );

  const hasActiveFilters = search !== '' || actionFilter !== 'all' || systemFilter !== 'all';

  const filtered = useMemo(() => activities.filter(a => {
    if (actionFilter !== 'all' && a.action !== actionFilter) return false;
    if (systemFilter !== 'all' && a.system_id !== systemFilter) return false;
    if (search) {
      const term = search.toLowerCase();
      const matchesDescription = a.description?.toLowerCase().includes(term);
      const matchesUser = isAdmin && a.user_name?.toLowerCase().includes(term);
      const matchesSystem = systemNames[a.system_id]?.toLowerCase().includes(term);
      if (!matchesDescription && !matchesUser && !matchesSystem) return false;
    }
    return true;
  }), [activities, actionFilter, systemFilter, search, isAdmin, systemNames]);

  const grouped = useMemo(() => {
    const groups = {};
    filtered.forEach((log) => {
      const label = getDateGroupLabel(log.created_date);
      if (!groups[label]) groups[label] = [];
      groups[label].push(log);
    });
    return groups;
  }, [filtered]);

  const clearFilters = () => {
    setSearch('');
    setActionFilter('all');
    setSystemFilter('all');
  };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Activity className="w-6 h-6 text-primary" /> Activity Timeline
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {isLoading
            ? 'Loading activity...'
            : hasActiveFilters
              ? `${filtered.length} of ${activities.length} events`
              : isAdmin
                ? `${activities.length} events across all users and systems`
                : `${activities.length} events across your connected systems`}
        </p>
      </motion.div>

      <div className="bg-card rounded-2xl border border-border p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={isAdmin ? 'Search by description, user, or system...' : 'Search activity...'}
              className="pl-9 h-9 bg-muted/50 border-0"
            />
          </div>
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-[140px] h-9 text-xs">
              <SelectValue placeholder="Action" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Actions</SelectItem>
              <SelectItem value="login">Login</SelectItem>
              <SelectItem value="logout">Logout</SelectItem>
              <SelectItem value="create">Create</SelectItem>
              <SelectItem value="update">Update</SelectItem>
              <SelectItem value="delete">Delete</SelectItem>
              <SelectItem value="approve">Approve</SelectItem>
              <SelectItem value="reject">Reject</SelectItem>
              <SelectItem value="view">View</SelectItem>
              <SelectItem value="export">Export</SelectItem>
              <SelectItem value="import">Import</SelectItem>
            </SelectContent>
          </Select>
          <Select value={systemFilter} onValueChange={setSystemFilter}>
            <SelectTrigger className="w-[160px] h-9 text-xs">
              <SelectValue placeholder="System" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Systems</SelectItem>
              {systems.map(s => (
                <SelectItem key={s.id} value={s.slug}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 text-xs gap-1.5 text-muted-foreground">
              <X className="w-3.5 h-3.5" /> Clear
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-muted border-t-primary rounded-full animate-spin" />
        </div>
      ) : Object.keys(grouped).length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground bg-card rounded-2xl border">
          <Activity className="w-12 h-12 mb-4 opacity-20" />
          <p className="font-medium">No activity found</p>
          <p className="text-sm mt-1">
            {hasActiveFilters ? 'Try adjusting your filters' : 'Activity will appear here as events occur'}
          </p>
          {hasActiveFilters && (
            <Button variant="outline" size="sm" onClick={clearFilters} className="mt-4">
              Clear filters
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([date, logs]) => (
            <div key={date}>
              <div className="flex items-center gap-3 mb-2 px-1">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {date}
                </h3>
                <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                  {logs.length}
                </span>
              </div>
              <div className="bg-card rounded-2xl border border-border divide-y divide-border/60 overflow-hidden">
                {logs.map((log) => (
                  <ActivityLogItem
                    key={log.id}
                    log={log}
                    isAdmin={isAdmin}
                    systemName={systemNames[log.system_id]}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
