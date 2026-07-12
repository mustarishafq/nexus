import db from '@/api/apiClient';
import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { Megaphone, Pencil, Plus, Sparkles, Trash2, Wrench } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  glassDialogFaintText,
  glassDialogIconButton,
  glassDialogInputStyles,
  glassDialogMutedText,
  glassDialogPanelStyles,
  glassDialogTitleText,
  glassPanelStyles,
} from '@/components/layout/glassStyles';
import {
  invalidatePlatformReleaseNoteQueries,
  PLATFORM_RELEASE_NOTES_QUERY_KEY,
} from '@/hooks/usePlatformReleaseNotes';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const CATEGORY_META = {
  feature: {
    label: 'Feature',
    className: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/20 dark:text-emerald-300',
    icon: Sparkles,
  },
  fix: {
    label: 'Fix',
    className: 'bg-amber-500/15 text-amber-700 border-amber-500/20 dark:text-amber-300',
    icon: Wrench,
  },
  improvement: {
    label: 'Improvement',
    className: 'bg-sky-500/15 text-sky-700 border-sky-500/20 dark:text-sky-300',
    icon: Megaphone,
  },
};

const EMPTY_FORM = {
  title: '',
  body: '',
  version: '',
  category: 'feature',
  is_published: true,
};

function categoryBadge(category) {
  const meta = CATEGORY_META[category] || CATEGORY_META.feature;
  const Icon = meta.icon;
  return (
    <Badge variant="outline" className={cn('gap-1 font-normal', meta.className)}>
      <Icon className="h-3 w-3" />
      {meta.label}
    </Badge>
  );
}

function noteTimestamp(note) {
  const raw = note.published_date || note.published_at || note.created_date || note.created_at;
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return formatDistanceToNow(date, { addSuffix: true });
}

