// @ts-nocheck
import db from '@/api/apiClient';
import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BarChart3,
  Edit,
  ExternalLink,
  MoreHorizontal,
  Plus,
  Trash2,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/lib/AuthContext';
import { Link } from 'react-router-dom';
import { useMetaTags } from '@/hooks/useMetaTags';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const UNCATEGORIZED = 'Uncategorized';

function isPersonalDashboard(dashboard, userId) {
  return dashboard.owner_user_id && String(dashboard.owner_user_id) === String(userId);
}

function groupDashboardsByCategory(dashboards) {
  const groups = new Map();

  dashboards.forEach((dashboard) => {
    const category = dashboard.category?.trim() || UNCATEGORIZED;
    if (!groups.has(category)) {
      groups.set(category, []);
    }
    groups.get(category).push(dashboard);
  });

  return [...groups.entries()]
    .sort(([left], [right]) => {
      if (left === UNCATEGORIZED) return 1;
      if (right === UNCATEGORIZED) return -1;
      return left.localeCompare(right);
    })
    .map(([category, items]) => ({
      category,
      items: [...items].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name)),
    }));
}

function buildPersonalForm(dashboard = null) {
  return {
    name: dashboard?.name || '',
    publicUrl: dashboard?.public_url || '',
    category: dashboard?.category || '',
    sortOrder: dashboard?.sort_order ?? 0,
  };
}

function getSelectedDashboardId(category, items, selectedByCategory) {
  const stored = selectedByCategory[category];
  if (stored && items.some((item) => String(item.id) === String(stored))) {
    return String(stored);
  }
  return items[0] ? String(items[0].id) : '';
}

