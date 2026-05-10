import db from '@/api/base44Client';
import React, { useState } from 'react';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Shield, Search, CheckCircle, Clock, XCircle, AlertTriangle, Info, AlertOctagon, BookOpen, ChevronDown, ChevronUp, Terminal, Copy, Check } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';

function CodeBlock({ code, language = 'json' }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="relative group rounded-lg bg-muted/80 border border-border overflow-hidden text-xs font-mono">
      <div className="flex items-center justify-between px-3 py-1.5 bg-muted border-b border-border">
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{language}</span>
        <button onClick={copy} className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors">
          {copied ? <Check className="w-3 h-3 text-success" /> : <Copy className="w-3 h-3" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="p-3 overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">{code}</pre>
    </div>
  );
}

function IntegrationGuide() {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-primary" />
          <span className="font-medium text-sm">Integration Guide — Push events from your system</span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-6 space-y-6 border-t border-border">
              {/* Auth */}
              <div className="space-y-2 pt-5">
                <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">1 — Authentication</h3>
                <p className="text-sm text-muted-foreground">Include your API token in every request:</p>
                <CodeBlock language="http" code={`Authorization: Bearer <your-api-token>\nX-Auth-Token: <your-api-token>`} />
              </div>

              {/* Create event */}
              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">2 — Push an Event</h3>
                <p className="text-sm text-muted-foreground"><code className="bg-muted px-1 rounded text-xs">POST /api/system-events</code></p>
                <CodeBlock language="json" code={`{
  "system_id": "your-connected-system-id",
  "event_type": "info",
  "title": "Deployment completed",
  "severity": 3,
  "status": "pending",
  "payload": {
    "version": "1.4.2",
    "environment": "production"
  }
}`} />
              </div>

              {/* Field table */}
              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">3 — Field Reference</h3>
                <div className="overflow-x-auto rounded-lg border border-border text-xs">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-muted/50 border-b border-border">
                        <th className="text-left p-2 font-medium text-muted-foreground">Field</th>
                        <th className="text-left p-2 font-medium text-muted-foreground">Required</th>
                        <th className="text-left p-2 font-medium text-muted-foreground">Values</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ['system_id', 'Yes', 'string — connected system ID'],
                        ['title', 'Yes', 'string — short summary'],
                        ['event_type', 'No', 'info · warning · error · critical · health_check · webhook'],
                        ['status', 'No', 'pending · processed · failed · acknowledged'],
                        ['severity', 'No', 'integer 1–10'],
                        ['payload', 'No', 'any JSON object'],
                      ].map(([f, r, v]) => (
                        <tr key={f} className="border-b border-border last:border-0">
                          <td className="p-2 font-mono text-primary">{f}</td>
                          <td className="p-2 text-muted-foreground">{r}</td>
                          <td className="p-2 text-muted-foreground">{v}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* curl example */}
              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">4 — cURL Example</h3>
                <CodeBlock language="bash" code={`curl -X POST https://your-nexus-url/api/system-events \\
  -H "Authorization: Bearer $NEXUS_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "system_id": "billing-service",
    "event_type": "health_check",
    "title": "All systems operational",
    "severity": 1,
    "status": "processed"
  }'`} />
              </div>

              {/* Severity guide */}
              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">5 — Severity Guide</h3>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Low (1–3)', color: 'bg-success', desc: 'Info / health checks' },
                    { label: 'Medium (4–6)', color: 'bg-warning', desc: 'Warnings / degraded' },
                    { label: 'High (7–10)', color: 'bg-destructive', desc: 'Errors / outages' },
                  ].map(s => (
                    <div key={s.label} className="rounded-lg bg-muted/40 p-3 space-y-1">
                      <div className={cn('w-6 h-1.5 rounded-full', s.color)} />
                      <p className="font-medium text-xs">{s.label}</p>
                      <p className="text-[11px] text-muted-foreground">{s.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

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

      <IntegrationGuide />

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