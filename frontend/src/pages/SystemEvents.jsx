import db from '@/api/base44Client';
import React, { useState } from 'react';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Shield, Search, CheckCircle, Clock, XCircle, AlertTriangle, Info, AlertOctagon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { format } from 'date-fns';

const statusConfig = {
  pending: { icon: Clock, color: 'text-warning', bg: 'bg-warning/10' },
  processed: { icon: CheckCircle, color: 'text-success', bg: 'bg-success/10' },
  failed: { icon: XCircle, color: 'text-destructive', bg: 'bg-destructive/10' },
  acknowledged: { icon: Info, color: 'text-info', bg: 'bg-info/10' },
};

const typeConfig = {
  info: { icon: Info, color: 'text-info' },
  warning: { icon: AlertTriangle, color: 'text-warning' },
  error: { icon: XCircle, color: 'text-destructive' },
  critical: { icon: AlertOctagon, color: 'text-critical' },
  health_check: { icon: CheckCircle, color: 'text-success' },
  webhook: { icon: Shield, color: 'text-primary' },
};

export default function SystemEvents() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const queryClient = useQueryClient();

  const { data: events = [], isLoading } = useQuery({
    queryKey: ['system-events'],
    queryFn: () => db.entities.SystemEvent.list('-created_date', 200),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => db.entities.SystemEvent.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['system-events'] }),
  });

  const filtered = events.filter(e => {
    if (statusFilter !== 'all' && e.status !== statusFilter) return false;
    if (typeFilter !== 'all' && e.event_type !== typeFilter) return false;
    if (search && !e.title?.toLowerCase().includes(search.toLowerCase()) && !e.system_id?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Shield className="w-6 h-6 text-primary" /> System Events
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Monitor cross-system events and webhooks</p>
      </motion.div>

      <div className="bg-card rounded-2xl border border-border p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search events..." className="pl-9 h-9 bg-muted/50 border-0" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-32 h-9 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="processed">Processed</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="acknowledged">Acknowledged</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-32 h-9 text-xs"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="info">Info</SelectItem>
            <SelectItem value="warning">Warning</SelectItem>
            <SelectItem value="error">Error</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="health_check">Health Check</SelectItem>
            <SelectItem value="webhook">Webhook</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-muted border-t-primary rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground bg-card rounded-2xl border">
          <Shield className="w-12 h-12 mb-4 opacity-20" />
          <p className="font-medium">No events found</p>
        </div>
      ) : (
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground">Event</th>
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground">System</th>
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground">Type</th>
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground">Status</th>
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground">Severity</th>
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground">Time</th>
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((event, i) => {
                  const sc = statusConfig[event.status] || statusConfig.pending;
                  const tc = typeConfig[event.event_type] || typeConfig.info;
                  const StatusIcon = sc.icon;
                  const TypeIcon = tc.icon;
                  return (
                    <tr key={event.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="p-3">
                        <p className="font-medium text-sm">{event.title}</p>
                      </td>
                      <td className="p-3">
                        <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded">{event.system_id}</span>
                      </td>
                      <td className="p-3">
                        <span className={cn("flex items-center gap-1 text-xs", tc.color)}>
                          <TypeIcon className="w-3 h-3" /> {event.event_type}
                        </span>
                      </td>
                      <td className="p-3">
                        <Badge className={cn("text-[10px] border-0", sc.bg, sc.color)}>
                          <StatusIcon className="w-2.5 h-2.5 mr-1" /> {event.status}
                        </Badge>
                      </td>
                      <td className="p-3">
                        {event.severity && (
                          <div className="flex items-center gap-1">
                            <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div
                                className={cn("h-full rounded-full",
                                  event.severity <= 3 ? 'bg-success' : event.severity <= 6 ? 'bg-warning' : 'bg-destructive'
                                )}
                                style={{ width: `${event.severity * 10}%` }}
                              />
                            </div>
                            <span className="text-[10px] text-muted-foreground">{event.severity}/10</span>
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-xs text-muted-foreground">
                        {format(new Date(event.created_date), 'MMM d, h:mm a')}
                      </td>
                      <td className="p-3">
                        {event.status === 'pending' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => updateMut.mutate({ id: event.id, data: { status: 'acknowledged' } })}
                          >
                            Acknowledge
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}