export default function Analytics() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === 'admin';
  const isMobile = useIsMobile();

  const { data: metabaseDashboards = [], isLoading } = useQuery({
    queryKey: ['metabase-dashboards'],
    queryFn: () => db.entities.MetabaseDashboard.list('sort_order', 100),
  });

  const [activeCategory, setActiveCategory] = useState('');
  const [selectedByCategory, setSelectedByCategory] = useState({});
  const [personalDialogOpen, setPersonalDialogOpen] = useState(false);
  const [editPersonalDashboard, setEditPersonalDashboard] = useState(null);
  const [personalForm, setPersonalForm] = useState(buildPersonalForm());
  const [personalSaving, setPersonalSaving] = useState(false);
  const [pendingDeleteDashboard, setPendingDeleteDashboard] = useState(null);

  const visibleDashboards = Array.isArray(metabaseDashboards) ? metabaseDashboards : [];
  const categorizedDashboards = useMemo(
    () => groupDashboardsByCategory(visibleDashboards),
    [visibleDashboards]
  );

  const activeCategoryGroup = categorizedDashboards.find(
    (group) => group.category === activeCategory
  ) || categorizedDashboards[0];

  const categoryDashboards = activeCategoryGroup?.items || [];
  const selectedDashboardId = getSelectedDashboardId(
    activeCategoryGroup?.category || '',
    categoryDashboards,
    selectedByCategory
  );

  const selectedDashboard = categoryDashboards.find(
    (dashboard) => String(dashboard.id) === String(selectedDashboardId)
  ) || categoryDashboards[0];

  useEffect(() => {
    if (categorizedDashboards.length === 0) {
      setActiveCategory('');
      return;
    }

    const stillExists = categorizedDashboards.some((group) => group.category === activeCategory);
    if (!stillExists) {
      setActiveCategory(categorizedDashboards[0].category);
    }
  }, [categorizedDashboards, activeCategory]);

  useEffect(() => {
    if (!activeCategoryGroup?.category || !selectedDashboard) return;

    setSelectedByCategory((prev) => {
      const current = prev[activeCategoryGroup.category];
      if (current === String(selectedDashboard.id)) return prev;
      return {
        ...prev,
        [activeCategoryGroup.category]: String(selectedDashboard.id),
      };
    });
  }, [activeCategoryGroup?.category, selectedDashboard?.id]);

  const deleteDashboardMut = useMutation({
    mutationFn: (id) => db.entities.MetabaseDashboard.delete(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['metabase-dashboards'] });
      await queryClient.invalidateQueries({ queryKey: ['metabase-dashboards-admin'] });
      toast.success('Dashboard removed');
    },
    onError: (err) => {
      toast.error(err?.data?.message || err.message || 'Failed to remove dashboard');
    },
  });

  useMetaTags({
    title: 'Analytics - EMZI Nexus Brain',
    description: 'Metabase analytics dashboards organized by category',
  });

  const openPersonalDialog = (dashboard = null) => {
    setEditPersonalDashboard(dashboard);
    setPersonalForm(buildPersonalForm(dashboard));
    setPersonalDialogOpen(true);
  };

  const closePersonalDialog = () => {
    setPersonalDialogOpen(false);
    setEditPersonalDashboard(null);
    setPersonalForm(buildPersonalForm());
  };

  const savePersonalDashboard = async (e) => {
    e.preventDefault();
    if (!personalForm.name.trim()) {
      toast.error('Dashboard name is required');
      return;
    }
    if (!personalForm.publicUrl.trim()) {
      toast.error('Public Metabase URL is required');
      return;
    }

    setPersonalSaving(true);
    try {
      const payload = {
        name: personalForm.name.trim(),
        public_url: personalForm.publicUrl.trim(),
        category: personalForm.category.trim() || null,
        sort_order: Number(personalForm.sortOrder) || 0,
      };

      if (editPersonalDashboard) {
        await db.entities.MetabaseDashboard.update(editPersonalDashboard.id, payload);
        toast.success(`Updated "${payload.name}"`);
      } else {
        await db.entities.MetabaseDashboard.create(payload);
        toast.success(`Added "${payload.name}"`);
      }

      await queryClient.invalidateQueries({ queryKey: ['metabase-dashboards'] });
      setActiveCategory(payload.category?.trim() || UNCATEGORIZED);
      closePersonalDialog();
    } catch (err) {
      toast.error(err?.data?.message || err.message || 'Failed to save dashboard');
    } finally {
      setPersonalSaving(false);
    }
  };

  const confirmDeletePersonalDashboard = () => {
    if (!pendingDeleteDashboard || deleteDashboardMut.isPending) return;
    deleteDashboardMut.mutate(pendingDeleteDashboard.id, {
      onSettled: () => setPendingDeleteDashboard(null),
    });
  };

  const handleCategoryChange = (category) => {
    setActiveCategory(category);
  };

  const handleDashboardChange = (dashboardId) => {
    if (!activeCategoryGroup?.category) return;
    setSelectedByCategory((prev) => ({
      ...prev,
      [activeCategoryGroup.category]: dashboardId,
    }));
  };

  const canManageSelectedDashboard = selectedDashboard && (
    isPersonalDashboard(selectedDashboard, user?.id)
    || (isAdmin && selectedDashboard.owner_user_id)
  );

  const hasDashboardPreview = !isLoading && visibleDashboards.length > 0;

  const renderManageActions = () => {
    if (!canManageSelectedDashboard) return null;

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" title="Dashboard actions">
            <MoreHorizontal className="w-4 h-4" />
            <span className="sr-only">Dashboard actions</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={() => openPersonalDialog(selectedDashboard)}>
            <Edit className="w-4 h-4 mr-2" />
            Edit dashboard
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={() => setPendingDeleteDashboard(selectedDashboard)}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Remove dashboard
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  const renderCompactToolbar = () => (
    <div className="shrink-0 flex items-center gap-2 border-b border-border/60 bg-muted/20 px-3 py-2 sm:px-4">
      <Select
        value={activeCategoryGroup?.category || ''}
        onValueChange={handleCategoryChange}
      >
        <SelectTrigger className="h-9 w-[38%] min-w-[7rem] max-w-[11rem] sm:max-w-[12rem] text-sm shrink-0">
          <SelectValue placeholder="Category" />
        </SelectTrigger>
        <SelectContent>
          {categorizedDashboards.map(({ category, items }) => (
            <SelectItem key={category} value={category}>
              {category} ({items.length})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={String(selectedDashboard?.id || '')}
        onValueChange={handleDashboardChange}
      >
        <SelectTrigger className="h-9 flex-1 min-w-0 text-sm">
          <SelectValue placeholder="Dashboard" />
        </SelectTrigger>
        <SelectContent>
          {categoryDashboards.map((dashboard) => (
            <SelectItem key={dashboard.id} value={String(dashboard.id)}>
              <span className="truncate">{dashboard.name}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex items-center gap-1 shrink-0">
        {selectedDashboard?.public_url && (
          <Button asChild variant="outline" size="icon" className="h-9 w-9 shrink-0" title="Open in Metabase">
            <a href={selectedDashboard.public_url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-4 h-4" />
              <span className="sr-only">Open in Metabase</span>
            </a>
          </Button>
        )}
        <Button
          variant="outline"
          size="icon"
          className="h-9 w-9 shrink-0"
          title="Add personal dashboard"
          onClick={() => openPersonalDialog()}
        >
          <Plus className="w-4 h-4" />
          <span className="sr-only">Add personal dashboard</span>
        </Button>
        {renderManageActions()}
      </div>
    </div>
  );

  const renderPageHeader = () => (
    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="shrink-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
            <BarChart3 className="w-5 h-5 sm:w-6 sm:h-6 text-primary shrink-0" />
            Analytics
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Browse dashboards by category from your access groups and individual assignments.
          </p>
        </div>
        {!hasDashboardPreview && !isLoading && (
          <Button
            size={isMobile ? 'default' : 'sm'}
            className="gap-1.5 shrink-0 h-10 w-full sm:w-auto"
            onClick={() => openPersonalDialog()}
          >
            <Plus className="w-4 h-4" />
            {isMobile ? 'Add dashboard' : 'Add personal dashboard'}
          </Button>
        )}
      </div>
    </motion.div>
  );

  return (
    <div
      className={cn(
        hasDashboardPreview
          ? 'flex h-full min-h-0 flex-col overflow-hidden gap-4'
          : 'space-y-6'
      )}
    >
      {renderPageHeader()}

      {isLoading ? (
        <Card className="rounded-2xl border-border/70">
          <CardContent className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-muted border-t-primary rounded-full animate-spin" />
          </CardContent>
        </Card>
      ) : visibleDashboards.length === 0 ? (
        <Card className="rounded-2xl border-border/70">
          <CardContent className="px-4 sm:px-6 py-12 sm:py-16 text-center space-y-3">
            <BarChart3 className="w-10 h-10 text-muted-foreground/50 mx-auto" />
            <p className="text-sm font-medium">No analytics dashboards available</p>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              {isAdmin
                ? 'Add Metabase dashboards in User Management and assign them to access groups or individuals.'
                : 'No dashboards have been shared with you yet. You can add your own personal dashboards.'}
            </p>
            {isAdmin ? (
              <Button asChild variant="outline" className="mt-2 w-full sm:w-auto">
                <Link to="/admin/users">Manage dashboards</Link>
              </Button>
            ) : (
              <Button variant="outline" className="mt-2 w-full sm:w-auto" onClick={() => openPersonalDialog()}>
                Add personal dashboard
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-1 min-h-0 flex-col overflow-hidden rounded-xl border border-border/70 bg-card">
          {renderCompactToolbar()}
          {selectedDashboard ? (
            <iframe
              key={selectedDashboard.id}
              title={selectedDashboard.name}
              src={selectedDashboard.public_url}
              className="flex-1 min-h-0 w-full border-0 bg-background block"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          ) : (
            <div className="flex flex-1 min-h-[200px] items-center justify-center px-4 text-center text-sm text-muted-foreground">
              No dashboards in this category yet.
            </div>
          )}
        </div>
      )}

      <Dialog open={personalDialogOpen} onOpenChange={(open) => !open && closePersonalDialog()}>
        <DialogContent className="w-[calc(100vw-1.5rem)] sm:max-w-lg max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-left pr-6">
              {editPersonalDashboard ? `Edit - ${editPersonalDashboard.name}` : 'Add Personal Dashboard'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={savePersonalDashboard} className="space-y-4">
            <div className="space-y-2">
              <Label>Dashboard Name *</Label>
              <Input
                value={personalForm.name}
                onChange={(e) => setPersonalForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="My Sales View"
                className="h-10"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Public Metabase URL *</Label>
              <Input
                value={personalForm.publicUrl}
                onChange={(e) => setPersonalForm((prev) => ({ ...prev, publicUrl: e.target.value }))}
                placeholder="https://metabase.example.com/public/dashboard/..."
                className="h-10"
                required
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Input
                  value={personalForm.category}
                  onChange={(e) => setPersonalForm((prev) => ({ ...prev, category: e.target.value }))}
                  placeholder="Sales, Operations..."
                  className="h-10"
                />
                <p className="text-xs text-muted-foreground">Shows as a category tab on this page.</p>
              </div>
              <div className="space-y-2">
                <Label>Sort Order</Label>
                <Input
                  type="number"
                  min="0"
                  value={personalForm.sortOrder}
                  onChange={(e) => setPersonalForm((prev) => ({ ...prev, sortOrder: e.target.value }))}
                  className="h-10"
                />
              </div>
            </div>
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
              <Button type="button" variant="outline" className="h-10" onClick={closePersonalDialog}>
                Cancel
              </Button>
              <Button type="submit" className="h-10" disabled={personalSaving}>
                {personalSaving ? 'Saving...' : editPersonalDashboard ? 'Save Dashboard' : 'Add Dashboard'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(pendingDeleteDashboard)} onOpenChange={(open) => !open && setPendingDeleteDashboard(null)}>
        <AlertDialogContent className="w-[calc(100vw-1.5rem)] sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove dashboard?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDeleteDashboard
                ? `"${pendingDeleteDashboard.name}" will be permanently removed.`
                : 'This dashboard will be permanently removed.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <AlertDialogCancel className="mt-0 h-10">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="h-10 bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                confirmDeletePersonalDashboard();
              }}
            >
              Remove Dashboard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
