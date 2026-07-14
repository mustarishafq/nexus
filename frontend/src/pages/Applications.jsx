import db, { API_ORIGIN } from '@/api/apiClient';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Bell, Calendar as CalendarIcon, Monitor, Plus, Upload, ImageIcon, RefreshCw, Copy, Check, ChevronsUpDown, GripVertical, ArrowUpDown, ExternalLink, PanelLeft, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
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
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { useApplicationLaunch } from '@/lib/ApplicationLaunchContext';
import { canViewApplicationUsage } from '@/lib/applicationUsage';
import { applicationNotificationsEnabled, normalizeNotificationEventMapping } from '@/lib/notificationEventMapping';
import { applicationCalendarSyncEnabled, normalizeCalendarEventMapping } from '@/lib/calendarEventMapping';
import ApplicationCard from '@/components/applications/ApplicationCard';
import ApplicationsNav from '@/components/applications/ApplicationsNav';
import ApplicationIntegrationsSection from '@/components/applications/ApplicationIntegrationsSection';
import ApplicationMcpConfigEditor from '@/components/applications/ApplicationMcpConfigEditor';
import ApplicationHealthConfigEditor from '@/components/applications/ApplicationHealthConfigEditor';
import SsoCredentialsDialog from '@/components/applications/SsoCredentialsDialog';
import ApplicationWhatsNewSheet from '@/components/applications/ApplicationWhatsNewSheet';
import { useApplicationReleaseNoteUnreadCounts } from '@/hooks/useApplicationReleaseNotes';
import {
  DEFAULT_BRAND_COLOR,
  extractDominantColorFromFile,
} from '@/lib/imageColor';
import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { APPLICATION_ENVIRONMENTS } from '@/lib/applicationEnvironment';
import { getApplicationStatus } from '@/lib/applicationStatus';
import { toast } from 'sonner';

const API_BASE_URL = API_ORIGIN;

const toAbsoluteUrl = (url) => {
  if (!url) return '';
  if (/^https?:\/\//i.test(url) || url.startsWith('data:') || url.startsWith('blob:')) {
    return url;
  }

  if (!API_BASE_URL) return url;

  return url.startsWith('/') ? `${API_BASE_URL}${url}` : `${API_BASE_URL}/${url}`;
};


function SortableReorderRow({ system }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: system.id });

  const config = getApplicationStatus(system.status);
  const StatusIcon = config.icon;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-4 rounded-xl border bg-card px-4 py-3 cursor-grab active:cursor-grabbing touch-none',
        config.border,
        isDragging && 'shadow-lg ring-2 ring-primary/30 bg-background z-10'
      )}
      {...attributes}
      {...listeners}
    >
      <GripVertical className="w-4 h-4 shrink-0 text-muted-foreground" />
      {system.icon_url ? (
        <img
          src={toAbsoluteUrl(system.icon_url)}
          alt={system.name}
          className="w-10 h-10 rounded-lg object-cover shrink-0"
        />
      ) : (
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold shrink-0"
          style={{ backgroundColor: system.color || '#6366f1' }}
        >
          {system.name?.[0]?.toUpperCase()}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{system.name}</p>
        <p className="text-xs text-muted-foreground truncate">
          {system.description?.trim() || 'No description provided'}
        </p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {applicationNotificationsEnabled(system) ? (
          <Badge variant="outline" className="text-[10px] gap-1 border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300">
            <Bell className="w-2.5 h-2.5" /> Notifications
          </Badge>
        ) : null}
        {applicationCalendarSyncEnabled(system) ? (
          <Badge variant="outline" className="text-[10px] gap-1 border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300">
            <CalendarIcon className="w-2.5 h-2.5" /> Calendar
          </Badge>
        ) : null}
        <Badge className={cn('text-[10px]', config.bg, config.color, 'border-0')}>
          <StatusIcon className="mr-1 h-2.5 w-2.5" /> {config.label}
        </Badge>
      </div>
    </div>
  );
}

