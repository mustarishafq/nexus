import db from '@/api/base44Client';
import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { Check, KeyRound, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

function statusBadge(status) {
  if (status === 'approved') {
    return <Badge className="bg-success/15 text-success border-success/20">Approved</Badge>;
  }
  if (status === 'rejected') {
    return <Badge variant="destructive">Rejected</Badge>;
  }
  return <Badge variant="secondary">Pending approval</Badge>;
}

export default function SsoCredentialApprovals() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('pending');
  const [pendingReview, setPendingReview] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-sso-credentials', statusFilter],
    queryFn: () => db.listAdminSsoCredentials({ status: statusFilter }),
  });

  const reviewMut = useMutation({
    mutationFn: ({ id, status }) => db.reviewAdminSsoCredential(id, { status }),
    onSuccess: (item) => {
      queryClient.invalidateQueries({ queryKey: ['admin-sso-credentials'] });
      queryClient.invalidateQueries({ queryKey: ['application-sso-credentials'] });
      toast.success(
        item.status === 'approved'
          ? 'SSO account approved.'
          : 'SSO account rejected.',
      );
    },
    onError: (error) => {
      toast.error(error.message || 'Unable to update SSO account.');
    },
  });

  const confirmReview = () => {
    if (!pendingReview) return;

    reviewMut.mutate(
      { id: pendingReview.item.id, status: pendingReview.status },
      { onSettled: () => setPendingReview(null) },
    );
  };

  const accountLabel = (item) => item?.label?.trim() || item?.email || 'this account';

  const items = data?.items ?? [];
  const pendingCountQuery = useQuery({
    queryKey: ['admin-sso-credentials', 'pending-count'],
    queryFn: () => db.listAdminSsoCredentials({ status: 'pending' }),
    staleTime: 30_000,
  });
  const pendingCount = pendingCountQuery.data?.items?.length ?? 0;

  return (
    <Card className="rounded-2xl border-border/70">
      <CardHeader className="pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-primary" />
              SSO account approvals
            </CardTitle>
            <CardDescription className="mt-1">
              Review linked sign-in emails before users can launch applications with them.
            </CardDescription>
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                  {option.value === 'pending' && pendingCount > 0 ? ` (${pendingCount})` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Loading requests...</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            {statusFilter === 'pending'
              ? 'No SSO account requests waiting for approval.'
              : `No ${statusFilter} SSO account requests.`}
          </p>
        ) : (
          <div className="rounded-xl border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Application</TableHead>
                  <TableHead>SSO email</TableHead>
                  <TableHead className="hidden md:table-cell">Requested</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{item.user?.name || 'User'}</p>
                        <p className="text-xs text-muted-foreground truncate">{item.user?.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm truncate">{item.application?.name}</p>
                    </TableCell>
                    <TableCell>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{item.label?.trim() || item.email}</p>
                        {item.label?.trim() ? (
                          <p className="text-xs text-muted-foreground truncate">{item.email}</p>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                      {item.created_at
                        ? formatDistanceToNow(new Date(item.created_at), { addSuffix: true })
                        : '—'}
                    </TableCell>
                    <TableCell>{statusBadge(item.status)}</TableCell>
                    <TableCell className="text-right">
                      {item.status === 'pending' ? (
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            className="h-8 w-8 text-destructive border-destructive/30 hover:bg-destructive/10"
                            aria-label="Reject"
                            disabled={reviewMut.isPending}
                            onClick={() => setPendingReview({ item, status: 'rejected' })}
                          >
                            <X className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            className="h-8 w-8 text-success border-success/30 hover:bg-success/10"
                            aria-label="Approve"
                            disabled={reviewMut.isPending}
                            onClick={() => setPendingReview({ item, status: 'approved' })}
                          >
                            <Check className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {item.reviewer?.name ? `By ${item.reviewer.name}` : '—'}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <AlertDialog open={Boolean(pendingReview)} onOpenChange={(open) => !open && setPendingReview(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingReview?.status === 'approved' ? 'Approve SSO account?' : 'Reject SSO account?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingReview ? (
                pendingReview.status === 'approved' ? (
                  <>
                    Allow <span className="font-medium text-foreground">{pendingReview.item.user?.name || pendingReview.item.user?.email}</span> to launch{' '}
                    <span className="font-medium text-foreground">{pendingReview.item.application?.name}</span> with{' '}
                    <span className="font-medium text-foreground">{accountLabel(pendingReview.item)}</span>?
                  </>
                ) : (
                  <>
                    Reject <span className="font-medium text-foreground">{accountLabel(pendingReview.item)}</span> for{' '}
                    <span className="font-medium text-foreground">{pendingReview.item.application?.name}</span>. The user will need to remove it and submit again if they want another review.
                  </>
                )
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={reviewMut.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={reviewMut.isPending}
              className={
                pendingReview?.status === 'rejected'
                  ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                  : undefined
              }
              onClick={(event) => {
                event.preventDefault();
                confirmReview();
              }}
            >
              {reviewMut.isPending
                ? 'Saving...'
                : pendingReview?.status === 'approved'
                  ? 'Approve'
                  : 'Reject'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
