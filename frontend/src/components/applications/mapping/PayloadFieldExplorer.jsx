import React, { useMemo, useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import {
  Braces, Hash, ToggleLeft, Type, GripVertical, Search, AlertCircle,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  flattenPayloadPaths,
  formatPayloadValuePreview,
  parseSamplePayload,
} from '@/lib/notificationEventMapping';

const typeIcons = {
  string: Type,
  number: Hash,
  boolean: ToggleLeft,
  object: Braces,
  array: Braces,
  null: Type,
  undefined: Type,
};

function DraggablePayloadField({ path, value, valueType, depth, isLeaf }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `payload:${path}`,
    data: { path, valueType },
  });
  const Icon = typeIcons[valueType] || Type;

  return (
    <div
      ref={setNodeRef}
      style={{ paddingLeft: `${depth * 12 + 8}px` }}
      className={cn(
        'group flex items-center gap-2 py-1.5 pr-2 rounded-md border border-transparent',
        'hover:bg-muted/60 hover:border-border/60 cursor-grab active:cursor-grabbing',
        isDragging && 'opacity-40'
      )}
      {...listeners}
      {...attributes}
    >
      <GripVertical className="w-3 h-3 text-muted-foreground/50 shrink-0" />
      <Icon className="w-3 h-3 text-muted-foreground shrink-0" />
      <code className="text-[11px] font-mono text-foreground truncate">{path}</code>
      {isLeaf ? (
        <span className="text-[10px] text-muted-foreground truncate ml-auto max-w-[45%]">
          {formatPayloadValuePreview(value)}
        </span>
      ) : (
        <span className="text-[10px] text-muted-foreground/70 ml-auto uppercase tracking-wide">
          {valueType}
        </span>
      )}
    </div>
  );
}

export default function PayloadFieldExplorer({ samplePayload }) {
  const [search, setSearch] = useState('');
  const { data: payload, error } = useMemo(
    () => parseSamplePayload(samplePayload),
    [samplePayload]
  );

  const fields = useMemo(() => {
    if (!payload) return [];
    return flattenPayloadPaths(payload);
  }, [payload]);

  const filteredFields = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return fields;
    return fields.filter((field) => field.path.toLowerCase().includes(query));
  }, [fields, search]);

  const depthByPath = useMemo(() => {
    const depths = {};
    filteredFields.forEach((field) => {
      depths[field.path] = field.path.split('.').length - 1;
    });
    return depths;
  }, [filteredFields]);

  return (
    <div className="flex flex-col h-full min-h-[240px] rounded-lg border border-border/70 bg-background/80">
      <div className="p-3 border-b border-border/70 space-y-2">
        <p className="text-xs font-medium">Source fields</p>
        <p className="text-[11px] text-muted-foreground">
          Drag a field onto a Nexus target on the right.
        </p>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Filter fields..."
            className="h-8 pl-8 text-xs bg-muted/40 border-0"
          />
        </div>
      </div>

      <div className="flex-1 min-h-[240px] overflow-y-auto p-2">
        {error ? (
          <div className="flex items-start gap-2 p-3 text-xs text-destructive">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>Paste valid JSON above to explore fields. {error}</span>
          </div>
        ) : filteredFields.length === 0 ? (
          <p className="text-xs text-muted-foreground p-3">
            {payload ? 'No fields match your search.' : 'Paste a sample payload to see draggable fields.'}
          </p>
        ) : (
          <div className="space-y-0.5">
            {filteredFields.map((field) => (
              <DraggablePayloadField
                key={field.path}
                path={field.path}
                value={field.value}
                valueType={field.valueType}
                depth={depthByPath[field.path]}
                isLeaf={field.isLeaf}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
