import db from '@/api/base44Client';
import { Link, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Compass, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';

export default function PageNotFound() {
  const location = useLocation();
  const pageName = location.pathname.substring(1);

  const { data: authData, isFetched } = useQuery({
    queryKey: ['user'],
    queryFn: async () => {
      try {
        const user = await db.auth.me();
        return { user, isAuthenticated: true };
      } catch {
        return { user: null, isAuthenticated: false };
      }
    },
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <p className="text-7xl font-light tracking-tight text-muted-foreground/40">404</p>
          <div className="mx-auto mt-3 h-0.5 w-16 rounded-full bg-border" />
        </div>

        <EmptyState
          variant="inline"
          icon={Compass}
          title="Page not found"
          description={
            pageName
              ? `The page "${pageName}" could not be found in this application.`
              : 'The page you requested could not be found in this application.'
          }
          action={(
            <Button asChild variant="outline" className="gap-2">
              <Link to="/">
                <Home className="h-4 w-4" />
                Go home
              </Link>
            </Button>
          )}
        />

        {isFetched && authData.isAuthenticated && authData.user?.role === 'admin' ? (
          <div className="rounded-xl border border-warning/30 bg-warning/10 p-4">
            <p className="text-sm font-medium text-foreground">Admin note</p>
            <p className="mt-1 text-sm text-muted-foreground">
              This route may not be implemented yet. Ask in chat to add it.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