const OPEN_MODE_OPTIONS = [
  {
    value: 'embedded',
    label: 'In-app browser',
    description: 'Keeps Nexus sidebar visible while browsing',
    icon: PanelLeft,
    badge: 'Default',
  },
  {
    value: 'new_tab',
    label: 'New browser tab',
    description: 'Opens in a separate tab outside Nexus',
    icon: ExternalLink,
  },
  {
    value: 'same_window',
    label: 'Same window',
    description: 'Navigates away from Nexus entirely',
    icon: Maximize2,
  },
];

function OpenModePreview({ mode }) {
  if (mode === 'embedded') {
    return (
      <div className="flex h-14 w-full overflow-hidden rounded-lg border border-border/80 bg-muted/30">
        <div className="flex w-5 shrink-0 flex-col gap-1 border-r border-border/60 bg-primary/10 p-1">
          <div className="h-1 w-full rounded-full bg-primary/30" />
          <div className="h-1 w-3/4 rounded-full bg-primary/20" />
          <div className="h-1 w-full rounded-full bg-primary/20" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1 p-1.5">
          <div className="h-2 rounded bg-muted-foreground/15" />
          <div className="flex-1 rounded-md border border-dashed border-primary/25 bg-background/80" />
        </div>
      </div>
    );
  }

  if (mode === 'new_tab') {
    return (
      <div className="flex h-14 w-full flex-col overflow-hidden rounded-lg border border-border/80 bg-muted/30">
        <div className="flex h-4 items-end gap-1 border-b border-border/60 bg-muted/50 px-1.5 pb-0">
          <div className="h-3 w-10 rounded-t-md border border-b-0 border-border/60 bg-background shadow-sm" />
          <div className="mb-0.5 ml-auto h-2 w-2 rounded-full bg-muted-foreground/20" />
        </div>
        <div className="flex flex-1 items-center justify-center p-1.5">
          <div className="flex h-full w-full items-center justify-center rounded-md border border-dashed border-muted-foreground/20 bg-background/80">
            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/40" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-14 w-full flex-col overflow-hidden rounded-lg border border-border/80 bg-background">
      <div className="h-3 border-b border-border/60 bg-muted/40" />
      <div className="flex flex-1 flex-col items-center justify-center gap-1 p-2">
        <Maximize2 className="h-3.5 w-3.5 text-muted-foreground/40" />
        <div className="h-1.5 w-2/3 rounded-full bg-muted-foreground/15" />
      </div>
    </div>
  );
}

function OpenModeSelector({ value, onChange }) {
  return (
    <div className="space-y-3">
      <Label>Open Link In</Label>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {OPEN_MODE_OPTIONS.map((option) => {
          const Icon = option.icon;
          const selected = value === option.value;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={cn(
                'flex flex-col gap-2.5 rounded-xl border p-3 text-left transition-all hover:border-primary/40',
                selected
                  ? 'border-primary bg-primary/5 ring-2 ring-primary/20 shadow-sm'
                  : 'border-border bg-card hover:bg-muted/30'
              )}
            >
              <OpenModePreview mode={option.value} />
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <Icon className={cn('h-3.5 w-3.5 shrink-0', selected ? 'text-primary' : 'text-muted-foreground')} />
                  <p className="text-sm font-medium leading-none">{option.label}</p>
                  {option.badge ? (
                    <Badge variant="secondary" className="h-4 px-1 text-[9px]">{option.badge}</Badge>
                  ) : null}
                </div>
                <p className="text-[11px] leading-snug text-muted-foreground">{option.description}</p>
              </div>
            </button>
          );
        })}
      </div>
      <p className="text-[11px] text-muted-foreground">
        Some sites block in-app embedding — use New browser tab for those.
      </p>
    </div>
  );
}

