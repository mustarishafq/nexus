// @ts-nocheck
import db from '@/api/apiClient';
import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Check, Loader2, X, Gamepad2, Calendar, Users, Newspaper, Clock3, Sparkles, Trash2, BarChart3, Monitor, Megaphone, Wifi } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
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
import UserAvatar from '@/components/users/UserAvatar';
import { getDisplayName } from '@/lib/profile';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getRoleLabel, ROLES } from '@/lib/roles';
import { cn } from '@/lib/utils';

function useDebouncedValue(value, delay = 250) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function usersCountLabel(count) {
  const n = Number(count) || 0;
  return `${n} user${n === 1 ? '' : 's'}`;
}

function isProtectedRole(role) {
  return role?.slug === ROLES.ADMIN || role?.slug === ROLES.HR || role?.slug === ROLES.USER;
}

function roleDeleteBlockedReason(role) {
  if (isProtectedRole(role)) {
    return 'The Admin, HR, and User roles cannot be deleted.';
  }
  if ((role?.users_count || 0) > 0) {
    return 'Reassign the users in this role to another role first before deleting it.';
  }
  return null;
}

const MODULE_ICONS = {
  games: Gamepad2,
  calendar: Calendar,
  people: Users,
  feed: Newspaper,
  attendance: Clock3,
  gamification: Sparkles,
  analytics: BarChart3,
  applications: Monitor,
  broadcast: Megaphone,
  network: Wifi,
};

function currentRoleName(user) {
  return getRoleLabel(user?.access_role?.slug, user?.access_role?.name)
    || getRoleLabel(user?.role)
    || 'another role';
}

