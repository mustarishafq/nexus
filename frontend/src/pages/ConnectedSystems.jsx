import db from '@/api/base44Client';
import React, { useState, useMemo } from 'react';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Monitor, Plus, Wifi, WifiOff, Wrench, AlertTriangle, Trash2, Pencil, Upload, ImageIcon, RefreshCw, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';

const statusConfig = {
  online: { icon: Wifi, color: 'text-success', bg: 'bg-success/10', border: 'border-success/30' },
  offline: { icon: WifiOff, color: 'text-destructive', bg: 'bg-destructive/10', border: 'border-destructive/30' },
  maintenance: { icon: Wrench, color: 'text-warning', bg: 'bg-warning/10', border: 'border-warning/30' },
  degraded: { icon: AlertTriangle, color: 'text-warning', bg: 'bg-warning/10', border: 'border-warning/30' },
};

export default function ConnectedSystems() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editSystem, setEditSystem] = useState(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoUrl, setLogoUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [copiedApiKey, setCopiedApiKey] = useState(false);
  const queryClient = useQueryClient();

  const generateApiKey = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    let key = '';
    for (let i = 0; i < 32; i++) {
      key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setApiKey(key);
  };

  const copyApiKey = () => {
    navigator.clipboard.writeText(apiKey);
    setCopiedApiKey(true);
    setTimeout(() => setCopiedApiKey(false), 2000);
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    const { file_url } = await db.integrations.Core.UploadFile({ file });
    setLogoUrl(file_url);
    setUploadingLogo(false);
  };

  const openDialog = (system = null) => {
    setEditSystem(system);
    setLogoUrl(system?.icon_url || '');
    setApiKey(system?.api_key || '');
    setDialogOpen(true);
  };

  const { data: currentUser, isSuccess: userLoaded } = useQuery({
    queryKey: ['current-user'],
    queryFn: () => db.auth.me(),
    staleTime: 0,
    refetchOnMount: 'always',
    retry: false,
  });

  const { data: systems = [], isLoading } = useQuery({
    queryKey: ['connected-systems'],
    queryFn: () => db.entities.ConnectedSystem.list('-created_date', 50),
  });

  const { data: accessRecord = null, isSuccess: accessLoaded } = useQuery({
    queryKey: ['user-system-access', currentUser?.email],
    queryFn: () =>
      db.entities.UserSystemAccess.filter({ user_email: currentUser.email })
        .then(list => list[0] ?? null),
    enabled: userLoaded && !!currentUser?.email && currentUser?.role !== 'admin',
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchInterval: 20000,
  });

  const visibleSystems = useMemo(() => {
    // Not yet loaded — show nothing to avoid a flash of all systems
    if (!userLoaded) return [];
    if (currentUser?.role === 'admin') return systems;
    // Wait for access record to load before showing anything
    if (!accessLoaded) return [];
    // No record means no explicit permission set — show nothing (safe default)
    if (!accessRecord) return [];
    const allowed = new Set(accessRecord.allowed_system_slugs || []);
    return systems.filter(s => allowed.has(s.slug));
  }, [systems, accessRecord, currentUser, userLoaded, accessLoaded]);

  const createMut = useMutation({
    mutationFn: (data) => db.entities.ConnectedSystem.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['connected-systems'] }); setDialogOpen(false); setEditSystem(null); setLogoUrl(''); setApiKey(''); },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => db.entities.ConnectedSystem.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['connected-systems'] }); setDialogOpen(false); setEditSystem(null); setLogoUrl(''); setApiKey(''); },
  });

  const deleteMut = useMutation({
    mutationFn: (id) => db.entities.ConnectedSystem.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['connected-systems'] }),
  });

  const [launching, setLaunching] = useState(null);
  const handleLaunch = async (system) => {
    if (!system.is_enabled || launching === system.id) return;
    setLaunching(system.id);
    try {
      const { launch_url } = await db.launchSystem(system.id);
      window.location.href = launch_url;
    } catch (err) {
      alert(err.message);
      setLaunching(null);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    const data = {
      name: form.get('name'),
      slug: form.get('slug'),
      description: form.get('description'),
      base_url: form.get('base_url'),
      api_key: apiKey || undefined,
      status: form.get('status'),
      color: form.get('color'),
      icon_url: logoUrl || undefined,
    };
    if (editSystem) {
      updateMut.mutate({ id: editSystem.id, data });
    } else {
      createMut.mutate(data);
    }
  };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Monitor className="w-6 h-6 text-primary" /> Connected Systems
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{visibleSystems.length} systems registered</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) { setEditSystem(null); setLogoUrl(''); setApiKey(''); } }}>
          {currentUser?.role === 'admin' && (
            <DialogTrigger asChild>
              <Button className="gap-1.5" size="sm" onClick={() => openDialog()}>
                <Plus className="w-4 h-4" /> Add System
              </Button>
            </DialogTrigger>
          )}
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editSystem ? 'Edit System' : 'Register New System'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Name *</Label>
                  <Input name="name" defaultValue={editSystem?.name} placeholder="Booking System" required />
                </div>
                <div className="space-y-2">
                  <Label>Slug *</Label>
                  <Input name="slug" defaultValue={editSystem?.slug} placeholder="booking" required />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input name="description" defaultValue={editSystem?.description} placeholder="Room booking management" />
              </div>
              <div className="space-y-2">
                <Label>Base URL</Label>
                <Input name="base_url" defaultValue={editSystem?.base_url} placeholder="https://booking.company.com" />
              </div>
              <div className="space-y-2">
                <Label>API Key <span className="text-muted-foreground font-normal">(shared secret for SSO)</span></Label>
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <Input
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="super-secret-key-min-32-chars"
                      autoComplete="off"
                      spellCheck={false}
                      type="password"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={generateApiKey}
                    title="Generate new API key"
                    className="px-3"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={copyApiKey}
                    disabled={!apiKey}
                    title="Copy API key"
                    className="px-3"
                  >
                    {copiedApiKey ? (
                      <Check className="w-4 h-4 text-success" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">Must match the key configured in the target system. Required to enable auto-login.</p>
              </div>
              {/* Logo Upload */}
              <div className="space-y-2">
                <Label>System Logo</Label>
                <div className="flex items-center gap-3">
                  {logoUrl ? (
                    <img src={logoUrl} alt="logo" className="w-12 h-12 rounded-xl object-cover border border-border" />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center border border-border">
                      <ImageIcon className="w-5 h-5 text-muted-foreground" />
                    </div>
                  )}
                  <label className="cursor-pointer">
                    <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                    <Button type="button" variant="outline" size="sm" className="gap-1.5 pointer-events-none" disabled={uploadingLogo}>
                      <Upload className="w-3.5 h-3.5" />
                      {uploadingLogo ? 'Uploading...' : 'Upload Logo'}
                    </Button>
                  </label>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select name="status" defaultValue={editSystem?.status || 'online'}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="online">Online</SelectItem>
                      <SelectItem value="offline">Offline</SelectItem>
                      <SelectItem value="maintenance">Maintenance</SelectItem>
                      <SelectItem value="degraded">Degraded</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Brand Color</Label>
                  <Input name="color" defaultValue={editSystem?.color || '#6366f1'} type="color" className="h-9" />
                </div>
              </div>
              <Button type="submit" className="w-full">
                {editSystem ? 'Update System' : 'Register System'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </motion.div>

      {/* Systems Grid */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-muted border-t-primary rounded-full animate-spin" />
        </div>
      ) : visibleSystems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground bg-card rounded-2xl border border-border">
          <Monitor className="w-12 h-12 mb-4 opacity-20" />
          <p className="font-medium">No connected systems</p>
          <p className="text-sm mt-1">
            {currentUser?.role === 'admin'
              ? 'Register your first system to get started'
              : 'You have not been granted access to any systems yet'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {visibleSystems.map((system, i) => {
            const config = statusConfig[system.status] || statusConfig.online;
            const StatusIcon = config.icon;
            return (
              <motion.div
                key={system.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className={cn(
                  "bg-card rounded-2xl border overflow-hidden transition-all group relative flex flex-col",
                  config.border,
                  system.is_enabled
                    ? "cursor-pointer hover:shadow-xl hover:-translate-y-0.5"
                    : "opacity-60 cursor-not-allowed"
                )}
                onClick={() => handleLaunch(system)}
              >
                {/* Status badge */}
                <Badge className={cn("absolute top-3 right-3 text-[10px] z-10", config.bg, config.color, "border-0")}>
                  <StatusIcon className="w-2.5 h-2.5 mr-1" /> {system.status}
                </Badge>

                {/* Logo + name section */}
                <div className="flex flex-col items-center pt-8 pb-4 px-5">
                  <div className="relative mb-3">
                    {system.icon_url ? (
                      <img
                        src={system.icon_url}
                        alt={system.name}
                        className="w-16 h-16 rounded-2xl object-cover shadow-md group-hover:shadow-lg transition-shadow"
                      />
                    ) : (
                      <div
                        className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-bold text-2xl shadow-md group-hover:shadow-lg transition-shadow"
                        style={{ backgroundColor: system.color || '#6366f1' }}
                      >
                        {system.name?.[0]?.toUpperCase()}
                      </div>
                    )}
                    {launching === system.id && (
                      <div className="absolute inset-0 rounded-2xl bg-black/40 flex items-center justify-center">
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}
                  </div>
                  <h3 className="font-semibold text-sm text-center leading-tight">{system.name}</h3>
                  <p className="text-xs text-muted-foreground text-center line-clamp-2">
                    {system.description?.trim() || 'No description provided'}
                  </p>
                </div>

                {/* Launch hover overlay */}
                {system.is_enabled && launching !== system.id && (
                  <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl pointer-events-none" />
                )}

                {/* Footer */}
                <div className="flex items-center justify-between px-4 py-2.5 border-t border-border bg-muted/30">
                  <span className="text-[10px] text-muted-foreground">
                    Added {formatDistanceToNow(new Date(system.created_date), { addSuffix: true })}
                  </span>
                  {currentUser?.role === 'admin' && (
                    <div className="flex gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        title="Edit"
                        onClick={(e) => { e.stopPropagation(); openDialog(system); }}
                      >
                        <Pencil className="w-3 h-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive"
                        title="Delete"
                        onClick={(e) => { e.stopPropagation(); deleteMut.mutate(system.id); }}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}