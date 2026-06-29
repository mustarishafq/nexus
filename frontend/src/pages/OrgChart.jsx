import db from '@/api/apiClient';
import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { GitBranch, Loader2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useMetaTags } from '@/hooks/useMetaTags';
import OrgChartTree from '@/components/people/OrgChartTree';

export default function OrgChart() {
  const [searchParams] = useSearchParams();
  const departmentFromUrl = searchParams.get('department') || searchParams.get('department_id');
  const [department, setDepartment] = useState(() => {
    if (departmentFromUrl && /^\d+$/.test(departmentFromUrl)) {
      return departmentFromUrl;
    }
    return 'all';
  });

  useEffect(() => {
    if (departmentFromUrl && /^\d+$/.test(departmentFromUrl)) {
      setDepartment(departmentFromUrl);
    }
  }, [departmentFromUrl]);

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
  const companyTree = Array.isArray(data?.tree) ? data.tree : [];

  useMetaTags({
    title: 'Organization - EMZI Nexus Brain',
    description: 'Explore department reporting structures and org chart across your organization',
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Organization</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Org chart and reporting lines built from manager assignments on staff profiles.
          </p>
        </div>

        <div className="w-full sm:w-64">
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
        </div>
      </div>

      {isLoading ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-8">
          {isFetching ? (
            <p className="text-sm text-muted-foreground">Updating chart...</p>
          ) : null}

          {department !== 'all' ? (
            <section className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold">
                  {selectedDepartment?.name || 'Department'}
                </h2>
                <p className="text-sm text-muted-foreground">
                  Department reporting structure. Shown from the department chief down — executive leaders above the chief are hidden in this view.
                </p>
              </div>
              <OrgChartTree tree={companyTree} />
            </section>
          ) : (
            <section className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold">Company</h2>
                <p className="text-sm text-muted-foreground">
                  Full reporting structure across the organization, up to top leadership.
                </p>
              </div>
              <OrgChartTree tree={companyTree} />
            </section>
          )}
        </div>
      )}
    </div>
  );
}
