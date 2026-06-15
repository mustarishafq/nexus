// @ts-nocheck
import db from '@/api/base44Client';
import React, { useEffect, useState, useRef } from 'react';

import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Check, X, Shield, UserCheck, UserX, UserPlus, Upload, Search, Filter, ChevronLeft, ChevronRight, ChevronDown, Users as UsersIcon, Download, Edit, Loader2, Plus, Trash2, Layers, BarChart3, ExternalLink, MoreHorizontal } from 'lucide-react';
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
import { Separator } from '@/components/ui/separator';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn, formatDateForInput } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import UserAvatar from '@/components/users/UserAvatar';
import DepartmentCombobox from '@/components/profile/DepartmentCombobox';
import ManagerCombobox from '@/components/profile/ManagerCombobox';
import { EMPLOYMENT_TYPE_LABELS } from '@/lib/profile';

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

function DashboardMultiSelect({ dashboards, selectedIds, onToggle, emptyLabel = 'No individual dashboards yet.' }) {
  if (dashboards.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-2 max-h-56 overflow-auto pr-1">
      {dashboards.map((dashboard) => {
        const checked = selectedIds.has(String(dashboard.id));
        return (
          <button
            key={dashboard.id}
            type="button"
            onClick={() => onToggle(String(dashboard.id))}
            className={cn(
              'flex items-center gap-3 rounded-xl border px-3 py-3 text-left text-sm transition-all min-h-[52px]',
              checked
                ? 'border-primary/30 bg-primary/10 text-primary'
                : 'border-border bg-muted/40 text-muted-foreground'
            )}
          >
            <div className="min-w-0 flex-1">
              <p className="font-medium truncate">{dashboard.name}</p>
              <p className="text-xs opacity-70 truncate">
                {dashboard.category?.trim() || 'Uncategorized'}
              </p>
            </div>
            {checked ? <Check className="w-4 h-4 shrink-0" /> : <X className="w-4 h-4 shrink-0" />}
          </button>
        );
      })}
    </div>
  );
}

