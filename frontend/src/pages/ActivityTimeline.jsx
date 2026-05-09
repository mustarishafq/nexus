import db from '@/api/base44Client';
import React, { useState } from 'react';

import { useQuery } from '@tanstack/react-query';
import { Activity, Search, LogIn, LogOut, Plus, Pencil, Trash2, CheckCircle, XCircle, Eye, Download, Upload, Filter } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatDistanceToNow, format } from 'date-fns';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

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

export default function ActivityTimeline() {
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [systemFilter, setSystemFilter] = useState('all');

  const { data: activities = [], isLoading } = useQuery({
    queryKey: ['activities-full'],
    queryFn: () => db.entities.ActivityLog.list('-created_date', 200),
  });

  const { data: systems = [] } = useQuery({
    queryKey: ['systems-list'],
    queryFn: () => db.entities.ConnectedSystem.list(),
  });

  const filtered = activities.filter(a => {
    if (actionFilter !== 'all' && a.action !== actionFilter) return false;
    if (systemFilter !== 'all' && a.system_id !== systemFilter) return false;
    if (search && !a.description?.toLowerCase().includes(search.toLowerCase()) && !a.user_name?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // Group by date
  const grouped = {};
  filtered.forEach(a => {
    const date = format(new Date(a.created_date), 'EEEE, MMM d, yyyy');
    if (!grouped[date]) grouped[date] = [];
    grouped[date].push(a);
  });

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Activity className="w-6 h-6 text-primary" /> Activity Timeline
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Cross-system activity feed</p>
      </motion.div>

      {/* Filters */}
      <div className="bg-card rounded-2xl border border-border p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search activity..." className="pl-9 h-9 bg-muted/50 border-0" />
        </div>
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-32 h-9 text-xs">
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
          </SelectContent>
        </Select>
        <Select value={systemFilter} onValueChange={setSystemFilter}>
          <SelectTrigger className="w-36 h-9 text-xs">
            <SelectValue placeholder="System" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Systems</SelectItem>
            {systems.map(s => (
              <SelectItem key={s.id} value={s.slug}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Timeline */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-muted border-t-primary rounded-full animate-spin" />
        </div>
      ) : Object.keys(grouped).length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Activity className="w-12 h-12 mb-4 opacity-20" />
          <p className="font-medium">No activity found</p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([date, logs]) => (
            <div key={date}>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">{date}</h3>
              <div className="relative">
                <div className="absolute left-[19px] top-4 bottom-4 w-px bg-border" />
                <div className="space-y-1">
                  {logs.map((log, i) => {
                    const Icon = actionIcons[log.action] || Activity;
                    const colors = actionColors[log.action] || actionColors.other;
                    return (
                      <motion.div
                        key={log.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.02 }}
                        className="flex items-start gap-4 p-3 rounded-xl hover:bg-card transition-colors relative"
                      >
                        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0 z-10 border", colors)}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0 pt-0.5">
                          <p className="text-sm">
                            <span className="font-semibold">{log.user_name || log.user_id || 'System'}</span>
                            {' '}<span className="text-muted-foreground">{log.description}</span>
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            {log.system_id && (
                              <span className="text-[10px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-md">
                                {log.system_id}
                              </span>
                            )}
                            {log.ip_address && (
                              <span className="text-[10px] text-muted-foreground">IP: {log.ip_address}</span>
                            )}
                            <span className="text-[10px] text-muted-foreground ml-auto">
                              {format(new Date(log.created_date), 'h:mm a')}
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}