function RoleMembersSection({ role, roles, active }) {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState({});
  const [pendingAdd, setPendingAdd] = useState(null);
  const [pendingRemove, setPendingRemove] = useState(null);
  const [destinationRoleId, setDestinationRoleId] = useState('');
  const debouncedQuery = useDebouncedValue(query.trim());

  useEffect(() => {
    if (!active) {
      setQuery('');
      setSelected({});
      setPendingAdd(null);
      setPendingRemove(null);
      setDestinationRoleId('');
    }
  }, [active, role?.id]);

  const { data: membersPayload, isLoading: loadingMembers } = useQuery({
    queryKey: ['role-members', role?.id],
    queryFn: () => db.roles.users(role.id),
    enabled: Boolean(active && role?.id),
  });

  const { data: searchResults = [], isFetching: searching } = useQuery({
    queryKey: ['role-user-search', role?.id, debouncedQuery],
    queryFn: () => db.roles.searchUsers(role.id, debouncedQuery, 10),
    enabled: Boolean(active && role?.id && debouncedQuery.length >= 1),
  });

  const members = membersPayload?.data || [];
  const memberIds = useMemo(() => new Set(members.map((user) => String(user.id))), [members]);
  const otherRoles = useMemo(
    () => (roles || []).filter((item) => item.is_active && String(item.id) !== String(role?.id)),
    [roles, role?.id]
  );

  const invalidateMembership = () => {
    queryClient.invalidateQueries({ queryKey: ['roles'] });
    queryClient.invalidateQueries({ queryKey: ['role-options'] });
    queryClient.invalidateQueries({ queryKey: ['role-members', role?.id] });
    queryClient.invalidateQueries({ queryKey: ['users'] });
  };

  const assignUsers = useMutation({
    mutationFn: (userIds) => db.roles.assignUsers(role.id, userIds),
    onSuccess: () => {
      invalidateMembership();
      setSelected({});
      setQuery('');
      setPendingAdd(null);
      toast.success('Role assignment updated');
    },
    onError: (err) => toast.error(err?.data?.message || err.message || 'Could not assign users'),
  });

  const reassignUser = useMutation({
    mutationFn: ({ userId, roleId }) => db.roles.reassignUser(role.id, userId, roleId),
    onSuccess: () => {
      invalidateMembership();
      setPendingRemove(null);
      setDestinationRoleId('');
      toast.success('User moved to another role');
    },
    onError: (err) => toast.error(err?.data?.message || err.message || 'Could not update role'),
  });

  const selectedUsers = Object.values(selected);
  const toggleSelected = (user) => {
    if (user.in_role || memberIds.has(String(user.id))) return;
    setSelected((current) => {
      const next = { ...current };
      if (next[user.id]) {
        delete next[user.id];
      } else {
        next[user.id] = user;
      }
      return next;
    });
  };

  const requestAdd = () => {
    const users = selectedUsers.filter((user) => !user.in_role && !memberIds.has(String(user.id)));
    if (users.length === 0) {
      toast.error('Select at least one user to add');
      return;
    }
    const replacements = users.filter((user) => String(user.access_role?.id || '') !== String(role.id));
    if (replacements.length > 0) {
      setPendingAdd(users);
      return;
    }
    assignUsers.mutate(users.map((user) => user.id));
  };

  const confirmAdd = () => {
    if (!pendingAdd?.length) return;
    assignUsers.mutate(pendingAdd.map((user) => user.id));
  };

  const confirmRemove = () => {
    if (!pendingRemove || !destinationRoleId) return;
    reassignUser.mutate({ userId: pendingRemove.id, roleId: Number(destinationRoleId) });
  };

  const replacementCopy = (users) => {
    const roleName = getRoleLabel(role.slug, role.name);
    if (users.length === 1) {
      const person = users[0];
      return `${getDisplayName(person)} is currently assigned to ${currentRoleName(person)}. Assigning them to ${roleName} will replace their current role. Continue?`;
    }
    const lines = users.map((person) => `${getDisplayName(person)} is currently assigned to ${currentRoleName(person)}.`);
    return `${lines.join(' ')} Assigning them to ${roleName} will replace their current role. Continue?`;
  };

  return (
    <>
      <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="role-member-search">Users</Label>
              <Input
                id="role-member-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') event.preventDefault();
                }}
                placeholder="Search name or email..."
                autoComplete="off"
              />
              {searching ? (
                <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching...
                </div>
              ) : null}
              {debouncedQuery && !searching && searchResults.length === 0 ? (
                <p className="text-xs text-muted-foreground">No user found.</p>
              ) : null}
              {searchResults.length > 0 ? (
                <div className="overflow-hidden rounded-xl border bg-background shadow-sm">
                  {searchResults.map((user) => {
                    const alreadyAssigned = user.in_role || memberIds.has(String(user.id));
                    const checked = alreadyAssigned || Boolean(selected[user.id]);
                    return (
                      <div
                        key={user.id}
                        role={alreadyAssigned ? undefined : 'button'}
                        tabIndex={alreadyAssigned ? -1 : 0}
                        onClick={() => toggleSelected(user)}
                        onKeyDown={(event) => {
                          if (alreadyAssigned) return;
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            toggleSelected(user);
                          }
                        }}
                        className={cn(
                          'flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors',
                          alreadyAssigned ? 'cursor-default opacity-50' : 'cursor-pointer hover:bg-muted/60'
                        )}
                      >
                        <span className={cn(
                          'flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border',
                          checked
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-primary'
                        )}>
                          {checked ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
                        </span>
                        <UserAvatar user={user} className="h-8 w-8" fallbackClassName="bg-muted text-xs" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{getDisplayName(user)}</p>
                          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                        </div>
                        {alreadyAssigned ? (
                          <span className="text-[11px] text-muted-foreground">Added</span>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : null}
              <div className="flex justify-end">
                <Button
                  type="button"
                  size="sm"
                  disabled={!role?.is_active || selectedUsers.length === 0 || assignUsers.isPending}
                  onClick={requestAdd}
                >
                  {assignUsers.isPending ? 'Adding…' : `Add to ${getRoleLabel(role?.slug, role?.name)}`}
                </Button>
              </div>
              {!role?.is_active ? (
                <p className="text-xs text-muted-foreground">This role is inactive and cannot be assigned.</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Assigned users</p>
              {loadingMembers ? (
                <div className="flex justify-center py-6">
                  <div className="w-6 h-6 border-2 border-muted border-t-primary rounded-full animate-spin" />
                </div>
              ) : members.length === 0 ? (
                <p className="text-sm text-muted-foreground">No one is assigned to this role yet.</p>
              ) : (
                <div className="max-h-52 space-y-2 overflow-y-auto">
                  {members.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-primary"
                    >
                      <UserAvatar user={user} className="h-8 w-8" fallbackClassName="bg-primary/15 text-xs" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{getDisplayName(user)}</p>
                        <p className="truncate text-xs opacity-70">{user.email}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setPendingRemove(user);
                          setDestinationRoleId(otherRoles[0] ? String(otherRoles[0].id) : '');
                        }}
                        className="shrink-0 rounded-md p-0.5 hover:bg-primary/15"
                        title="Remove from role"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
      </div>

      <AlertDialog open={Boolean(pendingAdd)} onOpenChange={(next) => !next && setPendingAdd(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace current role?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingAdd ? replacementCopy(pendingAdd) : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmAdd} disabled={assignUsers.isPending}>
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(pendingRemove)}
        onOpenChange={(next) => {
          if (!next) {
            setPendingRemove(null);
            setDestinationRoleId('');
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Assign another role</AlertDialogTitle>
            <AlertDialogDescription>
              Users must have a role. Assign this user to another role before removing them from {getRoleLabel(role?.slug, role?.name)}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {otherRoles.length > 0 ? (
            <div className="space-y-2">
              <Label>New role</Label>
              <Select value={destinationRoleId} onValueChange={setDestinationRoleId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a role" />
                </SelectTrigger>
                <SelectContent>
                  {otherRoles.map((item) => (
                    <SelectItem key={item.id} value={String(item.id)}>
                      {getRoleLabel(item.slug, item.name)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              There is no other active role available. Create or activate another role first.
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRemove}
              disabled={!destinationRoleId || reassignUser.isPending}
            >
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default function RolesPanel() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', is_active: true });
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [draftKeys, setDraftKeys] = useState([]);
  const [pendingDeleteRole, setPendingDeleteRole] = useState(null);
  const [deleteError, setDeleteError] = useState('');

  const { data: rolesPayload, isLoading: loadingRoles } = useQuery({
    queryKey: ['roles'],
    queryFn: () => db.roles.list(),
  });

  const { data: permissionPayload, isLoading: loadingPermissions } = useQuery({
    queryKey: ['permissions'],
    queryFn: () => db.permissions.list(),
  });

  const roles = rolesPayload?.data || [];
  const modules = (permissionPayload?.data || []).filter((module) => module.key !== 'admin');

  useEffect(() => {
    if (!selectedRoleId && roles.length > 0) {
      setSelectedRoleId(String(roles[0].id));
    }
  }, [roles, selectedRoleId]);

  const selectedRole = useMemo(
    () => roles.find((role) => String(role.id) === String(selectedRoleId)) || null,
    [roles, selectedRoleId]
  );

  const dialogRole = useMemo(
    () => (editingRole ? roles.find((role) => String(role.id) === String(editingRole.id)) || editingRole : null),
    [roles, editingRole]
  );

  useEffect(() => {
    setDraftKeys(selectedRole?.permission_keys || []);
  }, [selectedRole]);

  const saveRole = useMutation({
    mutationFn: async () => {
      const body = {
        name: form.name.trim(),
        description: form.description.trim() || null,
      };
      if (editingRole) {
        if (editingRole.slug !== ROLES.ADMIN) {
          body.is_active = form.is_active;
        }
        return db.roles.update(editingRole.id, body);
      }
      return db.roles.create({ ...body, is_active: true });
    },
    onSuccess: (role) => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      queryClient.invalidateQueries({ queryKey: ['role-options'] });
      setDialogOpen(false);
      setSelectedRoleId(String(role.id));
      toast.success(editingRole ? 'Role updated' : 'Role created');
    },
    onError: (err) => toast.error(err?.data?.message || err.message || 'Could not save role'),
  });

  const savePermissions = useMutation({
    mutationFn: (keys) => db.roles.syncPermissions(selectedRole.id, keys),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      toast.success('Permissions saved');
    },
    onError: (err) => toast.error(err?.data?.message || err.message || 'Could not save permissions'),
  });

  const deleteRole = useMutation({
    mutationFn: (role) => db.roles.destroy(role.id),
    onSuccess: (_data, role) => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      queryClient.invalidateQueries({ queryKey: ['role-options'] });
      queryClient.invalidateQueries({ queryKey: ['role-members'] });
      if (String(selectedRoleId) === String(role.id)) {
        setSelectedRoleId('');
      }
      setPendingDeleteRole(null);
      toast.success('Role deleted');
    },
    onError: (err) => toast.error(err?.data?.message || err.message || 'Could not delete role'),
  });

  const openCreate = () => {
    setEditingRole(null);
    setForm({ name: '', description: '', is_active: true });
    setDialogOpen(true);
  };

  const openEdit = (role) => {
    setEditingRole(role);
    setForm({
      name: getRoleLabel(role.slug, role.name) || '',
      description: role.description || '',
      is_active: Boolean(role.is_active),
    });
    setDialogOpen(true);
  };

  const toggleKey = (key, checked) => {
    setDraftKeys((current) => {
      if (checked) {
        return current.includes(key) ? current : [...current, key];
      }
      return current.filter((item) => item !== key);
    });
  };

  const permissionsDirty = useMemo(() => {
    const current = [...(selectedRole?.permission_keys || [])].sort();
    const next = [...draftKeys].sort();
    return JSON.stringify(current) !== JSON.stringify(next);
  }, [selectedRole, draftKeys]);

  const renderRoleActions = (role, sizeClass = 'h-8 w-8', justifyClass = 'justify-center') => {
    return (
      <div className={cn('flex shrink-0 items-center gap-1', justifyClass)}>
        <Button variant="ghost" size="icon" className={sizeClass} onClick={() => openEdit(role)}>
          <Pencil className="w-3.5 h-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            sizeClass,
            'text-red-500 hover:bg-red-500/15 hover:text-red-400 dark:text-red-400 dark:hover:bg-red-400/15 dark:hover:text-red-300'
          )}
          disabled={deleteRole.isPending}
          title="Delete role"
          onClick={() => {
            const blocked = roleDeleteBlockedReason(role);
            if (blocked) {
              setDeleteError(blocked);
              return;
            }
            setPendingDeleteRole(role);
          }}
        >
          <Trash2 className="h-4 w-4" strokeWidth={2.25} />
        </Button>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <Card className="rounded-2xl border-border/70">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium">Roles</p>
              <CardDescription className="text-sm">
                Create roles and assign people from Edit, or from the Users tab.
              </CardDescription>
            </div>
            <Button size="sm" className="gap-1.5 shrink-0 w-full sm:w-auto min-h-[40px]" onClick={openCreate}>
              <Plus className="w-4 h-4" /> Create Role
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loadingRoles ? (
            <div className="flex justify-center py-12">
              <div className="w-6 h-6 border-2 border-muted border-t-primary rounded-full animate-spin" />
            </div>
          ) : roles.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-muted-foreground">
              No roles yet.
            </div>
          ) : (
            <>
              <div className="md:hidden divide-y divide-border">
                {roles.map((role) => (
                  <div key={role.id} className="px-4 py-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium leading-tight">{getRoleLabel(role.slug, role.name)}</p>
                        {role.description ? (
                          <p className="text-xs text-muted-foreground mt-1">{role.description}</p>
                        ) : null}
                      </div>
                      {renderRoleActions(role, 'h-9 w-9', 'justify-end')}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted-foreground">
                      <Badge variant={role.is_active ? 'secondary' : 'outline'}>
                        {role.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                      <span>{usersCountLabel(role.users_count)}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="hidden md:block overflow-x-auto">
                <Table className="table-fixed">
                  <TableHeader className="bg-muted/40">
                    <TableRow>
                      <TableHead className="pl-6 w-[22%]">Role</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="w-[140px] text-center">Users</TableHead>
                      <TableHead className="w-[140px] text-center">Status</TableHead>
                      <TableHead className="w-[140px] pr-6 text-center">Manage</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {roles.map((role) => (
                      <TableRow key={role.id}>
                        <TableCell className="pl-6 font-medium">{getRoleLabel(role.slug, role.name)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          <span className="line-clamp-2">{role.description || '—'}</span>
                        </TableCell>
                        <TableCell className="text-center">{usersCountLabel(role.users_count)}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant={role.is_active ? 'secondary' : 'outline'}>
                            {role.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell className="pr-6">
                          {renderRoleActions(role)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/70">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium">Role Permissions</p>
              <CardDescription className="text-sm">
                Tick or untick permissions, then click Save permissions. People already signed in with this role need a refresh before it takes effect.
              </CardDescription>
            </div>
            <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
              <SelectTrigger className="w-full sm:w-[220px]">
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                {roles.map((role) => (
                  <SelectItem key={role.id} value={String(role.id)}>{getRoleLabel(role.slug, role.name)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingPermissions || !selectedRole ? (
            <div className="flex justify-center py-10">
              <div className="w-6 h-6 border-2 border-muted border-t-primary rounded-full animate-spin" />
            </div>
          ) : (
            <>
              <Accordion type="multiple" className="grid w-full grid-cols-1 items-start gap-2.5 sm:grid-cols-2">
                {modules.map((module) => {
                  const enabledCount = module.permissions.filter((permission) => draftKeys.includes(permission.key)).length;
                  const ModuleIcon = MODULE_ICONS[module.key];
                  const allEnabled = enabledCount === module.permissions.length && module.permissions.length > 0;

                  return (
                    <AccordionItem
                      key={module.key}
                      value={module.key}
                      className="overflow-hidden rounded-xl border border-border bg-background px-1 shadow-sm transition-colors hover:border-primary/30 hover:bg-muted/20 data-[state=open]:border-primary/35 data-[state=open]:shadow-md"
                    >
                      <AccordionTrigger className="px-2 py-3 text-sm font-medium hover:no-underline">
                        <span className="flex min-w-0 flex-1 items-center gap-2.5 pr-2">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                            {ModuleIcon ? <ModuleIcon className="h-4 w-4" /> : null}
                          </span>
                          <span className="truncate">{module.name}</span>
                          <Badge
                            variant={allEnabled ? 'secondary' : 'outline'}
                            className="ml-auto h-5 shrink-0 px-1.5 text-[11px] font-normal"
                          >
                            {enabledCount}/{module.permissions.length}
                          </Badge>
                        </span>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="mb-2 overflow-hidden rounded-lg border bg-popover p-1 shadow-sm">
                          {module.permissions.map((permission) => {
                            const checked = draftKeys.includes(permission.key);
                            return (
                              <button
                                key={permission.key}
                                type="button"
                                onClick={() => toggleKey(permission.key, !checked)}
                                className={cn(
                                  'relative flex w-full cursor-pointer select-none items-center rounded-md py-2.5 pl-9 pr-3 text-left text-sm outline-none transition-colors',
                                  checked
                                    ? 'bg-accent text-accent-foreground'
                                    : 'text-foreground hover:bg-muted/70'
                                )}
                              >
                                <span className={cn(
                                  'absolute left-2 flex h-5 w-5 items-center justify-center rounded-md border',
                                  checked
                                    ? 'border-primary bg-primary text-primary-foreground'
                                    : 'border-muted-foreground/35 bg-background'
                                )}>
                                  {checked ? <Check className="h-3.5 w-3.5" strokeWidth={2.75} /> : null}
                                </span>
                                {permission.name}
                              </button>
                            );
                          })}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
              <div className="flex justify-end">
                <Button
                  disabled={!permissionsDirty || savePermissions.isPending}
                  onClick={() => savePermissions.mutate(draftKeys)}
                >
                  {savePermissions.isPending ? 'Saving…' : 'Save permissions'}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingRole ? 'Edit role' : 'Create role'}</DialogTitle>
            <DialogDescription>
              {editingRole
                ? 'Update this role and assign people. Each person can have only one role.'
                : 'New roles start as Active. You can assign people after creating the role.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Textarea
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                rows={3}
              />
            </div>
            {editingRole ? (
              <RoleMembersSection
                role={dialogRole}
                roles={roles}
                active={dialogOpen}
              />
            ) : null}
            {editingRole && editingRole.slug !== ROLES.ADMIN ? (
              <div className="flex items-center justify-between rounded-xl border px-3 py-2">
                <div>
                  <Label htmlFor="role-active">Active</Label>
                  {form.is_active && (dialogRole?.users_count || 0) > 0 ? (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Reassign users before deactivating this role.
                    </p>
                  ) : null}
                </div>
                <Switch
                  id="role-active"
                  checked={form.is_active}
                  disabled={form.is_active && (dialogRole?.users_count || 0) > 0}
                  onCheckedChange={(checked) => setForm((current) => ({ ...current, is_active: checked }))}
                />
              </div>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button
                type="button"
                disabled={saveRole.isPending}
                onClick={() => {
                  if (!form.name.trim()) {
                    toast.error('Enter a role name');
                    return;
                  }
                  saveRole.mutate();
                }}
              >
                {saveRole.isPending ? 'Saving…' : editingRole ? 'Save' : 'Create'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(pendingDeleteRole)} onOpenChange={(open) => !open && setPendingDeleteRole(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this role?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDeleteRole
                ? `${getRoleLabel(pendingDeleteRole.slug, pendingDeleteRole.name)} will be removed. This cannot be undone.`
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-600/90"
              disabled={deleteRole.isPending}
              onClick={() => pendingDeleteRole && deleteRole.mutate(pendingDeleteRole)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(deleteError)} onOpenChange={(open) => !open && setDeleteError('')}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cannot delete this role</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteError}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setDeleteError('')}>OK</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