function getAdminIndividualDashboards(dashboards) {
  return (dashboards || []).filter(
    (dashboard) => dashboard.assignment_type === 'individual' && !dashboard.owner_user_id
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
              <UserAvatar
                user={user}
                className="h-8 w-8"
                fallbackClassName="bg-primary/15 text-xs"
              />
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
                <UserAvatar
                  user={user}
                  className="h-8 w-8"
                  fallbackClassName="bg-muted text-xs text-foreground"
                />
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
  const isMobile = useIsMobile();
  const [approvingUser, setApprovingUser] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [assigningGroups, setAssigningGroups] = useState(false);
  const [newUserRole, setNewUserRole] = useState('user');
  const [newUserGroupIds, setNewUserGroupIds] = useState(new Set());
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [assignDialogUser, setAssignDialogUser] = useState(null);
  const [assignGroupIds, setAssignGroupIds] = useState(new Set());
  const [assignSaving, setAssignSaving] = useState(false);
  const [assignAnalyticsUser, setAssignAnalyticsUser] = useState(null);
  const [assignAnalyticsIds, setAssignAnalyticsIds] = useState(new Set());
  const [assignAnalyticsSaving, setAssignAnalyticsSaving] = useState(false);
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
  const [dashboardForm, setDashboardForm] = useState({
    name: '',
    publicUrl: '',
    assignmentType: 'group',
    groupIds: new Set(),
    userIds: new Set(),
    category: '',
    isEnabled: true,
    sortOrder: 0,
  });
  const [dashboardSaving, setDashboardSaving] = useState(false);
  const [pendingDeleteDashboard, setPendingDeleteDashboard] = useState(null);
  const csvRef = useRef(null);
  const assignGroupsCsvRef = useRef(null);
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
      || user.name?.toLowerCase().includes(searchValue)
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
        assignmentType: dashboard.owner_user_id ? 'individual' : (dashboard.assignment_type || 'group'),
        groupIds: new Set((dashboard.access_group_ids || []).map(String)),
        userIds: new Set((dashboard.user_ids || []).map(String)),
        category: dashboard.category || '',
        isEnabled: dashboard.is_enabled !== false,
        sortOrder: dashboard.sort_order ?? 0,
      });
    } else {
      setEditDashboard(null);
      setDashboardForm({
        name: '',
        publicUrl: '',
        assignmentType: 'group',
        groupIds: new Set(),
        userIds: new Set(),
        category: '',
        isEnabled: true,
        sortOrder: 0,
      });
    }
    setDashboardDialogOpen(true);
  };

  const closeDashboardDialog = () => {
    setDashboardDialogOpen(false);
    setEditDashboard(null);
    setDashboardForm({
      name: '',
      publicUrl: '',
      assignmentType: 'group',
      groupIds: new Set(),
      userIds: new Set(),
      category: '',
      isEnabled: true,
      sortOrder: 0,
    });
  };

  const toggleDashboardGroup = (groupId) => {
    setDashboardForm((prev) => {
      const next = new Set(prev.groupIds);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return { ...prev, groupIds: next };
    });
  };

  const toggleDashboardUser = (userId) => {
    setDashboardForm((prev) => {
      const next = new Set(prev.userIds);
      const key = String(userId);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return { ...prev, userIds: next };
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
    if (dashboardForm.assignmentType === 'group' && dashboardForm.groupIds.size === 0 && !editDashboard?.owner_user_id) {
      toast.error('Select at least one access group');
      return;
    }
    if (
      dashboardForm.assignmentType === 'individual'
      && dashboardForm.userIds.size === 0
      && !editDashboard?.owner_user_id
    ) {
      toast.error('Select at least one user');
      return;
    }

    setDashboardSaving(true);
    try {
      const payload = {
        name: dashboardForm.name.trim(),
        public_url: dashboardForm.publicUrl.trim(),
        category: dashboardForm.category.trim() || null,
        is_enabled: dashboardForm.isEnabled,
        sort_order: Number(dashboardForm.sortOrder) || 0,
      };

      if (editDashboard?.owner_user_id) {
        // Admin editing a user-managed personal dashboard.
      } else {
        payload.assignment_type = dashboardForm.assignmentType;
        if (dashboardForm.assignmentType === 'group') {
          payload.access_group_ids = [...dashboardForm.groupIds].map(Number);
        } else {
          payload.user_ids = [...dashboardForm.userIds].map(Number);
        }
      }

      let createdDashboard = null;
      if (editDashboard) {
        await db.entities.MetabaseDashboard.update(editDashboard.id, payload);
        toast.success(`Updated dashboard "${payload.name}"`);
      } else {
        createdDashboard = await db.entities.MetabaseDashboard.create(payload);
        toast.success(`Created dashboard "${payload.name}"`);
      }

      await queryClient.invalidateQueries({ queryKey: ['metabase-dashboards-admin'] });
      await queryClient.invalidateQueries({ queryKey: ['metabase-dashboards'] });
      closeDashboardDialog();

      if (assignAnalyticsUser && createdDashboard && dashboardForm.assignmentType === 'individual') {
        setAssignAnalyticsIds((prev) => new Set([...prev, String(createdDashboard.id)]));
      }
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

  const getDashboardUserNames = (dashboard) => {
    const ids = (dashboard.user_ids || []).map(String);
    return ids
      .map((id) => users.find((item) => String(item.id) === id))
      .filter(Boolean)
      .map((item) => item.full_name || item.email);
  };

  const getDashboardAssignmentLabel = (dashboard) => {
    if (dashboard.owner_user_id) {
      const owner = users.find((item) => String(item.id) === String(dashboard.owner_user_id));
      return owner ? `Personal (${owner.full_name || owner.email})` : 'Personal';
    }
    return dashboard.assignment_type === 'individual' ? 'Individual' : 'Access Group';
  };

  const openAssignDialog = (user) => {
    setAssignDialogUser(user);
    setAssignGroupIds(new Set(getUserGroupIds(user)));
  };

  const openAssignAnalyticsDialog = (user) => {
    setAssignAnalyticsUser(user);
    const assignedIds = getAdminIndividualDashboards(metabaseDashboards)
      .filter((dashboard) => (dashboard.user_ids || []).map(String).includes(String(user.id)))
      .map((dashboard) => String(dashboard.id));
    setAssignAnalyticsIds(new Set(assignedIds));
  };

  const toggleAssignAnalyticsDashboard = (dashboardId) => {
    setAssignAnalyticsIds((prev) => {
      const next = new Set(prev);
      if (next.has(dashboardId)) next.delete(dashboardId);
      else next.add(dashboardId);
      return next;
    });
  };

  const openDashboardDialogForUser = (user) => {
    setEditDashboard(null);
    setDashboardForm({
      name: '',
      publicUrl: '',
      assignmentType: 'individual',
      groupIds: new Set(),
      userIds: new Set([String(user.id)]),
      category: '',
      isEnabled: true,
      sortOrder: 0,
    });
    setDashboardDialogOpen(true);
  };

  const saveUserAnalytics = async () => {
    if (!assignAnalyticsUser) return;

    const userId = Number(assignAnalyticsUser.id);
    const individualDashboards = getAdminIndividualDashboards(metabaseDashboards);
    const updates = [];

    for (const dashboard of individualDashboards) {
      const currentIds = new Set((dashboard.user_ids || []).map(Number));
      const shouldInclude = assignAnalyticsIds.has(String(dashboard.id));
      const hasUser = currentIds.has(userId);

      if (shouldInclude === hasUser) continue;

      const nextIds = shouldInclude
        ? [...currentIds, userId]
        : [...currentIds].filter((id) => id !== userId);

      if (nextIds.length === 0) {
        toast.error(`"${dashboard.name}" must stay assigned to at least one user. Delete it from Metabase Dashboards instead.`);
        return;
      }

      updates.push(
        db.entities.MetabaseDashboard.update(dashboard.id, { user_ids: nextIds })
      );
    }

    setAssignAnalyticsSaving(true);
    try {
      await Promise.all(updates);
      await queryClient.invalidateQueries({ queryKey: ['metabase-dashboards-admin'] });
      await queryClient.invalidateQueries({ queryKey: ['metabase-dashboards'] });
      toast.success(`Analytics updated for ${assignAnalyticsUser.email}`);
      setAssignAnalyticsUser(null);
    } catch (err) {
      toast.error(err?.data?.message || err.message || 'Failed to update analytics assignments');
    } finally {
      setAssignAnalyticsSaving(false);
    }
  };

  const getUserAnalyticsLabel = (user) => {
    const assignedCount = getAdminIndividualDashboards(metabaseDashboards).filter((dashboard) =>
      (dashboard.user_ids || []).map(String).includes(String(user.id))
    ).length;
    const personalCount = metabaseDashboards.filter(
      (dashboard) => dashboard.owner_user_id && String(dashboard.owner_user_id) === String(user.id)
    ).length;

    if (assignedCount === 0 && personalCount === 0) return 'None';
    const parts = [];
    if (assignedCount > 0) parts.push(`${assignedCount} assigned`);
    if (personalCount > 0) parts.push(`${personalCount} personal`);
    return parts.join(', ');
  };

  const renderUserActionsMenu = (user, align = 'end') => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size={isMobile ? 'icon' : 'sm'} className={cn(isMobile ? 'h-9 w-9' : 'gap-1 h-9')}>
          {isMobile ? (
            <MoreHorizontal className="w-4 h-4" />
          ) : (
            <>
              Actions
              <ChevronDown className="w-3.5 h-3.5 opacity-60" />
            </>
          )}
          {isMobile ? <span className="sr-only">User actions</span> : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-52">
        <DropdownMenuItem onClick={() => openEditUser(user)}>
          <Edit className="w-4 h-4 mr-2" />
          Edit user
        </DropdownMenuItem>
        {user.role !== 'admin' && (
          <>
            <DropdownMenuItem onClick={() => openAssignDialog(user)}>
              <Layers className="w-4 h-4 mr-2" />
              Assign groups
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => openAssignAnalyticsDialog(user)}>
              <BarChart3 className="w-4 h-4 mr-2" />
              Assign analytics
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        {user.is_approved ? (
          <DropdownMenuItem
            onClick={() => setApproval(user, false)}
            disabled={approvingUser === user.id}
          >
            <UserX className="w-4 h-4 mr-2" />
            Revoke access
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            onClick={() => setApproval(user, true)}
            disabled={approvingUser === user.id}
          >
            <UserCheck className="w-4 h-4 mr-2" />
            Approve user
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

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
      name: user.name || '',
      role: user.role || 'user',
      is_approved: Boolean(user.is_approved),
      access_group_ids: new Set(getUserGroupIds(user)),
      password: '',
      date_of_birth: formatDateForInput(user.date_of_birth),
      joined_at: formatDateForInput(user.joined_at),
      job_title: user.job_title || '',
      employee_id: user.employee_id || '',
      employment_type: user.employment_type || '',
      department_id: user.department_id ?? null,
      department_name: user.department || '',
      manager_id: user.manager_id ?? null,
      manager_name: user.manager?.name || user.manager?.full_name || '',
    });
  };

  const handleEditUser = async (e) => {
    e.preventDefault();
    if (!editUser) return;
    setEditSaving(true);
    try {
      const updateData = {
        full_name: editForm.full_name,
        name: editForm.name,
        role: editForm.role,
        is_approved: editForm.is_approved,
        access_group_ids: [...(editForm.access_group_ids || new Set())].map(Number),
        date_of_birth: editForm.date_of_birth || null,
        joined_at: editForm.joined_at || null,
        job_title: editForm.job_title?.trim() || null,
        employee_id: editForm.employee_id?.trim() || null,
        employment_type: editForm.employment_type || null,
        department_id: editForm.department_id,
        manager_id: editForm.manager_id,
      };
      if (editForm.password) {
        updateData.password = editForm.password;
      }
      await db.entities.User.update(editUser.id, updateData);
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['people-directory'] });
      queryClient.invalidateQueries({ queryKey: ['org-chart'] });
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

  const handleAssignGroupsCsvUpload = async (file) => {
    if (!file || !/\.csv$/i.test(file.name)) {
      toast.error('Please upload a valid CSV file');
      return;
    }
    setAssigningGroups(true);
    try {
      const result = await db.assignAccessGroupsCsv(file);
      const errors = Array.isArray(result?.errors) ? result.errors : [];
      const count = Number(result?.count || 0);
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['access-groups'] });
      toast.success(`Assigned access groups for ${count} user(s)${errors.length ? ` (${errors.length} skipped)` : ''}`);
      if (errors.length) {
        errors.forEach((err) => toast.error(err, { duration: 6000 }));
      }
    } catch (err) {
      toast.error(err?.data?.message || err.message || 'Access group assignment failed');
    } finally {
      setAssigningGroups(false);
      if (assignGroupsCsvRef.current) assignGroupsCsvRef.current.value = '';
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) handleCsvUpload(file);
  };

  const handleAssignGroupsFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) handleAssignGroupsCsvUpload(file);
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

  const downloadAssignGroupsSampleCsv = () => {
    const sample = [
      'email,access_group',
      'azira@emzi.com.my,R&F',
      'hanis.azmi@emzi.com.my,R&F',
    ].join('\n');
    const blob = new Blob([sample], { type: 'text/csv;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'assign-access-groups-template.csv';
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
          <input ref={assignGroupsCsvRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleAssignGroupsFileSelect} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5" disabled={importing || assigningGroups}>
                <Upload className="w-4 h-4" />
                {importing || assigningGroups ? 'Importing...' : 'Import CSV'}
                <ChevronDown className="w-3.5 h-3.5 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => csvRef.current?.click()} disabled={importing || assigningGroups}>
                <Upload className="w-4 h-4" /> Import new users
              </DropdownMenuItem>
              <DropdownMenuItem onClick={downloadSampleCsv}>
                <Download className="w-4 h-4" /> User import template
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => assignGroupsCsvRef.current?.click()} disabled={importing || assigningGroups}>
                <Layers className="w-4 h-4" /> Assign access groups
              </DropdownMenuItem>
              <DropdownMenuItem onClick={downloadAssignGroupsSampleCsv}>
                <Download className="w-4 h-4" /> Access group template
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
                Add public Metabase embed links. Assign by access group or to specific individuals, and organize with categories.
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
                const userNames = getDashboardUserNames(dashboard);
                const assignmentLabel = getDashboardAssignmentLabel(dashboard);

                return (
                  <div key={dashboard.id} className="rounded-xl border border-border bg-card p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{dashboard.name}</p>
                        {dashboard.category ? (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">{dashboard.category}</p>
                        ) : null}
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
                      <Badge variant="secondary" className="text-xs">{assignmentLabel}</Badge>
                      <Badge variant="secondary" className="text-xs">Order {dashboard.sort_order ?? 0}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {dashboard.assignment_type === 'individual' && !dashboard.owner_user_id ? (
                        userNames.length === 0 ? (
                          <Badge variant="outline" className="text-xs">No users</Badge>
                        ) : userNames.map((name) => (
                          <Badge key={`${dashboard.id}-${name}`} variant="outline" className="text-xs">{name}</Badge>
                        ))
                      ) : dashboard.owner_user_id ? (
                        <Badge variant="outline" className="text-xs">User-managed</Badge>
                      ) : groupNames.length === 0 ? (
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
            <>
              <div className="md:hidden divide-y divide-border">
                {paginatedUsers.map((user) => (
                  <div key={user.id} className="px-4 py-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <UserAvatar user={user} />
                        <div className="min-w-0">
                          <p className="font-medium leading-tight truncate">{user.full_name || user.email}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">{user.email}</p>
                        </div>
                      </div>
                      {renderUserActionsMenu(user)}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={user.role === 'admin' ? 'default' : 'secondary'} className="text-xs">
                        {user.role || 'user'}
                      </Badge>
                      <Badge variant={user.is_approved ? 'default' : 'outline'} className="text-xs">
                        {user.is_approved ? 'approved' : 'pending'}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-1 gap-1.5 text-xs text-muted-foreground">
                      <p><span className="font-medium text-foreground/80">Groups:</span> {getUserAccessLabel(user)}</p>
                      <p><span className="font-medium text-foreground/80">Analytics:</span> {getUserAnalyticsLabel(user)}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/40 sticky top-0 z-10">
                  <TableRow>
                    <TableHead className="pl-6">User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden lg:table-cell">Access Group</TableHead>
                    <TableHead className="hidden lg:table-cell">Analytics</TableHead>
                    <TableHead className="text-right pr-6">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="pl-6">
                        <div className="flex items-center gap-3">
                          <UserAvatar user={user} />
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
                      <TableCell className="hidden lg:table-cell">
                        <p className="text-sm text-muted-foreground">{getUserAccessLabel(user)}</p>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <p className="text-sm text-muted-foreground">{getUserAnalyticsLabel(user)}</p>
                      </TableCell>
                      <TableCell className="pr-6">
                        <div className="flex justify-end">
                          {renderUserActionsMenu(user)}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            </>
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
        <DialogContent className="sm:max-w-lg max-h-[90dvh] overflow-hidden flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-3 border-b border-border/70">
            <DialogTitle className="text-left pr-6">Edit User{editUser ? ` - ${editUser.email}` : ''}</DialogTitle>
          </DialogHeader>
          {editUser && (
            <form onSubmit={handleEditUser} className="flex flex-1 min-h-0 flex-col">
              <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-4">
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
                  <Label>Display Name</Label>
                  <Input
                    value={editForm.name || ''}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g. Jane"
                  />
                  <p className="text-xs text-muted-foreground">Shown in Nexus and sent via SSO.</p>
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

                <Separator />

                <div className="space-y-2">
                  <Label>Job Title</Label>
                  <Input
                    value={editForm.job_title || ''}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, job_title: e.target.value }))}
                    placeholder="e.g. Senior Accountant"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Department</Label>
                  <DepartmentCombobox
                    value={editForm.department_id}
                    label={editForm.department_name}
                    onChange={(departmentId, departmentName = '') =>
                      setEditForm((prev) => ({
                        ...prev,
                        department_id: departmentId,
                        department_name: departmentName,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Reports To</Label>
                  <ManagerCombobox
                    value={editForm.manager_id}
                    excludeUserId={editUser.id}
                    selectedLabel={editForm.manager_name}
                    onChange={(managerId) => setEditForm((prev) => ({ ...prev, manager_id: managerId }))}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Employee ID</Label>
                    <Input
                      value={editForm.employee_id || ''}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, employee_id: e.target.value }))}
                      placeholder="Internal staff number"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Employment Type</Label>
                    <Select
                      value={editForm.employment_type || 'unset'}
                      onValueChange={(value) =>
                        setEditForm((prev) => ({
                          ...prev,
                          employment_type: value === 'unset' ? '' : value,
                        }))
                      }
                    >
                      <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unset">Not specified</SelectItem>
                        {Object.entries(EMPLOYMENT_TYPE_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground -mt-2">
                  Work details power colleague profiles and the department org chart.
                </p>
              </div>
              <div className="px-6 py-4 border-t border-border/70 flex justify-end gap-2">
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

      <Dialog open={!!assignAnalyticsUser} onOpenChange={(open) => !open && setAssignAnalyticsUser(null)}>
        <DialogContent className="w-[calc(100vw-1.5rem)] sm:max-w-xl max-h-[90dvh] overflow-hidden flex flex-col p-0 gap-0">
          <DialogHeader className="px-4 sm:px-6 pt-5 sm:pt-6 pb-3 border-b border-border/70">
            <DialogTitle className="text-left pr-6">
              Assign Analytics{assignAnalyticsUser ? ` - ${assignAnalyticsUser.full_name || assignAnalyticsUser.email}` : ''}
            </DialogTitle>
          </DialogHeader>
          {assignAnalyticsUser && (
            <div className="flex flex-1 min-h-0 flex-col">
              <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-4 space-y-4">
                <p className="text-sm text-muted-foreground break-all">{assignAnalyticsUser.email}</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5 w-full sm:w-auto h-10"
                  onClick={() => openDashboardDialogForUser(assignAnalyticsUser)}
                >
                  <Plus className="w-4 h-4" />
                  Create dashboard for user
                </Button>
                <div className="space-y-3">
                  <Label>Individual Dashboards</Label>
                  <DashboardMultiSelect
                    dashboards={getAdminIndividualDashboards(metabaseDashboards)}
                    selectedIds={assignAnalyticsIds}
                    onToggle={toggleAssignAnalyticsDashboard}
                    emptyLabel="No admin-managed individual dashboards yet. Create one above or from Metabase Dashboards."
                  />
                  <p className="text-xs text-muted-foreground">
                    Selected dashboards appear on this user&apos;s Analytics page. Group dashboards follow access group membership.
                  </p>
                </div>
              </div>
              <div className="px-4 sm:px-6 py-4 border-t border-border/70 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                <Button type="button" variant="outline" className="h-10" onClick={() => setAssignAnalyticsUser(null)}>Cancel</Button>
                <Button type="button" className="h-10" onClick={saveUserAnalytics} disabled={assignAnalyticsSaving}>
                  {assignAnalyticsSaving ? 'Saving...' : 'Save assignments'}
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
                  <Label>Category</Label>
                  <Input
                    value={dashboardForm.category}
                    onChange={(e) => setDashboardForm((prev) => ({ ...prev, category: e.target.value }))}
                    placeholder="Sales, Operations, HR..."
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  {!editDashboard?.owner_user_id ? (
                    <>
                      <Label>Assignment Type *</Label>
                      <Select
                        value={dashboardForm.assignmentType}
                        onValueChange={(value) => setDashboardForm((prev) => ({ ...prev, assignmentType: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Choose assignment type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="group">Access Group</SelectItem>
                          <SelectItem value="individual">Individual</SelectItem>
                        </SelectContent>
                      </Select>
                    </>
                  ) : (
                    <>
                      <Label>Dashboard Type</Label>
                      <Input
                        value={getDashboardAssignmentLabel(editDashboard)}
                        readOnly
                        disabled
                        className="bg-muted/50"
                      />
                      <p className="text-xs text-muted-foreground">
                        Personal dashboard owned by the user. You can edit its details here as an admin.
                      </p>
                    </>
                  )}
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

              {!editDashboard?.owner_user_id && (dashboardForm.assignmentType === 'group' ? (
                <div className="space-y-3">
                  <Label>Access Groups *</Label>
                  <GroupMultiSelect
                    groups={accessGroups}
                    selectedIds={dashboardForm.groupIds}
                    onToggle={toggleDashboardGroup}
                    emptyLabel="Create an access group first, then assign this dashboard to it."
                  />
                  <p className="text-xs text-muted-foreground">
                    Users in the selected groups will see this dashboard under Analytics.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <Label>Users *</Label>
                  <SearchableUserMultiSelect
                    users={users}
                    selectedIds={dashboardForm.userIds}
                    onToggle={toggleDashboardUser}
                    placeholder="Search user by name or email..."
                  />
                  <p className="text-xs text-muted-foreground">
                    Only the selected users will see this dashboard under Analytics.
                  </p>
                </div>
              ))}

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
