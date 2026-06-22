import db from '@/api/base44Client';
import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, Plus, Trash2 } from 'lucide-react';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

function credentialStatusBadge(status) {
  if (status === 'approved') {
    return <Badge className="bg-success/15 text-success border-success/20">Approved</Badge>;
  }
  if (status === 'rejected') {
    return <Badge variant="destructive">Rejected</Badge>;
  }
  return <Badge variant="secondary">Pending approval</Badge>;
}

export default function SsoCredentialsDialog({ application, open, onOpenChange }) {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [label, setLabel] = useState('');
  const [pendingDelete, setPendingDelete] = useState(null);
  const [pendingAdd, setPendingAdd] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['application-sso-credentials', application?.id],
    queryFn: () => db.getApplicationSsoCredentials(application.id),
    enabled: open && Boolean(application?.id) && application?.auth_mode === 'jwt',
  });

  useEffect(() => {
    if (!open) {
      setEmail('');
      setLabel('');
    }
  }, [open]);

  const createMut = useMutation({
    mutationFn: (payload) => db.createApplicationSsoCredential(application.id, payload),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['application-sso-credentials', application?.id] });
      setEmail('');
      setLabel('');
      toast.success(result?.message || 'SSO account submitted for admin approval.');
    },
    onError: (error) => {
      toast.error(error.message || 'Unable to add SSO account.');
    },
  });

  const deleteMut = useMutation({
    mutationFn: (credentialId) => db.deleteApplicationSsoCredential(application.id, credentialId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['application-sso-credentials', application?.id] });
      toast.success('SSO account removed.');
    },
    onError: (error) => {
      toast.error(error.message || 'Unable to remove SSO account.');
    },
  });

  const handleAdd = (event) => {
    event.preventDefault();
    if (!email.trim()) return;

    setPendingAdd({
      email: email.trim(),
      label: label.trim() || undefined,
    });
  };

  const confirmAdd = () => {
    if (!pendingAdd) return;

    createMut.mutate(pendingAdd, {
      onSettled: () => setPendingAdd(null),
    });
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;

    deleteMut.mutate(pendingDelete.id, {
      onSettled: () => setPendingDelete(null),
    });
  };

  if (!application || application.auth_mode !== 'jwt') {
    return null;
  }

  const primaryEmail = data?.primary_email;
  const credentials = data?.credentials ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1.5rem)] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-4 w-4" />
            SSO accounts for {application.name}
          </DialogTitle>
          <DialogDescription>
            Add extra sign-in emails for this application. Each new email must be approved by an admin before it can be used to launch.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {primaryEmail ? (
            <div className="rounded-xl border bg-muted/30 px-3 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Default account</p>
              <p className="mt-1 text-sm font-medium">Nexus account</p>
              <p className="text-xs text-muted-foreground">{primaryEmail}</p>
            </div>
          ) : null}

          <div className="space-y-2">
            <p className="text-sm font-medium">Additional accounts</p>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading accounts...</p>
            ) : credentials.length === 0 ? (
              <p className="rounded-xl border border-dashed px-3 py-4 text-sm text-muted-foreground">
                No extra SSO accounts yet. Add another email if you use more than one login for this app.
              </p>
            ) : (
              <div className="space-y-2">
                {credentials.map((credential) => (
                  <div
                    key={credential.id}
                    className="flex items-center gap-3 rounded-xl border px-3 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-medium">
                          {credential.label?.trim() || credential.email}
                        </p>
                        {credentialStatusBadge(credential.status)}
                      </div>
                      {credential.label?.trim() ? (
                        <p className="truncate text-xs text-muted-foreground">{credential.email}</p>
                      ) : null}
                      {credential.status === 'pending' ? (
                        <p className="mt-1 text-xs text-muted-foreground">Waiting for admin approval.</p>
                      ) : null}
                      {credential.status === 'rejected' ? (
                        <p className="mt-1 text-xs text-muted-foreground">Rejected. Remove and submit again if needed.</p>
                      ) : null}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                      title="Remove account"
                      disabled={deleteMut.isPending}
                      onClick={() => setPendingDelete(credential)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <form onSubmit={handleAdd} className="space-y-3 rounded-xl border px-3 py-3">
            <p className="text-sm font-medium">Add another account</p>
            <div className="space-y-1.5">
              <Label htmlFor="sso-credential-email">Email</Label>
              <Input
                id="sso-credential-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="other.account@company.com"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sso-credential-label">Label (optional)</Label>
              <Input
                id="sso-credential-label"
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                placeholder="e.g. Admin account"
                maxLength={120}
              />
            </div>
            <Button type="submit" size="sm" disabled={createMut.isPending || !email.trim()}>
              <Plus className="mr-1.5 h-4 w-4" />
              Add account
            </Button>
          </form>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>

      <AlertDialog open={Boolean(pendingDelete)} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove SSO account?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete ? (
                <>
                  Remove <span className="font-medium text-foreground">{pendingDelete.label?.trim() || pendingDelete.email}</span> from{' '}
                  <span className="font-medium text-foreground">{application.name}</span>. You can add it again later if needed.
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMut.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteMut.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                confirmDelete();
              }}
            >
              {deleteMut.isPending ? 'Removing...' : 'Remove'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(pendingAdd)} onOpenChange={(open) => !open && setPendingAdd(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit SSO account for approval?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingAdd ? (
                <>
                  Submit <span className="font-medium text-foreground">{pendingAdd.email}</span> for admin approval before it can be used to launch{' '}
                  <span className="font-medium text-foreground">{application.name}</span>.
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={createMut.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={createMut.isPending}
              onClick={(event) => {
                event.preventDefault();
                confirmAdd();
              }}
            >
              {createMut.isPending ? 'Submitting...' : 'Submit'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