export default function PlatformWhatsNewSheet({
  open,
  onOpenChange,
  canManage = false,
}) {
  const queryClient = useQueryClient();
  const [managing, setManaging] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingNote, setEditingNote] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);

  const { data: notes = [], isLoading } = useQuery({
    queryKey: [...PLATFORM_RELEASE_NOTES_QUERY_KEY, canManage],
    queryFn: () => db.entities.PlatformReleaseNote.list('-published_at', 100),
    enabled: open,
  });

  const publishedNotes = useMemo(
    () => notes.filter((note) => note.is_published !== false),
    [notes],
  );
  const displayNotes = canManage && managing ? notes : publishedNotes;

  useEffect(() => {
    if (!open) {
      setManaging(false);
      setForm(EMPTY_FORM);
      setEditingNote(null);
      setPendingDelete(null);
    }
  }, [open]);

  const handleOpenChange = (nextOpen) => {
    if (!nextOpen) {
      db.markPlatformReleaseNotesRead()
        .then(() => invalidatePlatformReleaseNoteQueries(queryClient))
        .catch(() => {});
    }
    onOpenChange?.(nextOpen);
  };

  const saveMut = useMutation({
    mutationFn: async (payload) => {
      if (editingNote?.id) {
        return db.entities.PlatformReleaseNote.update(editingNote.id, payload);
      }
      return db.entities.PlatformReleaseNote.create(payload);
    },
    onSuccess: () => {
      invalidatePlatformReleaseNoteQueries(queryClient);
      setForm(EMPTY_FORM);
      setEditingNote(null);
      toast.success(editingNote ? 'Release note updated.' : 'Release note published.');
    },
    onError: (error) => {
      toast.error(error.message || 'Unable to save release note.');
    },
  });

  const deleteMut = useMutation({
    mutationFn: (noteId) => db.entities.PlatformReleaseNote.delete(noteId),
    onSuccess: () => {
      invalidatePlatformReleaseNoteQueries(queryClient);
      setPendingDelete(null);
      toast.success('Release note deleted.');
    },
    onError: (error) => {
      toast.error(error.message || 'Unable to delete release note.');
    },
  });

  const startEdit = (note) => {
    setManaging(true);
    setEditingNote(note);
    setForm({
      title: note.title || '',
      body: note.body || '',
      version: note.version || '',
      category: note.category || 'feature',
      is_published: note.is_published !== false,
    });
  };

  const resetForm = () => {
    setEditingNote(null);
    setForm(EMPTY_FORM);
  };

  const submitForm = (event) => {
    event.preventDefault();
    if (!form.title.trim()) {
      toast.error('Title is required.');
      return;
    }
    saveMut.mutate({
      title: form.title.trim(),
      body: form.body.trim() || null,
      version: form.version.trim() || null,
      category: form.category,
      is_published: Boolean(form.is_published),
    });
  };

  return (
    <>
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent
          overlayClassName="bg-black/25 backdrop-blur-sm"
          className={cn(
            'flex w-full flex-col gap-0 border-l p-0 sm:max-w-lg',
            'rounded-bl-2xl sm:rounded-none',
            glassPanelStyles,
          )}
        >
          <SheetHeader className="border-b border-border/50 px-6 py-5 text-left">
            <SheetTitle className={cn('flex items-center gap-2', glassDialogTitleText)}>
              <Sparkles className="h-4 w-4 text-primary" />
              What&apos;s New
            </SheetTitle>
            <SheetDescription className={glassDialogMutedText}>
              Release notes for EMZI Nexus
            </SheetDescription>
            {canManage && (
              <div className="pt-2">
                <Button
                  type="button"
                  size="sm"
                  variant={managing ? 'secondary' : 'outline'}
                  className="gap-1.5 border-border/60 bg-background/40 backdrop-blur-sm"
                  onClick={() => {
                    setManaging((value) => !value);
                    if (managing) resetForm();
                  }}
                >
                  {managing ? 'Done managing' : (
                    <>
                      <Plus className="h-3.5 w-3.5" />
                      Manage notes
                    </>
                  )}
                </Button>
              </div>
            )}
          </SheetHeader>

          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
            {canManage && managing && (
              <form
                onSubmit={submitForm}
                className={cn('space-y-3 rounded-xl border p-4', glassDialogPanelStyles)}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className={cn('text-sm font-medium', glassDialogTitleText)}>
                    {editingNote ? 'Edit release note' : 'Add release note'}
                  </p>
                  {editingNote && (
                    <Button type="button" variant="ghost" size="sm" className={glassDialogIconButton} onClick={resetForm}>
                      Cancel edit
                    </Button>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="platform-release-note-title">Title</Label>
                  <Input
                    id="platform-release-note-title"
                    value={form.title}
                    onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                    placeholder="Dashboard calendar refresh"
                    maxLength={255}
                    className={glassDialogInputStyles}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="platform-release-note-body">Details</Label>
                  <Textarea
                    id="platform-release-note-body"
                    value={form.body}
                    onChange={(e) => setForm((prev) => ({ ...prev, body: e.target.value }))}
                    placeholder="What changed and why it matters…"
                    rows={4}
                    className={glassDialogInputStyles}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="platform-release-note-version">Version</Label>
                    <Input
                      id="platform-release-note-version"
                      value={form.version}
                      onChange={(e) => setForm((prev) => ({ ...prev, version: e.target.value }))}
                      placeholder="2.1.0"
                      maxLength={64}
                      className={glassDialogInputStyles}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Category</Label>
                    <Select
                      value={form.category}
                      onValueChange={(value) => setForm((prev) => ({ ...prev, category: value }))}
                    >
                      <SelectTrigger className={glassDialogInputStyles}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="feature">Feature</SelectItem>
                        <SelectItem value="fix">Fix</SelectItem>
                        <SelectItem value="improvement">Improvement</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className={cn('flex items-center justify-between rounded-lg border px-3 py-2', glassPanelStyles)}>
                  <div>
                    <p className={cn('text-sm font-medium', glassDialogTitleText)}>Published</p>
                    <p className={cn('text-xs', glassDialogMutedText)}>Visible to all Nexus users</p>
                  </div>
                  <Switch
                    checked={form.is_published}
                    onCheckedChange={(checked) => setForm((prev) => ({ ...prev, is_published: checked }))}
                  />
                </div>

                <Button type="submit" className="w-full" disabled={saveMut.isPending}>
                  {saveMut.isPending
                    ? 'Saving…'
                    : editingNote
                      ? 'Update note'
                      : form.is_published
                        ? 'Publish note'
                        : 'Save draft'}
                </Button>
              </form>
            )}

            {isLoading ? (
              <div className="flex justify-center py-12">
                <div className="h-7 w-7 animate-spin rounded-full border-2 border-muted border-t-primary" />
              </div>
            ) : displayNotes.length === 0 ? (
              <div className={cn('rounded-xl border border-dashed px-4 py-10 text-center text-sm', glassDialogMutedText)}>
                {canManage
                  ? 'No release notes yet. Add the first Nexus platform update.'
                  : 'No release notes yet for Nexus.'}
              </div>
            ) : (
              <ul className="space-y-3">
                {displayNotes.map((note) => {
                  const when = noteTimestamp(note);
                  return (
                    <li
                      key={note.id}
                      className={cn(
                        'rounded-xl border p-4',
                        glassDialogPanelStyles,
                        note.is_read === false && note.is_published !== false && 'ring-1 ring-primary/30',
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 space-y-1.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {categoryBadge(note.category)}
                            {note.version && (
                              <Badge variant="secondary" className="font-normal">
                                v{note.version}
                              </Badge>
                            )}
                            {note.is_published === false && (
                              <Badge variant="outline">Draft</Badge>
                            )}
                            {note.is_read === false && note.is_published !== false && (
                              <Badge className="bg-primary/15 text-primary border-primary/20">New</Badge>
                            )}
                          </div>
                          <h3 className={cn('text-sm font-semibold leading-snug', glassDialogTitleText)}>{note.title}</h3>
                          {note.body && (
                            <p className={cn('whitespace-pre-wrap text-sm leading-relaxed', glassDialogMutedText)}>
                              {note.body}
                            </p>
                          )}
                          {when && (
                            <p className={cn('text-[11px]', glassDialogFaintText)}>{when}</p>
                          )}
                        </div>

                        {canManage && managing && (
                          <div className="flex shrink-0 items-center gap-0.5">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className={cn('h-8 w-8', glassDialogIconButton)}
                              title="Edit"
                              onClick={() => startEdit(note)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              title="Delete"
                              onClick={() => setPendingDelete(note)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={Boolean(pendingDelete)} onOpenChange={(openState) => !openState && setPendingDelete(null)}>
        <AlertDialogContent className={glassDialogPanelStyles}>
          <AlertDialogHeader>
            <AlertDialogTitle className={glassDialogTitleText}>Delete this release note?</AlertDialogTitle>
            <AlertDialogDescription className={glassDialogMutedText}>
              {pendingDelete
                ? `"${pendingDelete.title}" will be permanently removed.`
                : 'This release note will be permanently removed.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMut.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteMut.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => pendingDelete && deleteMut.mutate(pendingDelete.id)}
            >
              {deleteMut.isPending ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