export default function Applications() {
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editSystem, setEditSystem] = useState(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoUrl, setLogoUrl] = useState('');
  const [brandColor, setBrandColor] = useState(DEFAULT_BRAND_COLOR);
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [mcpCatalogPath, setMcpCatalogPath] = useState('');
  const [mcpApiKey, setMcpApiKey] = useState('');
  const [mcpAuthMode, setMcpAuthMode] = useState('bearer');
  const [mcpEnabled, setMcpEnabled] = useState(false);
  const [healthCheckEnabled, setHealthCheckEnabled] = useState(true);
  const [healthCheckPath, setHealthCheckPath] = useState('/api/health');
  const [healthCheckMode, setHealthCheckMode] = useState('json_ok');
  const [authMode, setAuthMode] = useState('jwt');
  const [openMode, setOpenMode] = useState('embedded');
  const [status, setStatus] = useState('online');
  const [environment, setEnvironment] = useState('production');
  const [visibility, setVisibility] = useState('private');
  const [privateAllowedEmails, setPrivateAllowedEmails] = useState([]);
  const [privateUsersPickerOpen, setPrivateUsersPickerOpen] = useState(false);
  const [copiedApiKey, setCopiedApiKey] = useState(false);
  const [reorderDialogOpen, setReorderDialogOpen] = useState(false);
  const [orderedSystems, setOrderedSystems] = useState([]);
  const [pendingDeleteSystem, setPendingDeleteSystem] = useState(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [copiedDeleteName, setCopiedDeleteName] = useState(false);
  const [notificationConfig, setNotificationConfig] = useState(() => normalizeNotificationEventMapping());
  const [calendarConfig, setCalendarConfig] = useState(() => normalizeCalendarEventMapping());
  const [integrationResetKey, setIntegrationResetKey] = useState(0);
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

    try {
      const extractedColor = await extractDominantColorFromFile(file);
      setBrandColor(extractedColor);
    } catch {
      // Keep the current brand color if extraction fails.
    }

    try {
      const { file_url } = await db.integrations.Core.UploadFile({ file });
      setLogoUrl(file_url);
    } finally {
      setUploadingLogo(false);
    }
  };

  const openDialog = (system = null) => {
    setEditSystem(system);
    setLogoUrl(system?.icon_url || '');
    setBrandColor(system?.color || DEFAULT_BRAND_COLOR);
    setApiKey(system?.api_key || '');
    setBaseUrl(system?.base_url || '');
    setMcpCatalogPath(system?.mcp_catalog_path || '');
    setMcpApiKey(system?.mcp_api_key || '');
    setMcpAuthMode(system?.mcp_auth_mode || 'bearer');
    setMcpEnabled(Boolean(system?.mcp_enabled));
    setHealthCheckEnabled(system?.health_check_enabled !== false);
    setHealthCheckPath(system?.health_check_path || '/api/health');
    setHealthCheckMode(system?.health_check_mode || 'json_ok');
    setAuthMode(system?.auth_mode || 'jwt');
    setOpenMode(system?.open_mode || 'embedded');
    setStatus(system?.status || 'online');
    setEnvironment(system?.environment || 'production');
    setVisibility(system?.visibility || 'private');
    setPrivateAllowedEmails(Array.isArray(system?.private_allowed_user_emails) ? system.private_allowed_user_emails : []);
    setNotificationConfig(normalizeNotificationEventMapping(system?.notification_config));
    setCalendarConfig(normalizeCalendarEventMapping(system?.calendar_config));
    setIntegrationResetKey((current) => current + 1);
    setDialogOpen(true);
  };

  const { data: currentUser } = useQuery({
    queryKey: ['current-user'],
    queryFn: () => db.auth.me(),
    staleTime: 0,
    refetchOnMount: 'always',
    retry: false,
  });

  const { data: systems = [], isLoading } = useQuery({
    queryKey: ['applications'],
    queryFn: () => db.entities.Application.list('sort_order', 50),
  });

  const isAdmin = currentUser?.role === 'admin';
  const showUsage = canViewApplicationUsage(currentUser, systems);

  const openReorderDialog = () => {
    setOrderedSystems([...systems]);
    setReorderDialogOpen(true);
  };

  const closeReorderDialog = () => {
    setReorderDialogOpen(false);
    setOrderedSystems([...systems]);
  };

  const { data: rosterData } = useQuery({
    queryKey: ['user-roster'],
    queryFn: () => db.getUserRoster(),
    staleTime: 60000,
  });
  const users = Array.isArray(rosterData?.users) ? rosterData.users : [];
  const resetDialogState = () => {
    setDialogOpen(false);
    setEditSystem(null);
    setLogoUrl('');
    setBrandColor(DEFAULT_BRAND_COLOR);
    setApiKey('');
    setBaseUrl('');
    setMcpCatalogPath('');
    setMcpApiKey('');
    setMcpAuthMode('bearer');
    setMcpEnabled(false);
    setHealthCheckEnabled(true);
    setHealthCheckPath('/api/health');
    setHealthCheckMode('json_ok');
    setAuthMode('jwt');
    setOpenMode('embedded');
    setStatus('online');
    setEnvironment('production');
    setVisibility(currentUser?.role === 'admin' ? 'public' : 'private');
    setPrivateAllowedEmails([]);
    setPrivateUsersPickerOpen(false);
    setNotificationConfig(normalizeNotificationEventMapping());
    setCalendarConfig(normalizeCalendarEventMapping());
  };

  const createMut = useMutation({
    mutationFn: (data) => db.entities.Application.create(data),
    onSuccess: (created) => {
      queryClient.setQueryData(['applications'], (current) => {
        if (!Array.isArray(current)) return current;
        return [...current, created];
      });
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      resetDialogState();
    },
    onError: (error) => {
      toast.error(error?.data?.message || error.message || 'Failed to create application');
    },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => db.entities.Application.update(id, data),
    onSuccess: (updated) => {
      queryClient.setQueryData(['applications'], (current) => {
        if (!Array.isArray(current)) return current;
        return current.map((app) => (app.id === updated.id ? updated : app));
      });
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      resetDialogState();
    },
    onError: (error) => {
      toast.error(error?.data?.message || error.message || 'Failed to update application');
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id) => db.entities.Application.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      setPendingDeleteSystem(null);
      setDeleteConfirmName('');
      setCopiedDeleteName(false);
    },
  });

  const reorderMut = useMutation({
    mutationFn: (order) => db.reorderApplications(order),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['applications'] }),
  });

  const reorderSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setOrderedSystems((items) => {
      const oldIndex = items.findIndex((item) => item.id === active.id);
      const newIndex = items.findIndex((item) => item.id === over.id);
      return arrayMove(items, oldIndex, newIndex);
    });
  };

  const handleSaveOrder = () => {
    reorderMut.mutate(orderedSystems.map((system) => system.id), {
      onSuccess: () => setReorderDialogOpen(false),
    });
  };

  const closeDeleteDialog = () => {
    setPendingDeleteSystem(null);
    setDeleteConfirmName('');
    setCopiedDeleteName(false);
  };

  const copyDeleteName = () => {
    if (!pendingDeleteSystem?.name) return;
    navigator.clipboard.writeText(pendingDeleteSystem.name);
    setCopiedDeleteName(true);
    setTimeout(() => setCopiedDeleteName(false), 2000);
  };

  const confirmDelete = () => {
    if (!pendingDeleteSystem || deleteConfirmName !== pendingDeleteSystem.name) return;
    deleteMut.mutate(pendingDeleteSystem.id);
  };

  const canConfirmDelete = Boolean(
    pendingDeleteSystem && deleteConfirmName === pendingDeleteSystem.name
  );

  const [launching, setLaunching] = useState(null);
  const [ssoCredentialsSystem, setSsoCredentialsSystem] = useState(null);
  const [whatsNewSystem, setWhatsNewSystem] = useState(null);
  const { data: releaseNoteUnreadCounts = {} } = useApplicationReleaseNoteUnreadCounts();
  const { launchingId, launchWithAnimation } = useApplicationLaunch();

  const handleLaunch = async (system, options = {}) => {
    if (!system.is_enabled || launching === system.id || launchingId === system.id) return;

    setLaunching(system.id);

    try {
      await launchWithAnimation(system, navigate, options);
    } finally {
      setLaunching(null);
    }
  };

  const togglePrivateAccessEmail = (email) => {
    setPrivateAllowedEmails((prev) => {
      if (prev.includes(email)) {
        return prev.filter((item) => item !== email);
      }

      return [...prev, email];
    });
  };

  const selectableUsers = users
    .filter((user) => user?.email && user.email !== currentUser?.email)
    .sort((a, b) => (a.name || a.full_name || a.email).localeCompare(b.name || b.full_name || b.email));

  const handleSubmit = (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    const data = {
      name: form.get('name'),
      slug: form.get('slug'),
      description: form.get('description'),
      base_url: baseUrl || undefined,
      api_key: authMode === 'jwt' ? (apiKey || undefined) : undefined,
      mcp_catalog_path: mcpCatalogPath || undefined,
      mcp_api_key: mcpApiKey || undefined,
      mcp_auth_mode: mcpAuthMode || 'bearer',
      mcp_enabled: mcpEnabled,
      health_check_enabled: healthCheckEnabled,
      health_check_path: healthCheckPath || undefined,
      health_check_mode: healthCheckMode || undefined,
      auth_mode: authMode,
      open_mode: openMode,
      visibility: visibility,
      private_allowed_user_emails: visibility === 'private' ? privateAllowedEmails : [],
      status,
      environment,
      color: brandColor,
      icon_url: logoUrl || undefined,
      notification_config: notificationConfig,
      calendar_config: calendarConfig,
    };
    if (editSystem) {
      updateMut.mutate({ id: editSystem.id, data });
    } else {
      createMut.mutate(data);
    }
  };

  return (
    <div className="space-y-6">
      <Dialog open={reorderDialogOpen} onOpenChange={(open) => { if (!open) closeReorderDialog(); }}>
        <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden flex flex-col max-h-[85vh]">
          <DialogHeader className="px-6 pt-6 pb-3 border-b border-border/70">
            <DialogTitle>Reorder Applications</DialogTitle>
            <p className="text-sm text-muted-foreground font-normal pt-1">
              Drag to set the display order for everyone.
            </p>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
            <DndContext sensors={reorderSensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={orderedSystems.map((system) => system.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {orderedSystems.map((system) => (
                    <SortableReorderRow key={system.id} system={system} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>
          <div className="px-6 py-4 border-t border-border/70 bg-background flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={closeReorderDialog}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSaveOrder} disabled={reorderMut.isPending}>
              {reorderMut.isPending ? 'Saving...' : 'Save Order'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
        <div className="space-y-3">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
            <Monitor className="w-5 h-5 sm:w-6 sm:h-6 text-primary shrink-0" /> Application
          </h1>
          <div className="flex items-center justify-between gap-3">
            <ApplicationsNav showUsage={showUsage} />
            <div className="flex items-center gap-2 shrink-0">
          {isAdmin && systems.length > 1 && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0 sm:h-9 sm:w-auto sm:px-3 sm:gap-1.5"
              title="Reorder"
              onClick={openReorderDialog}
            >
              <ArrowUpDown className="w-4 h-4" />
              <span className="hidden sm:inline">Reorder</span>
            </Button>
          )}
          <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) { setEditSystem(null); setLogoUrl(''); setApiKey(''); setAuthMode('jwt'); setOpenMode('embedded'); setStatus('online'); setEnvironment('production'); setVisibility(currentUser?.role === 'admin' ? 'public' : 'private'); setPrivateAllowedEmails([]); setPrivateUsersPickerOpen(false); setNotificationConfig(normalizeNotificationEventMapping()); setCalendarConfig(normalizeCalendarEventMapping()); } }}>
            <DialogTrigger asChild>
              <Button className="h-8 w-8 p-0 sm:h-9 sm:w-auto sm:px-3 sm:gap-1.5" size="sm" title="Add" onClick={() => openDialog()}>
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Add</span>
              </Button>
            </DialogTrigger>
          <DialogContent className="sm:max-w-3xl h-[90vh] max-h-[90vh] p-0 gap-0 overflow-hidden flex flex-col">
            <DialogHeader className="px-6 pt-6 pb-3 border-b border-border/70">
              <DialogTitle>{editSystem ? 'Edit System' : 'Register New Application'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="flex flex-1 min-h-0 flex-col">
              <div className="flex-1 min-h-0 space-y-4 overflow-y-auto px-6 py-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                <Input
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="https://booking.company.com"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Application Type</Label>
                  <Select value={authMode} onValueChange={setAuthMode}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="jwt">JWT SSO</SelectItem>
                      <SelectItem value="redirect">Redirect URL</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Visibility</Label>
                  <Select
                    value={visibility}
                    onValueChange={setVisibility}
                    disabled={currentUser?.role !== 'admin'}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="public">Public</SelectItem>
                      <SelectItem value="private">Private</SelectItem>
                    </SelectContent>
                  </Select>
                  {currentUser?.role !== 'admin' && (
                    <p className="text-[11px] text-muted-foreground">Only admin can make systems public.</p>
                  )}
                </div>
              </div>
              <OpenModeSelector value={openMode} onChange={setOpenMode} />
              {authMode === 'jwt' && (
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
              )}
              {visibility === 'private' && (
                <div className="space-y-2">
                  <Label>Private Access Users</Label>
                  <Popover open={privateUsersPickerOpen} onOpenChange={setPrivateUsersPickerOpen}>
                    <PopoverTrigger asChild>
                      <Button type="button" variant="outline" role="combobox" className="w-full justify-between">
                        <span className="truncate">
                          {privateAllowedEmails.length === 0
                            ? 'Select users...'
                            : `${privateAllowedEmails.length} user(s) selected`}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[420px] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search user by name or email..." />
                        <CommandList>
                          <CommandEmpty>No user found.</CommandEmpty>
                          {selectableUsers.map((user) => {
                            const checked = privateAllowedEmails.includes(user.email);
                            const displayName = user.name || user.full_name || user.email;
                            return (
                              <CommandItem
                                key={user.id || user.email}
                                value={`${displayName} ${user.email}`}
                                onSelect={() => togglePrivateAccessEmail(user.email)}
                              >
                                <Check className={cn('mr-2 h-4 w-4', checked ? 'opacity-100' : 'opacity-0')} />
                                <span className="truncate">{displayName}</span>
                                <span className="text-xs text-muted-foreground truncate">({user.email})</span>
                              </CommandItem>
                            );
                          })}
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  {privateAllowedEmails.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {privateAllowedEmails.slice(0, 6).map((email) => (
                        <Badge key={email} variant="secondary" className="text-xs">{email}</Badge>
                      ))}
                      {privateAllowedEmails.length > 6 && (
                        <Badge variant="outline" className="text-xs">+{privateAllowedEmails.length - 6} more</Badge>
                      )}
                    </div>
                  )}
                  <p className="text-[11px] text-muted-foreground">Owner always has access. Selected users can view this private app.</p>
                </div>
              )}
              {/* Logo Upload */}
              <div className="space-y-2">
                <Label>System Logo</Label>
                <div className="flex items-center gap-3">
                  {logoUrl ? (
                    <img src={toAbsoluteUrl(logoUrl)} alt="logo" className="w-12 h-12 rounded-xl object-cover border border-border" />
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
              <ApplicationHealthConfigEditor
                applicationId={editSystem?.id}
                enabled={healthCheckEnabled}
                onEnabledChange={setHealthCheckEnabled}
                healthPath={healthCheckPath}
                onHealthPathChange={setHealthCheckPath}
                healthMode={healthCheckMode}
                onHealthModeChange={setHealthCheckMode}
                baseUrl={baseUrl}
                resetKey={integrationResetKey}
              />
              <ApplicationMcpConfigEditor
                applicationId={editSystem?.id}
                enabled={mcpEnabled}
                onEnabledChange={setMcpEnabled}
                catalogPath={mcpCatalogPath}
                onCatalogPathChange={setMcpCatalogPath}
                mcpApiKey={mcpApiKey}
                onMcpApiKeyChange={setMcpApiKey}
                mcpAuthMode={mcpAuthMode}
                onMcpAuthModeChange={setMcpAuthMode}
                baseUrl={baseUrl}
                apiKey={apiKey}
                webhookSecret={notificationConfig?.webhook_secret}
                notificationConfig={notificationConfig}
                resetKey={integrationResetKey}
              />
              <ApplicationIntegrationsSection
                notificationConfig={notificationConfig}
                onNotificationConfigChange={setNotificationConfig}
                calendarConfig={calendarConfig}
                onCalendarConfigChange={setCalendarConfig}
                applicationId={editSystem?.id}
                resetKey={integrationResetKey}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={status} onValueChange={setStatus}>
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
                  <Label>Environment</Label>
                  <Select value={environment} onValueChange={setEnvironment}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {APPLICATION_ENVIRONMENTS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">
                    Marks non-production apps with a badge on the grid.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Brand Color</Label>
                  <Input
                    name="color"
                    value={brandColor}
                    onChange={(event) => setBrandColor(event.target.value)}
                    type="color"
                    className="h-9"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Auto-detected from the uploaded logo. Override here if needed.
                  </p>
                </div>
              </div>
              </div>
              <div className="px-6 py-4 border-t border-border/70 bg-background">
                <Button type="submit" className="w-full">
                  {editSystem ? 'Update System' : 'Register System'}
                </Button>
              </div>
            </form>
          </DialogContent>
          </Dialog>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Systems Grid */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-muted border-t-primary rounded-full animate-spin" />
        </div>
      ) : systems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground bg-card rounded-2xl border border-border">
          <Monitor className="w-12 h-12 mb-4 opacity-20" />
          <p className="font-medium">No applications</p>
          <p className="text-sm mt-1">
            {currentUser?.role === 'admin'
              ? 'Register your first system to get started'
              : 'You have not been granted access to any systems yet'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-7 lg:gap-4">
          {systems.map((system, i) => {
            const canManageSystem = currentUser?.role === 'admin' || Number(system.created_by_user_id) === Number(currentUser?.id);

            return (
              <div
                key={system.id}
                className="rounded-xl border border-border bg-card p-2 shadow-sm transition-shadow hover:shadow-md sm:p-2.5"
              >
                <ApplicationCard
                  system={system}
                  index={i}
                  canManageSystem={canManageSystem}
                  launching={launching ?? launchingId}
                  footerOutside
                  onLaunch={handleLaunch}
                  onEdit={openDialog}
                  onDelete={(selectedSystem) => {
                    setDeleteConfirmName('');
                    setPendingDeleteSystem(selectedSystem);
                  }}
                  onManageSsoCredentials={setSsoCredentialsSystem}
                  onWhatsNew={setWhatsNewSystem}
                  unreadReleaseNotes={Number(releaseNoteUnreadCounts?.[String(system.id)] || 0)}
                />
              </div>
            );
          })}
        </div>
      )}

      <AlertDialog open={Boolean(pendingDeleteSystem)} onOpenChange={(open) => !open && closeDeleteDialog()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this application?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDeleteSystem
                ? `"${pendingDeleteSystem.name}" will be permanently removed. Users will lose access to this application.`
                : 'This application will be permanently removed.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-1">
            <Label htmlFor="delete-confirm-name">
              Type <span className="font-medium text-foreground">{pendingDeleteSystem?.name}</span> to confirm
            </Label>
            <div className="flex gap-2">
              <Input
                id="delete-confirm-name"
                value={deleteConfirmName}
                onChange={(e) => setDeleteConfirmName(e.target.value)}
                placeholder={pendingDeleteSystem?.name || 'Application name'}
                autoComplete="off"
                spellCheck={false}
                disabled={deleteMut.isPending}
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={copyDeleteName}
                disabled={!pendingDeleteSystem?.name || deleteMut.isPending}
                title="Copy application name"
                className="shrink-0"
              >
                {copiedDeleteName ? (
                  <Check className="w-4 h-4 text-success" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">Copy the name and paste it above to confirm.</p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMut.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleteMut.isPending || !canConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMut.isPending ? 'Deleting...' : 'Delete Application'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <SsoCredentialsDialog
        application={ssoCredentialsSystem}
        open={Boolean(ssoCredentialsSystem)}
        onOpenChange={(open) => {
          if (!open) setSsoCredentialsSystem(null);
        }}
      />

      <ApplicationWhatsNewSheet
        application={whatsNewSystem}
        open={Boolean(whatsNewSystem)}
        onOpenChange={(open) => {
          if (!open) setWhatsNewSystem(null);
        }}
        canManage={Boolean(
          whatsNewSystem
          && (currentUser?.role === 'admin' || Number(whatsNewSystem.created_by_user_id) === Number(currentUser?.id))
        )}
      />
    </div>
  );
}