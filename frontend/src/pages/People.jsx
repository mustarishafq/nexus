import db from '@/api/apiClient';
import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Search, Users, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { motion } from 'framer-motion';
import { useMetaTags } from '@/hooks/useMetaTags';
import UserDirectoryCard from '@/components/people/UserDirectoryCard';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';

function useDebouncedValue(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

export default function People() {
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('all');
  const [accessGroupId, setAccessGroupId] = useState('all');
  const debouncedSearch = useDebouncedValue(search.trim());

  useMetaTags({
    title: 'People - EMZI Nexus Brain',
    description: 'Browse and connect with colleagues across your organization',
  });

  const filters = useMemo(() => {
    const next = { limit: 50, sort: 'full_name' };
    if (debouncedSearch) next.q = debouncedSearch;
    if (department !== 'all') next.department_id = Number(department);
    if (accessGroupId !== 'all') next.access_group_id = Number(accessGroupId);
    return next;
  }, [debouncedSearch, department, accessGroupId]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['people-directory', filters],
    queryFn: () => db.getPeopleDirectory(filters),
    staleTime: 30_000,
  });

  const users = Array.isArray(data?.users) ? data.users : [];
  const departments = Array.isArray(data?.departments) ? data.departments : [];
  const directoryAccessGroups = Array.isArray(data?.access_groups) ? data.access_groups : [];
  const hasActiveFilters = Boolean(debouncedSearch || department !== 'all' || accessGroupId !== 'all');

  const clearFilters = () => {
    setSearch('');
    setDepartment('all');
    setAccessGroupId('all');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Users}
        title="People"
        description="Discover colleagues, learn what they do, and explore their profiles."
        meta={isFetching ? 'Updating...' : `${users.length} colleague${users.length === 1 ? '' : 's'}`}
      />

      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_auto]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by display name, full name, team, skills, or bio..."
              className="pl-9"
            />
          </div>

          <Select value={department} onValueChange={setDepartment}>
            <SelectTrigger>
              <SelectValue placeholder="All departments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All departments</SelectItem>
              {departments.map((item) => (
                <SelectItem key={item.id} value={String(item.id)}>
                  {item.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={accessGroupId} onValueChange={setAccessGroupId}>
            <SelectTrigger>
              <SelectValue placeholder="All groups" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All access groups</SelectItem>
              {directoryAccessGroups.map((group) => (
                <SelectItem key={group.id} value={String(group.id)}>
                  {group.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {hasActiveFilters ? (
            <Button type="button" variant="outline" onClick={clearFilters} className="gap-2">
              <X className="h-4 w-4" />
              Clear
            </Button>
          ) : (
            <div className="hidden lg:block" />
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : users.length === 0 ? (
        <EmptyState
          variant="dashed"
          icon={Users}
          title="No colleagues match your filters"
          description="Try a different search or clear the filters to browse everyone."
          action={
            hasActiveFilters ? (
              <Button type="button" variant="outline" size="sm" onClick={clearFilters}>
                Clear filters
              </Button>
            ) : null
          }
        />
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
        >
          {users.map((user) => (
            <UserDirectoryCard key={user.id} user={user} />
          ))}
        </motion.div>
      )}
    </div>
  );
}
