import React from 'react';
import { LayoutGrid, List, Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'online', label: 'Online' },
  { value: 'issues', label: 'Needs attention' },
];

export default function ApplicationsCatalogToolbar({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  viewMode,
  onViewModeChange,
  resultCount,
  totalCount,
  onlineCount,
  issueCount,
  showViewToggle = true,
}) {
  const hasActiveFilters = Boolean(search.trim() || statusFilter !== 'all');

  return (
    <div className="rounded-xl border border-border bg-card/80 p-2 backdrop-blur-sm sm:rounded-2xl sm:p-4">
      <div className="flex flex-col gap-2 sm:gap-3 lg:flex-row lg:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground sm:left-3 sm:h-4 sm:w-4" />
          <Input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search applications..."
            className="h-8 pl-8 pr-8 text-sm sm:h-10 sm:pl-9 sm:pr-9"
            aria-label="Search applications"
          />
          {search ? (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-2 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:right-2.5 sm:h-6 sm:w-6"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>

        <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto rounded-lg border border-border bg-muted/30 p-0.5 [scrollbar-width:none] sm:flex-none sm:rounded-xl sm:p-1 [&::-webkit-scrollbar]:hidden">
            {STATUS_FILTERS.map((filter) => {
              const isActive = statusFilter === filter.value;
              const count =
                filter.value === 'all'
                  ? totalCount
                  : filter.value === 'online'
                    ? onlineCount
                    : issueCount;

              return (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => onStatusFilterChange(filter.value)}
                  className={cn(
                    'shrink-0 rounded-md px-2 py-1 text-[11px] font-medium transition-all sm:rounded-lg sm:px-2.5 sm:py-1.5 sm:text-sm',
                    isActive
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <span className="sm:hidden">
                    {filter.value === 'issues' ? 'Attention' : filter.label}
                  </span>
                  <span className="hidden sm:inline">{filter.label}</span>
                  <span className="ml-1 tabular-nums opacity-70 sm:ml-1.5">{count}</span>
                </button>
              );
            })}
          </div>

          {showViewToggle ? (
            <div className="flex shrink-0 items-center gap-0.5 rounded-xl border border-border bg-muted/30 p-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={cn('h-8 w-8', viewMode === 'grid' && 'bg-background shadow-sm')}
                aria-label="Grid view"
                aria-pressed={viewMode === 'grid'}
                onClick={() => onViewModeChange('grid')}
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={cn('h-8 w-8', viewMode === 'list' && 'bg-background shadow-sm')}
                aria-label="List view"
                aria-pressed={viewMode === 'list'}
                onClick={() => onViewModeChange('list')}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          ) : null}

          {hasActiveFilters ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="hidden h-8 gap-1.5 text-muted-foreground sm:inline-flex"
              onClick={() => {
                onSearchChange('');
                onStatusFilterChange('all');
              }}
            >
              <X className="h-3.5 w-3.5" />
              Clear
            </Button>
          ) : null}
        </div>
      </div>

      <p className="mt-2 hidden text-xs text-muted-foreground sm:mt-3 sm:block">
        Showing <span className="font-medium text-foreground tabular-nums">{resultCount}</span>
        {' '}of{' '}
        <span className="tabular-nums">{totalCount}</span>
        {' '}application{totalCount === 1 ? '' : 's'}
      </p>
    </div>
  );
}
