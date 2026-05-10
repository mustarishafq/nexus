// @ts-nocheck
import db from '@/api/base44Client';
import React, { useEffect, useState, useRef } from 'react';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, X, Shield, UserCheck, UserX, UserPlus, Upload, Search, Filter, ChevronLeft, ChevronRight, Users as UsersIcon, Download, Edit, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

export default function UserManagement() {
  const [savingUser, setSavingUser] = useState(null);
  const [approvingUser, setApprovingUser] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [newUserRole, setNewUserRole] = useState('user');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [accessDialogUser, setAccessDialogUser] = useState(null);
  const [editUser, setEditUser] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editSaving, setEditSaving] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const csvRef = useRef(null);
  const queryClient = useQueryClient();

  const { data: usersRaw = [], isLoading: loadingUsers } = useQuery({
    queryKey: ['users'],
    queryFn: () => db.entities.User.list('-created_date', 500),
  });

  const { data: systemsRaw = [] } = useQuery({
    queryKey: ['connected-systems'],
    queryFn: () => db.entities.ConnectedSystem.list('-created_date', 50),
  });

  const { data: accessListRaw = [] } = useQuery({
    queryKey: ['user-system-access'],
    queryFn: () => db.entities.UserSystemAccess.list(),
  });

  const users = Array.isArray(usersRaw) ? usersRaw : [];
  const systems = Array.isArray(systemsRaw) ? systemsRaw : [];
  const publicSystems = systems.filter((system) => system.visibility === 'public');
  const accessList = Array.isArray(accessListRaw) ? accessListRaw : [];

  useEffect(() => {
    setPage(1);
  }, [search, roleFilter, statusFilter]);

  const [overrides, setOverrides] = useState({});

  const getAllowedSlugs = (userEmail) => {
    if (overrides[userEmail] !== undefined) return overrides[userEmail];
    const record = accessList.find(a => a.user_email === userEmail);
    if (!record) return new Set(publicSystems.map(s => s.slug));
    const validPublicSlugs = new Set(publicSystems.map((system) => system.slug));
    return new Set((record.allowed_system_slugs || []).filter((slug) => validPublicSlugs.has(slug)));
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

  const toggleSystem = (userEmail, slug) => {
    const current = getAllowedSlugs(userEmail);
    const next = new Set(current);
    if (next.has(slug)) next.delete(slug);
    else next.add(slug);
    setOverrides(prev => ({ ...prev, [userEmail]: next }));
  };

  const saveUserAccess = async (userEmail) => {
    setSavingUser(userEmail);
    const slugs = [...(getAllowedSlugs(userEmail))];
    const existing = accessList.find(a => a.user_email === userEmail);
    if (existing) {
      await db.entities.UserSystemAccess.update(existing.id, { allowed_system_slugs: slugs });
    } else {
      await db.entities.UserSystemAccess.create({ user_email: userEmail, allowed_system_slugs: slugs });
    }
    queryClient.invalidateQueries({ queryKey: ['user-system-access'] });
    setOverrides(prev => { const n = { ...prev }; delete n[userEmail]; return n; });
    setSavingUser(null);
    if (accessDialogUser?.email === userEmail) {
      setAccessDialogUser(null);
    }
    toast.success(`Access updated for ${userEmail}`);
  };

  const hasChanges = (userEmail) => overrides[userEmail] !== undefined;

  const setAllAccess = (userEmail, enabled) => {
    setOverrides(prev => ({
      ...prev,
      [userEmail]: new Set(enabled ? publicSystems.map(system => system.slug) : []),
    }));
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
        is_approved: true,
      });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setCreateOpen(false);
      setNewUserRole('user');
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
      password: '',
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
      };
      if (editForm.password) {
        updateData.password = editForm.password;
      }
      await db.entities.User.update(editUser.id, updateData);
      queryClient.invalidateQueries({ queryKey: ['users'] });
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

  const currentAccessUser = accessDialogUser ? {
    ...accessDialogUser,
    allowedSlugs: getAllowedSlugs(accessDialogUser.email),
    changed: hasChanges(accessDialogUser.email),
  } : null;

  const clearFilters = () => {
    setSearch('');
    setRoleFilter('all');
    setStatusFilter('all');
  };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary" /> User Management
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Search, filter, approve, and manage access for large user sets.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input ref={csvRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFileSelect} />
          <Button variant="outline" size="sm" className="gap-1.5" onClick={downloadSampleCsv}>
            <Download className="w-4 h-4" /> Sample CSV
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => csvRef.current?.click()} disabled={importing}>
            <Upload className="w-4 h-4" /> {importing ? 'Importing...' : 'Upload CSV'}
          </Button>
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
          { label: 'Admins', value: stats.admins },
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
                    <TableHead>Access</TableHead>
                    <TableHead className="text-right pr-6">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedUsers.map((user, index) => {
                    const allowedSlugs = getAllowedSlugs(user.email);
                    return (
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
                          <p className="text-sm text-muted-foreground">
                            {allowedSlugs.size === publicSystems.length
                              ? 'All public apps'
                              : `${allowedSlugs.size}/${publicSystems.length || 0} public apps`}
                          </p>
                        </TableCell>
                        <TableCell className="pr-6">
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" size="sm" className="gap-1" onClick={() => openEditUser(user)}>
                              <Edit className="w-3 h-3" />
                              Edit
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => setAccessDialogUser(user)}>
                              Manage Access
                            </Button>
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
                    );
                  })}
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

      {/* Create User Dialog */}
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
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={creating}>{creating ? 'Creating...' : 'Create User'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!accessDialogUser} onOpenChange={(open) => !open && setAccessDialogUser(null)}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              Manage Access{currentAccessUser ? ` - ${currentAccessUser.full_name || currentAccessUser.email}` : ''}
            </DialogTitle>
          </DialogHeader>

          {currentAccessUser && (
            <div className="space-y-4 mt-2">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant={currentAccessUser.role === 'admin' ? 'default' : 'secondary'}>{currentAccessUser.role || 'user'}</Badge>
                <Badge variant={currentAccessUser.is_approved ? 'default' : 'outline'}>
                  {currentAccessUser.is_approved ? 'approved' : 'pending'}
                </Badge>
                <span>{currentAccessUser.email}</span>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setAllAccess(currentAccessUser.email, true)} disabled={publicSystems.length === 0}>
                  Select all
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setAllAccess(currentAccessUser.email, false)} disabled={publicSystems.length === 0}>
                  Clear all
                </Button>
              </div>

              {publicSystems.length === 0 ? (
                <p className="text-sm text-muted-foreground">No public apps registered yet.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[55vh] overflow-auto pr-1">
                  {publicSystems.map(system => {
                    const allowed = currentAccessUser.allowedSlugs.has(system.slug);

                    return (
                      <button
                        key={system.slug}
                        type="button"
                        onClick={() => toggleSystem(currentAccessUser.email, system.slug)}
                        className={cn(
                          'flex items-center gap-3 rounded-xl border px-3 py-2 text-left text-sm transition-all',
                          allowed
                            ? 'border-primary/30 bg-primary/10 text-primary'
                            : 'border-border bg-muted/40 text-muted-foreground'
                        )}
                      >
                        {system.icon_url ? (
                          <img src={system.icon_url} alt="" className="w-8 h-8 rounded-lg object-cover" />
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

              <div className="flex items-center justify-between gap-3 pt-2 border-t border-border">
                <p className="text-xs text-muted-foreground">
                  {currentAccessUser.changed ? 'You have unsaved access changes.' : 'Access matches the saved configuration.'}
                </p>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" onClick={() => setAccessDialogUser(null)}>
                    Close
                  </Button>
                  <Button
                    type="button"
                    onClick={() => saveUserAccess(currentAccessUser.email)}
                    disabled={savingUser === currentAccessUser.email || !currentAccessUser.changed}
                    className="gap-1.5"
                  >
                    <Check className="w-4 h-4" />
                    {savingUser === currentAccessUser.email ? 'Saving...' : 'Save changes'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}