import db from '@/api/apiClient';
import React, { useState } from 'react';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Megaphone, Send, AlertTriangle, Info, AlertOctagon, Pencil, Trash2, Check, X, Users, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import UserAvatar from '@/components/users/UserAvatar';
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
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { ACTIVE_BROADCASTS_QUERY_KEY } from '@/hooks/useActiveBroadcasts';

const priorityIcons = {
  low: Info,
  medium: Megaphone,
  high: AlertTriangle,
  critical: AlertOctagon,
};

const priorityBg = {
  low: 'bg-muted text-muted-foreground',
  medium: 'bg-info/10 text-info',
  high: 'bg-warning/10 text-warning',
  critical: 'bg-critical/10 text-critical',
};

const priorityRowBg = {
  low: 'bg-muted/30 border-border',
  medium: 'bg-info/5 border-info/20',
  high: 'bg-warning/5 border-warning/20',
  critical: 'bg-critical/5 border-critical/20',
};

function toDatetimeLocalValue(iso) {
  if (!iso) return '';

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function getBroadcastStatus(broadcast) {
  const now = Date.now();
  const start = broadcast.broadcast_starts_at ? new Date(broadcast.broadcast_starts_at).getTime() : null;
  const end = broadcast.broadcast_ends_at ? new Date(broadcast.broadcast_ends_at).getTime() : null;

  if (start && start > now) return 'scheduled';
  if (end && end < now) return 'expired';
  return 'active';
}

function DepartmentMultiSelect({ departments, selectedIds, onToggle }) {
  if (departments.length === 0) {
    return <p className="text-sm text-muted-foreground">No departments available yet.</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-2 max-h-48 overflow-auto pr-1">
      {departments.map((department) => {
        const checked = selectedIds.has(String(department.id));
        return (
          <button
            key={department.id}
            type="button"
            onClick={() => onToggle(String(department.id))}
            className={cn(
              'flex items-center gap-3 rounded-xl border px-3 py-2 text-left text-sm transition-all',
              checked
                ? 'border-primary/30 bg-primary/10 text-primary'
                : 'border-border bg-muted/40 text-muted-foreground'
            )}
          >
            <Building2 className="w-4 h-4 shrink-0" />
            <p className="font-medium truncate flex-1">{department.name}</p>
            {checked ? <Check className="w-4 h-4 shrink-0" /> : <X className="w-4 h-4 shrink-0" />}
          </button>
        );
      })}
    </div>
  );
}

function SearchableUserMultiSelect({ users, selectedIds, onToggle, placeholder = 'Search user by name or email...' }) {
  const selectedUsers = users.filter((user) => selectedIds.has(String(user.id)));

  return (
    <div className="space-y-3">
      {selectedUsers.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {selectedUsers.map((user) => (
            <div
              key={user.id}
              className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-primary"
            >
              <UserAvatar user={user} className="h-8 w-8" fallbackClassName="bg-primary/15 text-xs" />
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">{user.full_name || user.email}</p>
                <p className="text-xs opacity-70 truncate">{user.email}</p>
              </div>
              <button
                type="button"
                onClick={() => onToggle(String(user.id))}
                className="shrink-0 rounded-md p-0.5 hover:bg-primary/15"
                title="Remove user"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <Command className="rounded-xl border border-border">
        <CommandInput placeholder={placeholder} />
        <CommandList className="max-h-52">
          <CommandEmpty>No user found.</CommandEmpty>
          {users.map((user) => {
            const checked = selectedIds.has(String(user.id));
            return (
              <CommandItem
                key={user.id}
                value={`${user.full_name || ''} ${user.email || ''}`}
                onSelect={() => onToggle(String(user.id))}
                className="gap-3"
              >
                <UserAvatar user={user} className="h-8 w-8" fallbackClassName="bg-muted text-xs text-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{user.full_name || user.email}</p>
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                </div>
                <Check className={cn('w-4 h-4 shrink-0', checked ? 'opacity-100 text-primary' : 'opacity-0')} />
              </CommandItem>
            );
          })}
        </CommandList>
      </Command>
    </div>
  );
}

function getAudienceLabel(broadcast, users = [], departments = []) {
  const audienceType = broadcast.audience_type || 'all';

  if (audienceType === 'all') {
    return 'All users';
  }

  if (audienceType === 'department') {
    const names = (broadcast.department_ids || [])
      .map((id) => departments.find((item) => String(item.id) === String(id))?.name)
      .filter(Boolean);
    return names.length ? `Departments: ${names.join(', ')}` : 'Departments';
  }

  const count = (broadcast.user_ids || []).length;
  if (count === 0) return 'Selected users';

  const names = (broadcast.user_ids || [])
    .slice(0, 2)
    .map((id) => users.find((item) => String(item.id) === String(id)))
    .filter(Boolean)
    .map((item) => item.full_name || item.email);

  if (count <= 2) {
    return names.length ? names.join(', ') : `${count} users`;
  }

  return `${names.join(', ')} +${count - 2} more`;
}

export default function BroadcastCenter() {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState('medium');
  const [broadcastStartsAt, setBroadcastStartsAt] = useState('');
  const [broadcastEndsAt, setBroadcastEndsAt] = useState('');
  const [audienceType, setAudienceType] = useState('all');
  const [selectedUserIds, setSelectedUserIds] = useState(new Set());
  const [selectedDepartmentIds, setSelectedDepartmentIds] = useState(new Set());
  const [editingId, setEditingId] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const queryClient = useQueryClient();

  const { data: broadcasts = [] } = useQuery({
    queryKey: ['broadcasts'],
    queryFn: () => db.entities.Broadcast.list('-created_date', 50),
  });

  const { data: users = [] } = useQuery({
    queryKey: ['broadcast-users'],
    queryFn: () => db.entities.User.list('-created_date', 500),
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => db.listDepartments(),
  });

  const invalidateBroadcasts = () => {
    queryClient.invalidateQueries({ queryKey: ['broadcasts'] });
    queryClient.invalidateQueries({ queryKey: ACTIVE_BROADCASTS_QUERY_KEY });
  };

  const resetForm = () => {
    setTitle('');
    setMessage('');
    setPriority('medium');
    setBroadcastStartsAt('');
    setBroadcastEndsAt('');
    setAudienceType('all');
    setSelectedUserIds(new Set());
    setSelectedDepartmentIds(new Set());
    setEditingId(null);
  };

  const startEdit = (broadcast) => {
    setEditingId(broadcast.id);
    setTitle(broadcast.title || '');
    setMessage(broadcast.message || '');
    setPriority(broadcast.priority || 'medium');
    setBroadcastStartsAt(toDatetimeLocalValue(broadcast.broadcast_starts_at));
    setBroadcastEndsAt(toDatetimeLocalValue(broadcast.broadcast_ends_at));
    setAudienceType(broadcast.audience_type || 'all');
    setSelectedUserIds(new Set((broadcast.user_ids || []).map(String)));
    setSelectedDepartmentIds(new Set((broadcast.department_ids || []).map(String)));
  };

  const toggleUser = (userId) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const toggleDepartment = (departmentId) => {
    setSelectedDepartmentIds((prev) => {
      const next = new Set(prev);
      if (next.has(departmentId)) next.delete(departmentId);
      else next.add(departmentId);
      return next;
    });
  };

  const buildPayload = () => {
    const payload = {
      title: title.trim(),
      message,
      priority,
      audience_type: audienceType,
      broadcast_starts_at: broadcastStartsAt ? new Date(broadcastStartsAt).toISOString() : null,
      broadcast_ends_at: broadcastEndsAt ? new Date(broadcastEndsAt).toISOString() : null,
    };

    if (audienceType === 'individual') {
      payload.user_ids = Array.from(selectedUserIds).map(Number);
    }

    if (audienceType === 'department') {
      payload.department_ids = Array.from(selectedDepartmentIds).map(Number);
    }

    return payload;
  };

  const sendMut = useMutation({
    mutationFn: (data) => db.entities.Broadcast.create(data),
    onSuccess: () => {
      invalidateBroadcasts();
      resetForm();
      toast.success('Broadcast sent successfully');
    },
    onError: (error) => {
      toast.error(error?.data?.message || error?.message || 'Failed to send broadcast');
    },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => db.entities.Broadcast.update(id, data),
    onSuccess: () => {
      invalidateBroadcasts();
      resetForm();
      toast.success('Broadcast updated');
    },
    onError: (error) => {
      toast.error(error?.data?.message || error?.message || 'Failed to update broadcast');
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id) => db.entities.Broadcast.delete(id),
    onSuccess: () => {
      invalidateBroadcasts();
      if (editingId === pendingDelete?.id) {
        resetForm();
      }
      setPendingDelete(null);
      toast.success('Broadcast deleted');
    },
    onError: (error) => {
      toast.error(error?.data?.message || error?.message || 'Failed to delete broadcast');
    },
  });

  const handleSubmit = () => {
    if (!title.trim()) return;

    if (broadcastStartsAt && broadcastEndsAt && new Date(broadcastEndsAt) <= new Date(broadcastStartsAt)) {
      toast.error('Broadcast end time must be after the start time');
      return;
    }

    if (audienceType === 'individual' && selectedUserIds.size === 0) {
      toast.error('Select at least one user');
      return;
    }

    if (audienceType === 'department' && selectedDepartmentIds.size === 0) {
      toast.error('Select at least one department');
      return;
    }

    const payload = buildPayload();

    if (editingId) {
      updateMut.mutate({ id: editingId, data: payload });
      return;
    }

    sendMut.mutate(payload);
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    deleteMut.mutate(pendingDelete.id);
  };

  const isSaving = sendMut.isPending || updateMut.isPending;

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Megaphone className="w-6 h-6 text-primary" /> Broadcast Center
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Send targeted announcements to all users, departments, or individuals</p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <Card className="lg:col-span-2 rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base">
              {editingId ? 'Edit Broadcast' : 'Compose Broadcast'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Scheduled maintenance tonight..."
              />
            </div>
            <div className="space-y-2">
              <Label>Message</Label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Provide details..."
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Audience</Label>
              <Select value={audienceType} onValueChange={setAudienceType}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All users</SelectItem>
                  <SelectItem value="department">Departments</SelectItem>
                  <SelectItem value="individual">Individual users</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {audienceType === 'department' ? (
              <div className="space-y-2">
                <Label className="text-xs">Select Departments</Label>
                <DepartmentMultiSelect
                  departments={departments}
                  selectedIds={selectedDepartmentIds}
                  onToggle={toggleDepartment}
                />
                <p className="text-xs text-muted-foreground">
                  Only users in the selected departments will see this broadcast.
                </p>
              </div>
            ) : null}
            {audienceType === 'individual' ? (
              <div className="space-y-2">
                <Label className="text-xs">Select Users</Label>
                <SearchableUserMultiSelect
                  users={users}
                  selectedIds={selectedUserIds}
                  onToggle={toggleUser}
                />
                <p className="text-xs text-muted-foreground">
                  Only the selected users will see this broadcast.
                </p>
              </div>
            ) : null}
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
            <div className="flex gap-2">
              <Button
                onClick={handleSubmit}
                disabled={!title.trim() || isSaving}
                className="flex-1 gap-2"
              >
                <Send className="w-4 h-4" />
                {isSaving
                  ? editingId
                    ? 'Saving...'
                    : 'Sending...'
                  : editingId
                    ? 'Save Changes'
                    : 'Send Broadcast'}
              </Button>
              {editingId ? (
                <Button type="button" variant="outline" onClick={resetForm} disabled={isSaving}>
                  Cancel
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>

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
              <div className="space-y-3 max-h-[32rem] overflow-y-auto pr-1">
                {broadcasts.map((broadcast) => {
                  const broadcastPriority = broadcast.priority || 'medium';
                  const Icon = priorityIcons[broadcastPriority] || Info;
                  const status = getBroadcastStatus(broadcast);
                  const isEditing = editingId === broadcast.id;

                  return (
                    <div
                      key={broadcast.id}
                      className={cn(
                        'flex items-start gap-3 p-3 rounded-xl border transition-colors',
                        isEditing
                          ? 'border-primary/40 bg-primary/[0.03]'
                          : priorityRowBg[broadcastPriority] || priorityRowBg.medium
                      )}
                    >
                      <div
                        className={cn(
                          'w-9 h-9 rounded-lg flex items-center justify-center shrink-0',
                          priorityBg[broadcastPriority] || priorityBg.medium
                        )}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2 min-w-0">
                            <p className="text-sm font-semibold">{broadcast.title}</p>
                            <Badge variant="outline" className="text-[10px] capitalize">
                              {broadcastPriority}
                            </Badge>
                            <Badge variant="secondary" className="text-[10px] capitalize">
                              {status}
                            </Badge>
                            <Badge variant="outline" className="text-[10px] gap-1">
                              {(broadcast.audience_type || 'all') === 'all' ? (
                                <Users className="w-3 h-3" />
                              ) : (
                                <Building2 className="w-3 h-3" />
                              )}
                              {getAudienceLabel(broadcast, users, departments)}
                            </Badge>
                            {isEditing ? (
                              <Badge className="text-[10px]">Editing</Badge>
                            ) : null}
                          </div>
                          <div className="flex shrink-0 items-center gap-0.5 rounded-lg border border-border/60 bg-background/70 p-0.5 shadow-sm">
                            <Button
                              variant="ghost"
                              size="icon"
                              className={cn(
                                'h-7 w-7 focus-visible:ring-0 focus-visible:ring-offset-0',
                                isEditing
                                  ? 'bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary'
                                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                              )}
                              title="Edit broadcast"
                              aria-pressed={isEditing}
                              onClick={() => startEdit(broadcast)}
                              disabled={isSaving || deleteMut.isPending}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                              <span className="sr-only">Edit</span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:bg-destructive/10 hover:text-destructive focus-visible:ring-0 focus-visible:ring-offset-0"
                              title="Delete broadcast"
                              onClick={() => setPendingDelete(broadcast)}
                              disabled={isSaving || deleteMut.isPending}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span className="sr-only">Delete</span>
                            </Button>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {broadcast.message || 'No message'}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-1.5">
                          {formatDistanceToNow(new Date(broadcast.created_date), { addSuffix: true })}
                          {broadcast.broadcast_starts_at
                            ? ` • from ${new Date(broadcast.broadcast_starts_at).toLocaleString()}`
                            : ''}
                          {broadcast.broadcast_ends_at
                            ? ` • until ${new Date(broadcast.broadcast_ends_at).toLocaleString()}`
                            : ''}
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

      <AlertDialog open={Boolean(pendingDelete)} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this broadcast?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete
                ? `"${pendingDelete.title}" will be permanently removed from the ticker and announcements.`
                : 'This broadcast will be permanently removed.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMut.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={deleteMut.isPending}>
              {deleteMut.isPending ? 'Deleting...' : 'Delete Broadcast'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
