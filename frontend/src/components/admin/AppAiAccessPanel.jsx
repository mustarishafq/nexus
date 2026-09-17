import db from '@/api/apiClient';
import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

export default function AppAiAccessPanel() {
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin-ai-applications'],
    queryFn: () => db.entities.Application.list('sort_order', 100),
  });

  const applications = Array.isArray(data) ? data : [];
  const allowedCount = applications.filter((app) => app.ai_enabled).length;

  const mutation = useMutation({
    mutationFn: ({ id, ai_enabled }) => db.entities.Application.update(id, { ai_enabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-ai-applications'] });
      queryClient.invalidateQueries({ queryKey: ['applications'] });
    },
    onError: (error) => {
      toast.error(error?.message || 'Could not update AI access.');
    },
  });

  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">App AI access</CardTitle>
        <CardDescription>
          Registered apps can use Brain as their AI provider. Turn it on per application.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading applications…
          </div>
        ) : null}
        {isError ? (
          <p className="text-sm text-muted-foreground">Could not load applications.</p>
        ) : null}
        {!isLoading && !isError && applications.length === 0 ? (
          <p className="text-sm text-muted-foreground">No applications yet. Add one under Applications first.</p>
        ) : null}
        {!isLoading && !isError && applications.length > 0 ? (
          <>
            <p className="text-sm text-muted-foreground">
              {allowedCount} of {applications.length} app{applications.length === 1 ? '' : 's'} allowed.
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {applications.map((app) => (
                <label
                  key={app.id}
                  className="flex min-w-0 items-center justify-between gap-3 rounded-xl border px-3 py-2.5"
                >
                  <span className="min-w-0 truncate text-sm font-medium">{app.name}</span>
                  <Switch
                    checked={Boolean(app.ai_enabled)}
                    disabled={mutation.isPending && mutation.variables?.id === app.id}
                    onCheckedChange={(checked) => mutation.mutate({ id: app.id, ai_enabled: checked })}
                    aria-label={`Allow ${app.name} to use Brain AI`}
                  />
                </label>
              ))}
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
