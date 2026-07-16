import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronsUpDown, Loader2, Plus } from 'lucide-react';
import db from '@/api/apiClient';
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

export default function CompanyCombobox({ value, label, onChange, id }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();

  const { data: companies = [], isLoading } = useQuery({
    queryKey: ['companies'],
    queryFn: () => db.listCompanies(),
    staleTime: 60_000,
  });

  const createCompany = useMutation({
    mutationFn: (name) => db.createCompany(name),
    onSuccess: (company) => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      onChange(company.id, company.name);
      setOpen(false);
      setSearch('');
    },
    onError: (error) => {
      toast.error(error?.message || 'Could not create company.');
    },
  });

  const trimmedSearch = search.trim();
  const normalizedSearch = trimmedSearch.toLowerCase();

  const filteredCompanies = useMemo(() => {
    if (!trimmedSearch) return companies;
    return companies.filter((item) => item.name.toLowerCase().includes(normalizedSearch));
  }, [companies, trimmedSearch, normalizedSearch]);

  const selectedCompany = companies.find((item) => item.id === value);
  const displayLabel = selectedCompany?.name || label || '';

  const canCreate =
    trimmedSearch.length > 0 &&
    trimmedSearch.length <= 100 &&
    !companies.some((item) => item.name.toLowerCase() === normalizedSearch);

  const selectCompany = (company) => {
    onChange(company.id, company.name);
    setOpen(false);
    setSearch('');
  };

  const handleCreate = () => {
    if (!canCreate || createCompany.isPending) return;
    createCompany.mutate(trimmedSearch);
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
            {displayLabel || 'Select company...'}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search companies..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            {isLoading ? (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading companies...
              </div>
            ) : null}
            {!isLoading && filteredCompanies.length === 0 && !canCreate ? (
              <CommandEmpty>No company found.</CommandEmpty>
            ) : null}
            {canCreate ? (
              <CommandItem
                value={`create-${trimmedSearch}`}
                onSelect={handleCreate}
                className="gap-2"
                disabled={createCompany.isPending}
              >
                {createCompany.isPending ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4 shrink-0" />
                )}
                <span>Add &quot;{trimmedSearch}&quot;</span>
              </CommandItem>
            ) : null}
            {filteredCompanies.map((company) => (
              <CommandItem
                key={company.id}
                value={company.name}
                onSelect={() => selectCompany(company)}
              >
                <Check
                  className={cn('mr-2 h-4 w-4', value === company.id ? 'opacity-100' : 'opacity-0')}
                />
                {company.name}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
