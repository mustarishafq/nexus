// @ts-nocheck
import db from '@/api/base44Client';
import React, { useEffect, useState, useRef } from 'react';

import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Check, X, Shield, UserCheck, UserX, UserPlus, Upload, Search, Filter, ChevronLeft, ChevronRight, ChevronDown, Users as UsersIcon, Download, Edit, Loader2, Plus, Trash2, Layers, BarChart3, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn, formatDateForInput } from '@/lib/utils';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

function GroupMultiSelect({ groups, selectedIds, onToggle, emptyLabel = 'No access groups yet.' }) {
  if (groups.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-2 max-h-48 overflow-auto pr-1">
      {groups.map((group) => {
        const checked = selectedIds.has(String(group.id));
        return (
          <button
            key={group.id}
            type="button"
            onClick={() => onToggle(String(group.id))}
            className={cn(
              'flex items-center gap-3 rounded-xl border px-3 py-2 text-left text-sm transition-all',
              checked
                ? 'border-primary/30 bg-primary/10 text-primary'
                : 'border-border bg-muted/40 text-muted-foreground'
            )}
          >
            <div className="min-w-0 flex-1">
              <p className="font-medium truncate">{group.name}</p>
              {group.description ? (
                <p className="text-xs opacity-70 truncate">{group.description}</p>
              ) : null}
            </div>
            {checked ? <Check className="w-4 h-4 shrink-0" /> : <X className="w-4 h-4 shrink-0" />}
          </button>
        );
      })}
    </div>
  );
}

