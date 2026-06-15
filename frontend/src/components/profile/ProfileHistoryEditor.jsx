import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

function emptyEntry(fields) {
  return fields.reduce((acc, field) => ({ ...acc, [field.key]: '' }), {});
}

export default function ProfileHistoryEditor({
  label,
  description,
  value = [],
  onChange,
  fields,
  maxItems = 10,
  addLabel = 'Add entry',
}) {
  const entries = Array.isArray(value) && value.length > 0 ? value : [emptyEntry(fields)];

  const updateEntry = (index, key, nextValue) => {
    const next = entries.map((entry, entryIndex) =>
      entryIndex === index ? { ...entry, [key]: nextValue } : entry
    );
    onChange(next);
  };

  const addEntry = () => {
    if (entries.length >= maxItems) return;
    onChange([...entries, emptyEntry(fields)]);
  };

  const removeEntry = (index) => {
    const next = entries.filter((_, entryIndex) => entryIndex !== index);
    onChange(next.length > 0 ? next : [emptyEntry(fields)]);
  };

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {description ? <p className="text-xs text-muted-foreground mt-0.5">{description}</p> : null}
      </div>

      <div className="space-y-3">
        {entries.map((entry, index) => (
          <div key={`${label}-${index}`} className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Entry {index + 1}
              </p>
              {entries.length > 1 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-destructive hover:text-destructive"
                  onClick={() => removeEntry(index)}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                  Remove
                </Button>
              ) : null}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {fields.map((field) => (
                <div
                  key={field.key}
                  className={field.fullWidth ? 'sm:col-span-2 space-y-1.5' : 'space-y-1.5'}
                >
                  <Label htmlFor={`${label}-${index}-${field.key}`}>{field.label}</Label>
                  {field.type === 'textarea' ? (
                    <Textarea
                      id={`${label}-${index}-${field.key}`}
                      value={entry[field.key] || ''}
                      onChange={(e) => updateEntry(index, field.key, e.target.value)}
                      placeholder={field.placeholder}
                      rows={3}
                      maxLength={field.maxLength || 500}
                    />
                  ) : (
                    <Input
                      id={`${label}-${index}-${field.key}`}
                      value={entry[field.key] || ''}
                      onChange={(e) => updateEntry(index, field.key, e.target.value)}
                      placeholder={field.placeholder}
                      maxLength={field.maxLength || 150}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {entries.length < maxItems ? (
        <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={addEntry}>
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          {addLabel}
        </Button>
      ) : null}
    </div>
  );
}
