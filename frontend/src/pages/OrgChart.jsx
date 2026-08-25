import db from '@/api/apiClient';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Building2,
  ChevronsDownUp,
  ChevronsUpDown,
  GitBranch,
  Layers,
  LocateFixed,
  Search,
  Users,
  X,
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { useMetaTags } from '@/hooks/useMetaTags';
import { useAuth } from '@/lib/AuthContext';
import { canManageUsers } from '@/lib/roles';
import { summarizeOrgTree } from '@/components/people/orgChartUtils';
import OrgChartTree, { OrgChartSkeleton } from '@/components/people/OrgChartTree';

export default function OrgChart() {
  const { user } = useAuth();
  const treeRef = useRef(null);
  const [searchParams] = useSearchParams();
  const departmentFromUrl = searchParams.get('department') || searchParams.get('department_id');
  const [department, setDepartment] = useState(() => {
    if (departmentFromUrl && /^\d+$/.test(departmentFromUrl)) {
      return departmentFromUrl;
    }
    return 'all';
  });
  const [search, setSearch] = useState('');
  const [focusRequest, setFocusRequest] = useState({ id: null, nonce: 0 });

  useEffect(() => {
    if (departmentFromUrl && /^\d+$/.test(departmentFromUrl)) {
      setDepartment(departmentFromUrl);
    }
  }, [departmentFromUrl]);

  useEffect(() => {
    setSearch('');
    setFocusRequest({ id: null, nonce: 0 });
  }, [department]);

  const filters = useMemo(
    () => (department === 'all' ? {} : { department_id: Number(department) }),
    [department]
  );

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['org-chart', filters],
    queryFn: () => db.getOrgChart(filters),
    staleTime: 30_000,
  });

  const departments = Array.isArray(data?.departments) ? data.departments : [];
  const selectedDepartment = data?.department;
  const companyTree = useMemo(
    () => (Array.isArray(data?.tree) ? data.tree : []),
    [data?.tree]
  );
  const stats = useMemo(() => summarizeOrgTree(companyTree), [companyTree]);
  const currentUserInTree = stats.people.some((person) => String(person.id) === String(user?.id));
  const viewingDepartment = department !== 'all';

  useMetaTags({
    title: 'Organization - EMZI Nexus Brain',
    description: 'Explore department reporting structures and org chart across your organization',
  });

  const findMe = () => {
    if (!user?.id) return;
    setFocusRequest((prev) => ({ id: user.id, nonce: prev.nonce + 1 }));
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden pb-4">
      <PageHeader
        icon={GitBranch}
        title="Organization"
        description={
          viewingDepartment
            ? `Reporting lines in ${selectedDepartment?.name || 'this department'}, from the department chief down.`
            : 'Reporting lines built from manager assignments on staff profiles.'
        }
        hideDescriptionOnMobile
        actions={
          <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
            <Link to="/people">Directory</Link>
          </Button>
        }
      />

      <div className="flex shrink-0 flex-col gap-3 rounded-2xl border border-border bg-card p-3 sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Find someone in the chart..."
              className="pl-9 pr-9"
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>

          <Select value={department} onValueChange={setDepartment}>
            <SelectTrigger className="w-full lg:w-64">
              <SelectValue placeholder="All departments" />
            </SelectTrigger>
            <SelectContent searchPlaceholder="Search departments...">
              <SelectItem value="all">All departments</SelectItem>
              {departments.map((item) => (
                <SelectItem key={item.id} value={String(item.id)}>
                  {item.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={stats.managerCount === 0}
              onClick={() => treeRef.current?.expandAll()}
            >
              <ChevronsUpDown className="h-3.5 w-3.5" />
              Expand
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={stats.managerCount === 0}
              onClick={() => treeRef.current?.collapseTeams()}
            >
              <ChevronsDownUp className="h-3.5 w-3.5" />
              Collapse
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={!currentUserInTree}
              onClick={findMe}
            >
              <LocateFixed className="h-3.5 w-3.5" />
              Find me
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1">
            <Users className="h-3.5 w-3.5 text-primary" />
            {isLoading ? '—' : `${stats.peopleCount} ${stats.peopleCount === 1 ? 'person' : 'people'}`}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1">
            <Building2 className="h-3.5 w-3.5 text-primary" />
            {isLoading ? '—' : `${stats.departmentCount} dept${stats.departmentCount === 1 ? '' : 's'}`}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1">
            <Layers className="h-3.5 w-3.5 text-primary" />
            {isLoading ? '—' : `${stats.depth} ${stats.depth === 1 ? 'layer' : 'layers'}`}
          </span>
          {isFetching && !isLoading ? <span className="px-1">Updating…</span> : null}
        </div>
      </div>

      <div className="min-h-0 flex-1">
        {isLoading ? (
          <OrgChartSkeleton />
        ) : (
          <OrgChartTree
            ref={treeRef}
            tree={companyTree}
            currentUserId={user?.id}
            searchQuery={search}
            focusedUserId={focusRequest.id}
            focusNonce={focusRequest.nonce}
            emptyAction={
              canManageUsers(user) ? (
                <Button asChild variant="outline" size="sm">
                  <Link to="/admin/users">Open User Management</Link>
                </Button>
              ) : null
            }
          />
        )}
      </div>
    </div>
  );
}
