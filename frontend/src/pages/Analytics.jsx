// @ts-nocheck
import db from '@/api/base44Client';
import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3 } from 'lucide-react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/lib/AuthContext';
import { Link } from 'react-router-dom';
import { useMetaTags } from '@/hooks/useMetaTags';

export default function Analytics() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const { data: metabaseDashboards = [], isLoading } = useQuery({
    queryKey: ['metabase-dashboards'],
    queryFn: () => db.entities.MetabaseDashboard.list('sort_order', 50),
  });

  const [activeMetabaseId, setActiveMetabaseId] = useState('');
  const visibleDashboards = Array.isArray(metabaseDashboards) ? metabaseDashboards : [];
  const selectedDashboard = visibleDashboards.find(
    (dashboard) => String(dashboard.id) === String(activeMetabaseId)
  ) || visibleDashboards[0];

  useEffect(() => {
    if (visibleDashboards.length === 0) {
      setActiveMetabaseId('');
      return;
    }

    const stillVisible = visibleDashboards.some(
      (dashboard) => String(dashboard.id) === String(activeMetabaseId)
    );
    if (!stillVisible) {
      setActiveMetabaseId(String(visibleDashboards[0].id));
    }
  }, [visibleDashboards, activeMetabaseId]);

  useMetaTags({
    title: 'Analytics - EMZI Nexus Brain',
    description: 'Metabase analytics dashboards assigned to your access groups',
  });

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-primary" />
          Analytics
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Metabase dashboards shared with your access groups
        </p>
      </motion.div>

      {isLoading ? (
        <Card className="rounded-2xl border-border/70">
          <CardContent className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-muted border-t-primary rounded-full animate-spin" />
          </CardContent>
        </Card>
      ) : visibleDashboards.length === 0 ? (
        <Card className="rounded-2xl border-border/70">
          <CardContent className="px-6 py-16 text-center space-y-3">
            <BarChart3 className="w-10 h-10 text-muted-foreground/50 mx-auto" />
            <p className="text-sm font-medium">No analytics dashboards available</p>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              {isAdmin
                ? 'Add Metabase dashboards in User Management and assign them to access groups.'
                : 'No dashboards have been assigned to your access groups yet. Contact an administrator if you need access.'}
            </p>
            {isAdmin && (
              <Button asChild variant="outline" className="mt-2">
                <Link to="/admin/users">Manage dashboards</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="rounded-2xl border-border/70">
          {visibleDashboards.length > 1 && (
            <CardHeader className="pb-3">
              <Select
                value={String(selectedDashboard?.id || '')}
                onValueChange={setActiveMetabaseId}
              >
                <SelectTrigger className="w-full sm:w-72">
                  <SelectValue placeholder="Select dashboard" />
                </SelectTrigger>
                <SelectContent>
                  {visibleDashboards.map((dashboard) => (
                    <SelectItem key={dashboard.id} value={String(dashboard.id)}>
                      {dashboard.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardHeader>
          )}
          <CardContent className={visibleDashboards.length > 1 ? 'pt-0' : 'p-0'}>
            {selectedDashboard && (
              <div className="rounded-xl border border-border overflow-hidden bg-muted/20">
                <iframe
                  key={selectedDashboard.id}
                  title={selectedDashboard.name}
                  src={selectedDashboard.public_url}
                  className="w-full h-[calc(100vh-16rem)] min-h-[640px] border-0 bg-background"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
