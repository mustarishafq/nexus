import React, { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { X, ArrowDownToLine, Plus } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  appendMappingPath,
  pathsFromFormValue,
  removeMappingPath,
} from '@/lib/notificationEventMapping';

export default function MappingDropZone({
  field,
  label,
  value,
  onChange,
  placeholder,
  required = false,
}) {
  const [manualPath, setManualPath] = useState('');
  const { setNodeRef, isOver, active } = useDroppable({
    id: `mapping:${field}`,
    data: { field },
  });

  const paths = pathsFromFormValue(value);
  const isDragTarget = isOver && active?.id?.startsWith('payload:');

  const removePath = (path) => {
    onChange(removeMappingPath(value, path));
  };

  const addManualPath = () => {
    const trimmed = manualPath.trim();
    if (!trimmed) return;
    onChange(appendMappingPath(value, trimmed));
    setManualPath('');
  };

  return (
    <div className="space-y-1.5">
      <Label className="text-xs flex items-center gap-1">
        {label}
        {required ? <span className="text-destructive">*</span> : null}
      </Label>
      <div
        ref={setNodeRef}
        className={cn(
          'rounded-lg border border-dashed p-2.5 transition-colors min-h-[68px]',
          isDragTarget
            ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
            : 'border-border/80 bg-muted/20 hover:border-border'
        )}
      >
        {paths.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {paths.map((path, index) => (
              <span
                key={path}
                className="inline-flex items-center gap-1 text-[11px] font-mono bg-background border border-border rounded-md px-2 py-0.5"
              >
                {index === 0 ? (
                  <span className="text-[9px] uppercase tracking-wide text-primary font-sans mr-0.5">1st</span>
                ) : null}
                {path}
                <button
                  type="button"
                  onClick={() => removePath(path)}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                  aria-label={`Remove ${path}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        ) : (
          <div className={cn(
            'flex items-center gap-2 text-[11px] text-muted-foreground mb-2',
            isDragTarget && 'text-primary'
          )}>
            <ArrowDownToLine className="w-3.5 h-3.5 shrink-0" />
            Drop a source field here
          </div>
        )}

        <div className="flex gap-1.5">
          <Input
            value={manualPath}
            onChange={(event) => setManualPath(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                addManualPath();
              }
            }}
            placeholder={paths.length ? 'Add fallback path...' : placeholder}
            className="font-mono text-xs h-8 bg-background/80"
          />
          <button
            type="button"
            onClick={addManualPath}
            disabled={!manualPath.trim()}
            className="inline-flex items-center justify-center h-8 w-8 rounded-md border border-border bg-background hover:bg-muted disabled:opacity-40 transition-colors shrink-0"
            title="Add path"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
