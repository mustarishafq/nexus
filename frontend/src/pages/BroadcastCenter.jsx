import db from '@/api/base44Client';
import React, { useState } from 'react';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Megaphone, Send, AlertTriangle, Info, CheckCircle, AlertOctagon, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

const typeIcons = { info: Info, success: CheckCircle, warning: AlertTriangle, error: AlertOctagon, critical: AlertOctagon };
const typeBg = { info: 'bg-info/10 text-info', success: 'bg-success/10 text-success', warning: 'bg-warning/10 text-warning', error: 'bg-destructive/10 text-destructive', critical: 'bg-critical/10 text-critical' };
const typeRowBg = { info: 'bg-info/5 border-info/20', success: 'bg-success/5 border-success/20', warning: 'bg-warning/5 border-warning/20', error: 'bg-destructive/5 border-destructive/20', critical: 'bg-critical/5 border-critical/20' };

export default function BroadcastCenter() {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [type, setType] = useState('info');
  const [priority, setPriority] = useState('medium');
  const [category, setCategory] = useState('announcement');
  const [broadcastStartsAt, setBroadcastStartsAt] = useState('');
  const [broadcastEndsAt, setBroadcastEndsAt] = useState('');
  const queryClient = useQueryClient();

  const { data: broadcasts = [] } = useQuery({
    queryKey: ['broadcasts'],
    queryFn: () => db.entities.Broadcast.list('-created_date', 50),
  });

  const sendMut = useMutation({
    mutationFn: (data) => db.entities.Broadcast.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['broadcasts'] });
      queryClient.invalidateQueries({ queryKey: ['active-broadcasts-dash'] });
      setTitle('');
      setMessage('');
      setBroadcastStartsAt('');
      setBroadcastEndsAt('');
      toast.success('Broadcast sent successfully');
    },
  });

  const handleSend = () => {
    if (!title.trim()) return;

    if (broadcastStartsAt && broadcastEndsAt && new Date(broadcastEndsAt) <= new Date(broadcastStartsAt)) {
      toast.error('Broadcast end time must be after the start time');
      return;
    }

    sendMut.mutate({
      title,
      message,
      priority,
      broadcast_starts_at: broadcastStartsAt ? new Date(broadcastStartsAt).toISOString() : null,
      broadcast_ends_at: broadcastEndsAt ? new Date(broadcastEndsAt).toISOString() : null,
    });
  };

  const getBroadcastStatus = (broadcast) => {
    const now = Date.now();
    const start = broadcast.broadcast_starts_at ? new Date(broadcast.broadcast_starts_at).getTime() : null;
    const end = broadcast.broadcast_ends_at ? new Date(broadcast.broadcast_ends_at).getTime() : null;

    if (start && start > now) return 'scheduled';
    if (end && end < now) return 'expired';
    return 'active';
  };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Megaphone className="w-6 h-6 text-primary" /> Broadcast Center
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Send announcements and alerts to all users</p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Compose */}
        <Card className="lg:col-span-2 rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base">Compose Broadcast</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Scheduled maintenance tonight..." />
            </div>
            <div className="space-y-2">
              <Label>Message</Label>
              <Textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Provide details..." rows={4} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label className="text-xs">Type</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="info">Info</SelectItem>
                    <SelectItem value="success">Success</SelectItem>
                    <SelectItem value="warning">Warning</SelectItem>
                    <SelectItem value="error">Error</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Priority</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="announcement">Announcement</SelectItem>
                    <SelectItem value="system">System</SelectItem>
                    <SelectItem value="security">Security</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs">Show From (optional)</Label>
                <Input
                  type="datetime-local"
                  value={broadcastStartsAt}
                  onChange={(e) => setBroadcastStartsAt(e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Show Until (optional)</Label>
                <Input
                  type="datetime-local"
                  value={broadcastEndsAt}
                  onChange={(e) => setBroadcastEndsAt(e.target.value)}
                  className="h-9"
                />
              </div>
            </div>
            <Button onClick={handleSend} disabled={!title.trim() || sendMut.isPending} className="w-full gap-2">
              <Send className="w-4 h-4" /> {sendMut.isPending ? 'Sending...' : 'Send Broadcast'}
            </Button>
          </CardContent>
        </Card>

        {/* Recent Broadcasts */}
        <Card className="lg:col-span-3 rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base">Recent Broadcasts</CardTitle>
          </CardHeader>
          <CardContent>
            {broadcasts.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-muted-foreground">
                <Megaphone className="w-10 h-10 mb-3 opacity-20" />
                <p className="text-sm">No broadcasts sent yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {broadcasts.slice(0, 4).map(b => {
                  const Icon = typeIcons[b.type] || Info;
                  const status = getBroadcastStatus(b);
                  return (
                    <div key={b.id} className={cn("flex items-start gap-3 p-3 rounded-xl border transition-colors hover:opacity-90", typeRowBg[b.type] || 'bg-muted/30 border-border')}>
                      <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", typeBg[b.type])}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold">{b.title}</p>
                          <Badge variant="outline" className="text-[10px]">{b.priority}</Badge>
                          <Badge variant="secondary" className="text-[10px] capitalize">{status}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{b.message}</p>
                        <p className="text-[10px] text-muted-foreground mt-1.5">
                          {formatDistanceToNow(new Date(b.created_date), { addSuffix: true })}
                          {b.broadcast_starts_at ? ` • from ${new Date(b.broadcast_starts_at).toLocaleString()}` : ''}
                          {b.broadcast_ends_at ? ` • until ${new Date(b.broadcast_ends_at).toLocaleString()}` : ''}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}