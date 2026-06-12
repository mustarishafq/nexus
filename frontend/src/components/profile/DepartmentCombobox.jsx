import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronsUpDown, Loader2, Plus } from 'lucide-react';
import db from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function DepartmentCombobox({ value, label, onChange, id }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();

  const { data: departments = [], isLoading } = useQuery({
    queryKey: ['departments'],
    queryFn: () => db.listDepartments(),
    staleTime: 60_000,
  });

  const createDepartment = useMutation({
    mutationFn: (name) => db.createDepartment(name),
    onSuccess: (department) => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      onChange(department.id, department.name);
      setOpen(false);
      setSearch('');
    },
    onError: (error) => {
      toast.error(error?.message || 'Could not create department.');
    },
  });

  const trimmedSearch = search.trim();
  const normalizedSearch = trimmedSearch.toLowerCase();

  const filteredDepartments = useMemo(() => {
    if (!trimmedSearch) return departments;
    return departments.filter((item) => item.name.toLowerCase().includes(normalizedSearch));
  }, [departments, trimmedSearch, normalizedSearch]);

  const selectedDepartment = departments.find((item) => item.id === value);
  const displayLabel = selectedDepartment?.name || label || '';

  const canCreate =
    trimmedSearch.length > 0 &&
    trimmedSearch.length <= 100 &&
    !departments.some((item) => item.name.toLowerCase() === normalizedSearch);

  const selectDepartment = (department) => {
    onChange(department.id, department.name);
    setOpen(false);
    setSearch('');
  };

  const handleCreate = () => {
    if (!canCreate || createDepartment.isPending) return;
    createDepartment.mutate(trimmedSearch);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className={cn('truncate', !displayLabel && 'text-muted-foreground')}>
            {displayLabel || 'Select department...'}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search departments..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            {isLoading ? (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading departments...
              </div>
            ) : null}
            {!isLoading && filteredDepartments.length === 0 && !canCreate ? (
              <CommandEmpty>No department found.</CommandEmpty>
            ) : null}
            {canCreate ? (
              <CommandItem
                value={`create-${trimmedSearch}`}
                onSelect={handleCreate}
                className="gap-2"
                disabled={createDepartment.isPending}
              >
                {createDepartment.isPending ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4 shrink-0" />
                )}
                <span>Add &quot;{trimmedSearch}&quot;</span>
              </CommandItem>
            ) : null}
            {filteredDepartments.map((department) => (
              <CommandItem
                key={department.id}
                value={department.name}
                onSelect={() => selectDepartment(department)}
              >
                <Check
                  className={cn('mr-2 h-4 w-4', value === department.id ? 'opacity-100' : 'opacity-0')}
                />
                {department.name}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