function SearchableUserMultiSelect({ users, selectedIds, onToggle, placeholder = 'Search user by name or email...' }) {
  const selectedUsers = users.filter((user) => selectedIds.has(user.id));

  return (
    <div className="space-y-3">
      {selectedUsers.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {selectedUsers.map((user) => (
            <div
              key={user.id}
              className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-primary"
            >
              <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center text-xs font-semibold shrink-0">
                {user.full_name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">{user.full_name || user.email}</p>
                <p className="text-xs opacity-70 truncate">{user.email}</p>
              </div>
              <button
                type="button"
                onClick={() => onToggle(user.id)}
                className="shrink-0 rounded-md p-0.5 hover:bg-primary/15"
                title="Remove from group"
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
            const checked = selectedIds.has(user.id);
            return (
              <CommandItem
                key={user.id}
                value={`${user.full_name || ''} ${user.email || ''}`}
                onSelect={() => onToggle(user.id)}
                className="gap-3"
              >
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-semibold shrink-0">
                  {user.full_name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase()}
                </div>
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

export default function UserManagement() {
  const [approvingUser, setApprovingUser] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [newUserRole, setNewUserRole] = useState('user');
  const [newUserGroupIds, setNewUserGroupIds] = useState(new Set());
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [assignDialogUser, setAssignDialogUser] = useState(null);
  const [assignGroupIds, setAssignGroupIds] = useState(new Set());
  const [assignSaving, setAssignSaving] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editSaving, setEditSaving] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [editGroup, setEditGroup] = useState(null);
  const [groupForm, setGroupForm] = useState({ name: '', description: '', allowedSlugs: new Set(), userIds: new Set() });
  const [groupSaving, setGroupSaving] = useState(false);
  const [pendingDeleteGroup, setPendingDeleteGroup] = useState(null);
  const [dashboardDialogOpen, setDashboardDialogOpen] = useState(false);
  const [editDashboard, setEditDashboard] = useState(null);
  const [dashboardForm, setDashboardForm] = useState({ name: '', publicUrl: '', groupIds: new Set(), isEnabled: true, sortOrder: 0 });
  const [dashboardSaving, setDashboardSaving] = useState(false);
  const [pendingDeleteDashboard, setPendingDeleteDashboard] = useState(null);
  const csvRef = useRef(null);
  const queryClient = useQueryClient();

  const { data: usersRaw = [], isLoading: loadingUsers } = useQuery({
    queryKey: ['users'],
    queryFn: () => db.entities.User.list('-created_date', 500),
  });

  const { data: systemsRaw = [] } = useQuery({
    queryKey: ['applications'],
    queryFn: () => db.entities.Application.list('sort_order', 50),
  });

  const { data: accessGroupsRaw = [], isLoading: loadingGroups } = useQuery({
    queryKey: ['access-groups'],
    queryFn: () => db.entities.AccessGroup.list('name', 100),
  });

  const { data: metabaseDashboardsRaw = [], isLoading: loadingDashboards } = useQuery({
    queryKey: ['metabase-dashboards-admin'],
    queryFn: () => db.entities.MetabaseDashboard.listAdmin('sort_order', 100),
  });

  const [accessGroups, setAccessGroups] = useState([]);
  const [metabaseDashboards, setMetabaseDashboards] = useState([]);
  const hiddenAccessGroupIdsRef = useRef(new Set());
  const hiddenMetabaseDashboardIdsRef = useRef(new Set());

  useEffect(() => {
    if (!Array.isArray(accessGroupsRaw)) return;
    const hidden = hiddenAccessGroupIdsRef.current;
    setAccessGroups(accessGroupsRaw.filter((group) => !hidden.has(String(group.id))));
  }, [accessGroupsRaw]);

  useEffect(() => {
    if (!Array.isArray(metabaseDashboardsRaw)) return;
    const hidden = hiddenMetabaseDashboardIdsRef.current;
    setMetabaseDashboards(metabaseDashboardsRaw.filter((dashboard) => !hidden.has(String(dashboard.id))));
  }, [metabaseDashboardsRaw]);

  const users = Array.isArray(usersRaw) ? usersRaw : [];
  const systems = Array.isArray(systemsRaw) ? systemsRaw : [];
  const publicSystems = systems.filter((system) => system.visibility === 'public');

  useEffect(() => {
    setPage(1);
  }, [search, roleFilter, statusFilter]);

  const getGroupById = (groupId) => accessGroups.find((group) => String(group.id) === String(groupId));

  const getUserGroupIds = (user) => {
    if (Array.isArray(user?.access_group_ids) && user.access_group_ids.length > 0) {
      return user.access_group_ids.map((id) => String(id));
    }
    if (Array.isArray(user?.access_groups) && user.access_groups.length > 0) {
      return user.access_groups.map((group) => String(group.id));
    }
    return [];
  };

  const getUserAccessLabel = (user) => {
    if (user.role === 'admin') return 'All apps (admin)';
    const groupIds = getUserGroupIds(user);
    if (groupIds.length === 0) return 'No app access';
    const names = Array.isArray(user.access_group_names) && user.access_group_names.length > 0
      ? user.access_group_names
      : groupIds.map((id) => getGroupById(id)?.name).filter(Boolean);
    return names.length > 0 ? names.join(', ') : `${groupIds.length} group(s)`;
  };

  const getUsersInGroup = (groupId) => users.filter((user) => getUserGroupIds(user).includes(String(groupId)));

  const toggleIdInSet = (setter, id) => {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filteredUsers = users.filter((user) => {
    const searchValue = search.trim().toLowerCase();
    const matchesSearch = !searchValue
      || user.full_name?.toLowerCase().includes(searchValue)
      || user.email?.toLowerCase().includes(searchValue);
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    const matchesStatus = statusFilter === 'all'
      || (statusFilter === 'approved' && user.is_approved)
      || (statusFilter === 'pending' && !user.is_approved);

    return matchesSearch && matchesRole && matchesStatus;
  });

  const pageSize = 20;
  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedUsers = filteredUsers.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const stats = {
    total: users.length,
    admins: users.filter(user => user.role === 'admin').length,
    approved: users.filter(user => user.is_approved).length,
    pending: users.filter(user => !user.is_approved).length,
  };

  const openGroupDialog = (group = null) => {
    if (group) {
      const memberIds = getUsersInGroup(group.id).map((user) => user.id);
      setEditGroup(group);
      setGroupForm({
        name: group.name || '',
        description: group.description || '',
        allowedSlugs: new Set(group.allowed_system_slugs || []),
        userIds: new Set(memberIds),
      });
    } else {
      setEditGroup(null);
      setGroupForm({ name: '', description: '', allowedSlugs: new Set(publicSystems.map((s) => s.slug)), userIds: new Set() });
    }
    setGroupDialogOpen(true);
  };

  const closeGroupDialog = () => {
    setGroupDialogOpen(false);
    setEditGroup(null);
    setGroupForm({ name: '', description: '', allowedSlugs: new Set(), userIds: new Set() });
  };

  const toggleGroupApp = (slug) => {
    setGroupForm((prev) => {
      const next = new Set(prev.allowedSlugs);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return { ...prev, allowedSlugs: next };
    });
  };

  const toggleGroupUser = (userId) => {
    setGroupForm((prev) => {
      const next = new Set(prev.userIds);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return { ...prev, userIds: next };
    });
  };

  const setAllGroupApps = (enabled) => {
    setGroupForm((prev) => ({
      ...prev,
      allowedSlugs: new Set(enabled ? publicSystems.map((system) => system.slug) : []),
    }));
  };

  const saveGroup = async (e) => {
    e.preventDefault();
    if (!groupForm.name.trim()) {
      toast.error('Group name is required');
      return;
    }

    setGroupSaving(true);
    try {
      const payload = {
        name: groupForm.name.trim(),
        description: groupForm.description.trim() || null,
        allowed_system_slugs: [...groupForm.allowedSlugs],
        user_ids: [...groupForm.userIds],
      };

      if (editGroup) {
        await db.entities.AccessGroup.update(editGroup.id, payload);
        toast.success(`Updated group "${payload.name}"`);
      } else {
        await db.entities.AccessGroup.create(payload);
        toast.success(`Created group "${payload.name}"`);
      }

      queryClient.invalidateQueries({ queryKey: ['access-groups'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      closeGroupDialog();
    } catch (err) {
      toast.error(err?.data?.message || err.message || 'Failed to save group');
    } finally {
      setGroupSaving(false);
    }
  };

  const removeFromAccessGroupsCache = (id) => {
    queryClient.setQueryData(['access-groups'], (old) =>
      (Array.isArray(old) ? old : []).filter((group) => String(group.id) !== String(id))
    );
  };

  const removeFromMetabaseDashboardsCache = (id) => {
    const remove = (old) =>
      (Array.isArray(old) ? old : []).filter((dashboard) => String(dashboard.id) !== String(id));

    queryClient.setQueryData(['metabase-dashboards-admin'], remove);
    queryClient.setQueryData(['metabase-dashboards'], remove);
  };

  const deleteGroupMut = useMutation({
    mutationFn: ({ id }) => db.entities.AccessGroup.delete(id),
    onError: (err, { id }) => {
      hiddenAccessGroupIdsRef.current.delete(String(id));
      queryClient.invalidateQueries({ queryKey: ['access-groups'] });
      toast.error(err?.data?.message || err.message || 'Failed to delete group');
    },
    onSuccess: async (_data, { id, name }) => {
      hiddenAccessGroupIdsRef.current.delete(String(id));
      removeFromAccessGroupsCache(id);
      await queryClient.refetchQueries({ queryKey: ['access-groups'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['metabase-dashboards-admin'] });
      toast.success(`Deleted group "${name}"`);
    },
  });

  const deleteDashboardMut = useMutation({
    mutationFn: ({ id }) => db.entities.MetabaseDashboard.delete(id),
    onError: (err, { id }) => {
      hiddenMetabaseDashboardIdsRef.current.delete(String(id));
      queryClient.invalidateQueries({ queryKey: ['metabase-dashboards-admin'] });
      queryClient.invalidateQueries({ queryKey: ['metabase-dashboards'] });
      toast.error(err?.data?.message || err.message || 'Failed to delete dashboard');
    },
    onSuccess: async (_data, { id, name }) => {
      hiddenMetabaseDashboardIdsRef.current.delete(String(id));
      removeFromMetabaseDashboardsCache(id);
      await queryClient.refetchQueries({ queryKey: ['metabase-dashboards-admin'] });
      queryClient.invalidateQueries({ queryKey: ['metabase-dashboards'] });
      toast.success(`Deleted dashboard "${name}"`);
    },
  });

  const openDashboardDialog = (dashboard = null) => {
    if (dashboard) {
      setEditDashboard(dashboard);
      setDashboardForm({
        name: dashboard.name || '',
        publicUrl: dashboard.public_url || '',
        groupIds: new Set((dashboard.access_group_ids || []).map(String)),
        isEnabled: dashboard.is_enabled !== false,
        sortOrder: dashboard.sort_order ?? 0,
      });
    } else {
      setEditDashboard(null);
      setDashboardForm({ name: '', publicUrl: '', groupIds: new Set(), isEnabled: true, sortOrder: 0 });
    }
    setDashboardDialogOpen(true);
  };

  const closeDashboardDialog = () => {
    setDashboardDialogOpen(false);
    setEditDashboard(null);
    setDashboardForm({ name: '', publicUrl: '', groupIds: new Set(), isEnabled: true, sortOrder: 0 });
  };

  const toggleDashboardGroup = (groupId) => {
    setDashboardForm((prev) => {
      const next = new Set(prev.groupIds);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return { ...prev, groupIds: next };
    });
  };

  const saveDashboard = async (e) => {
    e.preventDefault();
    if (!dashboardForm.name.trim()) {
      toast.error('Dashboard name is required');
      return;
    }
    if (!dashboardForm.publicUrl.trim()) {
      toast.error('Public Metabase URL is required');
      return;
    }
    if (dashboardForm.groupIds.size === 0) {
      toast.error('Select at least one access group');
      return;
    }

    setDashboardSaving(true);
    try {
      const payload = {
        name: dashboardForm.name.trim(),
        public_url: dashboardForm.publicUrl.trim(),
        access_group_ids: [...dashboardForm.groupIds].map(Number),
        is_enabled: dashboardForm.isEnabled,
        sort_order: Number(dashboardForm.sortOrder) || 0,
      };

      if (editDashboard) {
        await db.entities.MetabaseDashboard.update(editDashboard.id, payload);
        toast.success(`Updated dashboard "${payload.name}"`);
      } else {
        await db.entities.MetabaseDashboard.create(payload);
        toast.success(`Created dashboard "${payload.name}"`);
      }

      queryClient.invalidateQueries({ queryKey: ['metabase-dashboards-admin'] });
      queryClient.invalidateQueries({ queryKey: ['metabase-dashboards'] });
      closeDashboardDialog();
    } catch (err) {
      toast.error(err?.data?.message || err.message || 'Failed to save dashboard');
    } finally {
      setDashboardSaving(false);
    }
  };

  const confirmDeleteGroup = () => {
    if (!pendingDeleteGroup || deleteGroupMut.isPending) return;
    const group = pendingDeleteGroup;
    const groupId = String(group.id);
    setPendingDeleteGroup(null);
    hiddenAccessGroupIdsRef.current.add(groupId);
    setAccessGroups((prev) => prev.filter((item) => String(item.id) !== groupId));
    deleteGroupMut.mutate({ id: group.id, name: group.name });
  };

  const confirmDeleteDashboard = () => {
    if (!pendingDeleteDashboard || deleteDashboardMut.isPending) return;
    const dashboard = pendingDeleteDashboard;
    const dashboardId = String(dashboard.id);
    setPendingDeleteDashboard(null);
    hiddenMetabaseDashboardIdsRef.current.add(dashboardId);
    setMetabaseDashboards((prev) => prev.filter((item) => String(item.id) !== dashboardId));
    deleteDashboardMut.mutate({ id: dashboard.id, name: dashboard.name });
  };

  const getDashboardGroupNames = (dashboard) => {
    const ids = (dashboard.access_group_ids || []).map(String);
    return ids.map((id) => getGroupById(id)?.name).filter(Boolean);
  };

  const openAssignDialog = (user) => {
    setAssignDialogUser(user);
    setAssignGroupIds(new Set(getUserGroupIds(user)));
  };

  const saveUserGroup = async () => {
    if (!assignDialogUser) return;
    setAssignSaving(true);
    try {
      await db.entities.User.update(assignDialogUser.id, {
        access_group_ids: [...assignGroupIds].map(Number),
      });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['access-groups'] });
      setAssignDialogUser(null);
      toast.success(`Access groups updated for ${assignDialogUser.email}`);
    } catch (err) {
      toast.error(err?.data?.message || err.message || 'Failed to update access groups');
    } finally {
      setAssignSaving(false);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    setCreating(true);
    try {
      await db.entities.User.create({
        full_name: form.get('full_name'),
        email: form.get('email'),
        password: form.get('password'),
        role: newUserRole,
        access_group_ids: [...newUserGroupIds].map(Number),
        is_approved: true,
      });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['access-groups'] });
      setCreateOpen(false);
      setNewUserRole('user');
      setNewUserGroupIds(new Set());
      toast.success('User created successfully');
    } catch (err) {
      toast.error(err?.data?.message || err.message || 'Failed to create user');
    } finally {
      setCreating(false);
    }
  };

  const openEditUser = (user) => {
    setEditUser(user);
    setEditForm({
      full_name: user.full_name || '',
      role: user.role || 'user',
      is_approved: Boolean(user.is_approved),
      access_group_ids: new Set(getUserGroupIds(user)),
      password: '',
      date_of_birth: formatDateForInput(user.date_of_birth),
      joined_at: formatDateForInput(user.joined_at),
    });
  };

  const handleEditUser = async (e) => {
    e.preventDefault();
    if (!editUser) return;
    setEditSaving(true);
    try {
      const updateData = {
        full_name: editForm.full_name,
        name: editForm.full_name,
        role: editForm.role,
        is_approved: editForm.is_approved,
        access_group_ids: [...(editForm.access_group_ids || new Set())].map(Number),
        date_of_birth: editForm.date_of_birth || null,
        joined_at: editForm.joined_at || null,
      };
      if (editForm.password) {
        updateData.password = editForm.password;
      }
      await db.entities.User.update(editUser.id, updateData);
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['access-groups'] });
      setEditUser(null);
      toast.success('User updated successfully');
    } catch (err) {
      toast.error(err?.data?.message || err.message || 'Failed to update user');
    } finally {
      setEditSaving(false);
    }
  };

  const handleCsvUpload = async (file) => {
    if (!file || !/\.csv$/i.test(file.name)) {
      toast.error('Please upload a valid CSV file');
      return;
    }
    setImporting(true);
    try {
      const result = await db.importUsersCsv(file);
      const errors = Array.isArray(result?.errors) ? result.errors : [];
      const count = Number(result?.count || 0);
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success(`Imported ${count} user(s)${errors.length ? ` (${errors.length} skipped)` : ''}`);
      if (errors.length) {
        errors.forEach((err) => toast.error(err, { duration: 6000 }));
      }
    } catch (err) {
      toast.error(err?.data?.message || err.message || 'Import failed');
    } finally {
      setImporting(false);
      if (csvRef.current) csvRef.current.value = '';
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) handleCsvUpload(file);
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleCsvUpload(file);
  };

  const downloadSampleCsv = () => {
    const sample = [
      'full_name,email,password,role,is_approved',
      'John Doe,john@example.com,Password@123,user,true',
      'Jane Admin,jane@example.com,Password@456,admin,true',
    ].join('\n');
    const blob = new Blob([sample], { type: 'text/csv;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'users-import-template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const setApproval = async (user, isApproved) => {
    setApprovingUser(user.id);
    try {
      await db.entities.User.update(user.id, { is_approved: isApproved });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success(isApproved ? `Approved ${user.email}` : `Revoked approval for ${user.email}`);
    } finally {
      setApprovingUser(null);
    }
  };

  const clearFilters = () => {
    setSearch('');
    setRoleFilter('all');
    setStatusFilter('all');
  };

  const selectableUsers = users
    .filter((user) => user.role !== 'admin')
    .sort((a, b) => (a.full_name || a.email).localeCompare(b.full_name || b.email));

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary" /> User Management
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Create access groups, assign users, and manage approvals.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input ref={csvRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFileSelect} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5" disabled={importing}>
                <Upload className="w-4 h-4" />
                {importing ? 'Importing...' : 'Import CSV'}
                <ChevronDown className="w-3.5 h-3.5 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => csvRef.current?.click()} disabled={importing}>
                <Upload className="w-4 h-4" /> Upload CSV
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={downloadSampleCsv}>
                <Download className="w-4 h-4" /> Download sample
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}>
            <UserPlus className="w-4 h-4" /> Create User
          </Button>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { label: 'Total Users', value: stats.total },
          { label: 'Approved', value: stats.approved },
          { label: 'Pending', value: stats.pending },
          { label: 'Access Groups', value: accessGroups.length },
        ].map((item, index) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.04 }}
          >
            <Card className="rounded-2xl border-border/70">
              <CardContent className="p-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{item.label}</p>
                <p className="mt-2 text-2xl font-bold tracking-tight">{item.value}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <Card className="rounded-2xl border-border/70">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Layers className="w-4 h-4 text-primary" /> Access Groups
              </CardTitle>
              <CardDescription>Define which public apps each group can access, then assign users to a group.</CardDescription>
            </div>
            <Button size="sm" className="gap-1.5 shrink-0" onClick={() => openGroupDialog()}>
              <Plus className="w-4 h-4" /> Create Group
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loadingGroups ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-muted border-t-primary rounded-full animate-spin" />
            </div>
          ) : accessGroups.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">
              No access groups yet. Create one to manage application access in bulk.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {accessGroups.map((group) => {
                const appCount = (group.allowed_system_slugs || []).length;
                const memberCount = group.users_count ?? group.user_count ?? getUsersInGroup(group.id).length;

                return (
                  <div key={group.id} className="rounded-xl border border-border bg-card p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{group.name}</p>
                        {group.description ? (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{group.description}</p>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openGroupDialog(group)}>
                          <Edit className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => setPendingDeleteGroup(group)}
                          disabled={deleteGroupMut.isPending && String(pendingDeleteGroup?.id) === String(group.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary" className="text-xs">{appCount} app{appCount === 1 ? '' : 's'}</Badge>
                      <Badge variant="outline" className="text-xs">{memberCount} user{memberCount === 1 ? '' : 's'}</Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/70">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-primary" /> Metabase Dashboards
              </CardTitle>
              <CardDescription>
                Add public Metabase embed links and choose which access groups can view each dashboard on the Analytics page.
              </CardDescription>
            </div>
            <Button size="sm" className="gap-1.5 shrink-0" onClick={() => openDashboardDialog()}>
              <Plus className="w-4 h-4" /> Add Dashboard
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loadingDashboards ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-muted border-t-primary rounded-full animate-spin" />
            </div>
          ) : metabaseDashboards.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">
              No Metabase dashboards yet. Add a public Metabase link and assign access groups to control visibility.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {metabaseDashboards.map((dashboard) => {
                const groupNames = getDashboardGroupNames(dashboard);

                return (
                  <div key={dashboard.id} className="rounded-xl border border-border bg-card p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{dashboard.name}</p>
                        <a
                          href={dashboard.public_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1 truncate hover:text-primary"
                        >
                          <ExternalLink className="w-3 h-3 shrink-0" />
                          <span className="truncate">{dashboard.public_url}</span>
                        </a>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openDashboardDialog(dashboard)}>
                          <Edit className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => setPendingDeleteDashboard(dashboard)}
                          disabled={deleteDashboardMut.isPending && String(pendingDeleteDashboard?.id) === String(dashboard.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={dashboard.is_enabled ? 'default' : 'outline'} className="text-xs">
                        {dashboard.is_enabled ? 'Enabled' : 'Disabled'}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">Order {dashboard.sort_order ?? 0}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {groupNames.length === 0 ? (
                        <Badge variant="outline" className="text-xs">No groups</Badge>
                      ) : groupNames.map((name) => (
                        <Badge key={`${dashboard.id}-${name}`} variant="outline" className="text-xs">{name}</Badge>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/70">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <UsersIcon className="w-4 h-4 text-primary" /> User Directory
              </CardTitle>
              <CardDescription>{filteredUsers.length} matching users out of {users.length}</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[220px] flex-1 lg:flex-none lg:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search name or email"
                  className="pl-9"
                />
              </div>

              <div className="min-w-[150px]">
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger className="gap-2">
                    <Filter className="w-4 h-4" />
                    <SelectValue placeholder="Role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="min-w-[150px]">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="gap-2">
                    <Filter className="w-4 h-4" />
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button variant="ghost" onClick={clearFilters} disabled={!search && roleFilter === 'all' && statusFilter === 'all'}>
                Clear
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent
          className="p-0 relative"
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          {loadingUsers ? (
            <div className="flex justify-center py-16">
              <div className="w-8 h-8 border-2 border-muted border-t-primary rounded-full animate-spin" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="px-6 py-16 text-center text-sm text-muted-foreground">
              No users match the current search and filters.
            </div>
          ) : (
            <div className="overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/40 sticky top-0 z-10">
                  <TableRow>
                    <TableHead className="pl-6">User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Access Group</TableHead>
                    <TableHead className="text-right pr-6">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="pl-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-semibold text-primary text-sm shrink-0">
                            {user.full_name?.[0]?.toUpperCase() || user.email[0].toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium leading-none">{user.full_name || user.email}</p>
                            <p className="text-xs text-muted-foreground mt-1">{user.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.role === 'admin' ? 'default' : 'secondary'} className="text-xs">
                          {user.role || 'user'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.is_approved ? 'default' : 'outline'} className="text-xs">
                          {user.is_approved ? 'approved' : 'pending'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm text-muted-foreground">{getUserAccessLabel(user)}</p>
                      </TableCell>
                      <TableCell className="pr-6">
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" className="gap-1" onClick={() => openEditUser(user)}>
                            <Edit className="w-3 h-3" />
                            Edit
                          </Button>
                          {user.role !== 'admin' && (
                            <Button variant="outline" size="sm" onClick={() => openAssignDialog(user)}>
                              Assign Groups
                            </Button>
                          )}
                          {user.is_approved ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1"
                              onClick={() => setApproval(user, false)}
                              disabled={approvingUser === user.id}
                            >
                              <UserX className="w-3 h-3" />
                              Revoke
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              className="gap-1"
                              onClick={() => setApproval(user, true)}
                              disabled={approvingUser === user.id}
                            >
                              <UserCheck className="w-3 h-3" />
                              Approve
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {filteredUsers.length > 0 && (
            <div className="flex flex-col gap-3 border-t border-border px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {Math.min((currentPage - 1) * pageSize + 1, filteredUsers.length)}-{Math.min(currentPage * pageSize, filteredUsers.length)} of {filteredUsers.length}
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                  <ChevronLeft className="w-4 h-4 mr-1" /> Previous
                </Button>
                <span className="text-sm text-muted-foreground px-2">Page {currentPage} of {totalPages}</span>
                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                  Next <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          )}

          {dragActive && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-primary/10 border-2 border-dashed border-primary rounded-2xl pointer-events-none">
              <div className="text-center">
                <Upload className="w-8 h-8 text-primary mx-auto mb-2" />
                <p className="text-sm font-medium text-primary">Drop CSV file here to import users</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={groupDialogOpen} onOpenChange={(open) => !open && closeGroupDialog()}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-3 border-b border-border/70">
            <DialogTitle>{editGroup ? `Edit Group - ${editGroup.name}` : 'Create Access Group'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={saveGroup} className="flex flex-1 min-h-0 flex-col">
            <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Group Name *</Label>
                  <Input
                    value={groupForm.name}
                    onChange={(e) => setGroupForm((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="Sales Team"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input
                    value={groupForm.description}
                    onChange={(e) => setGroupForm((prev) => ({ ...prev, description: e.target.value }))}
                    placeholder="Optional note about this group"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label>Public Applications</Label>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => setAllGroupApps(true)} disabled={publicSystems.length === 0}>
                      Select all
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => setAllGroupApps(false)} disabled={publicSystems.length === 0}>
                      Clear all
                    </Button>
                  </div>
                </div>
                {publicSystems.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No public apps registered yet.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-auto pr-1">
                    {publicSystems.map((system) => {
                      const allowed = groupForm.allowedSlugs.has(system.slug);
                      return (
                        <button
                          key={system.slug}
                          type="button"
                          onClick={() => toggleGroupApp(system.slug)}
                          className={cn(
                            'flex items-center gap-3 rounded-xl border px-3 py-2 text-left text-sm transition-all',
                            allowed
                              ? 'border-primary/30 bg-primary/10 text-primary'
                              : 'border-border bg-muted/40 text-muted-foreground'
                          )}
                        >
                          {system.icon_url ? (
                            <img src={`${import.meta.env.VITE_API_BASE_URL}${system.icon_url}`} alt="" className="w-8 h-8 rounded-lg object-cover" />
                          ) : (
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: system.color || '#6366f1' }}>
                              {system.name?.[0]?.toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="font-medium truncate">{system.name}</p>
                            <p className="text-xs opacity-70 truncate">{system.slug}</p>
                          </div>
                          {allowed ? <Check className="w-4 h-4 shrink-0" /> : <X className="w-4 h-4 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <Label>Users in this group</Label>
                <SearchableUserMultiSelect
                  users={selectableUsers}
                  selectedIds={groupForm.userIds}
                  onToggle={toggleGroupUser}
                />
                <p className="text-xs text-muted-foreground">Users can belong to multiple groups. Access is combined from all assigned groups.</p>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-border/70 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={closeGroupDialog}>Cancel</Button>
              <Button type="submit" disabled={groupSaving}>
                {groupSaving ? 'Saving...' : editGroup ? 'Save Group' : 'Create Group'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editUser} onOpenChange={(open) => !open && setEditUser(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit User{editUser ? ` - ${editUser.email}` : ''}</DialogTitle>
          </DialogHeader>
          {editUser && (
            <form onSubmit={handleEditUser} className="space-y-4 mt-2">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input
                  value={editForm.full_name || ''}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, full_name: e.target.value }))}
                  placeholder="Jane Doe"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={editUser.email || ''} disabled className="bg-muted/40" />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={editForm.role || 'user'} onValueChange={(value) => setEditForm((prev) => ({ ...prev, role: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {editForm.role !== 'admin' && (
                <div className="space-y-2">
                  <Label>Access Groups</Label>
                  <GroupMultiSelect
                    groups={accessGroups}
                    selectedIds={editForm.access_group_ids || new Set()}
                    onToggle={(id) => setEditForm((prev) => {
                      const next = new Set(prev.access_group_ids || []);
                      if (next.has(id)) next.delete(id);
                      else next.add(id);
                      return { ...prev, access_group_ids: next };
                    })}
                  />
                  <p className="text-xs text-muted-foreground">Assign at least one group to grant app access. Multiple groups combine their app access.</p>
                </div>
              )}
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={editForm.is_approved ? 'approved' : 'pending'}
                  onValueChange={(value) => setEditForm((prev) => ({ ...prev, is_approved: value === 'approved' }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>New Password (optional)</Label>
                <Input
                  type="password"
                  minLength={8}
                  value={editForm.password || ''}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, password: e.target.value }))}
                  placeholder="Leave blank to keep current password"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Date of Birth</Label>
                  <Input
                    type="date"
                    value={editForm.date_of_birth || ''}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, date_of_birth: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Joined Date</Label>
                  <Input
                    type="date"
                    value={editForm.joined_at || ''}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, joined_at: e.target.value }))}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground -mt-2">
                Used for today&apos;s birthdays and service anniversaries on the dashboard.
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setEditUser(null)}>Cancel</Button>
                <Button type="submit" disabled={editSaving}>
                  {editSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
                  Save Changes
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New User</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateUser} className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input name="full_name" placeholder="Jane Doe" required />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input name="email" type="email" placeholder="jane@example.com" required />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input name="password" type="password" placeholder="Min 8 characters" minLength={8} required />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={newUserRole} onValueChange={setNewUserRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {newUserRole !== 'admin' && (
              <div className="space-y-2">
                <Label>Access Groups</Label>
                <GroupMultiSelect
                  groups={accessGroups}
                  selectedIds={newUserGroupIds}
                  onToggle={(id) => toggleIdInSet(setNewUserGroupIds, id)}
                />
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={creating}>{creating ? 'Creating...' : 'Create User'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!assignDialogUser} onOpenChange={(open) => !open && setAssignDialogUser(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Assign Access Groups{assignDialogUser ? ` - ${assignDialogUser.full_name || assignDialogUser.email}` : ''}
            </DialogTitle>
          </DialogHeader>
          {assignDialogUser && (
            <div className="space-y-4 mt-2">
              <p className="text-sm text-muted-foreground">{assignDialogUser.email}</p>
              <div className="space-y-2">
                <Label>Access Groups</Label>
                <GroupMultiSelect
                  groups={accessGroups}
                  selectedIds={assignGroupIds}
                  onToggle={(id) => toggleIdInSet(setAssignGroupIds, id)}
                />
                <p className="text-xs text-muted-foreground">
                  Select one or more groups. App access is combined from all assigned groups. Users with no groups cannot access public apps.
                </p>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setAssignDialogUser(null)}>Cancel</Button>
                <Button type="button" onClick={saveUserGroup} disabled={assignSaving}>
                  {assignSaving ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={dashboardDialogOpen} onOpenChange={(open) => !open && closeDashboardDialog()}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-3 border-b border-border/70">
            <DialogTitle>{editDashboard ? `Edit Dashboard - ${editDashboard.name}` : 'Add Metabase Dashboard'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={saveDashboard} className="flex flex-1 min-h-0 flex-col">
            <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Dashboard Name *</Label>
                  <Input
                    value={dashboardForm.name}
                    onChange={(e) => setDashboardForm((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="Sales Performance"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Sort Order</Label>
                  <Input
                    type="number"
                    min="0"
                    value={dashboardForm.sortOrder}
                    onChange={(e) => setDashboardForm((prev) => ({ ...prev, sortOrder: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Public Metabase URL *</Label>
                <Input
                  value={dashboardForm.publicUrl}
                  onChange={(e) => setDashboardForm((prev) => ({ ...prev, publicUrl: e.target.value }))}
                  placeholder="https://metabase.example.com/public/dashboard/..."
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Use the public sharing link from Metabase. It must start with http:// or https://.
                </p>
              </div>

              <div className="space-y-3">
                <Label>Access Groups *</Label>
                <GroupMultiSelect
                  groups={accessGroups}
                  selectedIds={dashboardForm.groupIds}
                  onToggle={toggleDashboardGroup}
                  emptyLabel="Create an access group first, then assign this dashboard to it."
                />
                <p className="text-xs text-muted-foreground">
                  Only users in the selected groups will see this dashboard under Analytics in the sidebar.
                </p>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
                <div>
                  <Label>Enabled</Label>
                  <p className="text-xs text-muted-foreground mt-1">Disabled dashboards stay hidden from all users.</p>
                </div>
                <Switch
                  checked={dashboardForm.isEnabled}
                  onCheckedChange={(checked) => setDashboardForm((prev) => ({ ...prev, isEnabled: checked }))}
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-border/70 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={closeDashboardDialog}>Cancel</Button>
              <Button type="submit" disabled={dashboardSaving}>
                {dashboardSaving ? 'Saving...' : editDashboard ? 'Save Dashboard' : 'Add Dashboard'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(pendingDeleteGroup)} onOpenChange={(open) => !open && setPendingDeleteGroup(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete access group?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDeleteGroup
                ? `"${pendingDeleteGroup.name}" will be permanently removed. Users in this group will lose their group assignment.`
                : 'This access group will be permanently removed.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                confirmDeleteGroup();
              }}
            >
              Delete Group
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(pendingDeleteDashboard)} onOpenChange={(open) => !open && setPendingDeleteDashboard(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Metabase dashboard?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDeleteDashboard
                ? `"${pendingDeleteDashboard.name}" will be permanently removed. Users will no longer see this dashboard.`
                : 'This dashboard will be permanently removed.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                confirmDeleteDashboard();
              }}
            >
              Delete Dashboard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
