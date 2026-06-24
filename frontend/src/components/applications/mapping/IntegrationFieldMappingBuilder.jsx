import React, { useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core';
import { GripVertical, Workflow } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { appendMappingPath, parseSamplePayload } from '@/lib/notificationEventMapping';
import PayloadFieldExplorer from './PayloadFieldExplorer';
import MappingDropZone from './MappingDropZone';

export default function IntegrationFieldMappingBuilder({
  mappingFields,
  fieldLabels,
  defaultFieldMappings,
  requiredFields = [],
  mappingForm,
  onMappingChange,
  samplePayload,
  onSamplePayloadChange,
  onApplyNestedPreset,
  nestedPresetLabel = 'Use nested preset',
  targetTitle = 'Nexus target fields',
  targetDescription = 'Drop source fields here. First matching path wins at runtime.',
  payloadDescription = 'Paste a real webhook body from the external system to explore and map fields.',
}) {
  const [activeDrag, setActiveDrag] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );

  const { data: parsedPayload, error: parseError } = useMemo(
    () => parseSamplePayload(samplePayload),
    [samplePayload]
  );

  const mappedCount = useMemo(
    () => mappingFields.filter((field) => String(mappingForm[field] || '').trim() !== '').length,
    [mappingFields, mappingForm]
  );

  const updateField = (field, value) => {
    onMappingChange({ ...mappingForm, [field]: value });
  };

  const handleDragStart = (event) => {
    const path = String(event.active.id).replace('payload:', '');
    const valueType = event.active.data.current?.valueType || 'string';
    setActiveDrag({ path, valueType });
  };

  const handleDragEnd = (event) => {
    setActiveDrag(null);

    const { active, over } = event;
    if (!over || !String(active.id).startsWith('payload:')) return;
    if (!String(over.id).startsWith('mapping:')) return;

    const path = String(active.id).replace('payload:', '');
    const field = String(over.id).replace('mapping:', '');
    updateField(field, appendMappingPath(mappingForm[field], path));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Workflow className="w-4 h-4 text-primary shrink-0" />
            <Label className="text-sm">Field mapping</Label>
            <Badge variant="secondary" className="text-[10px] h-5">
              {mappedCount}/{mappingFields.length} mapped
            </Badge>
          </div>
          <p className="text-[11px] text-muted-foreground max-w-xl">
            {payloadDescription}
          </p>
        </div>
        {onApplyNestedPreset ? (
          <Button type="button" variant="outline" size="sm" onClick={onApplyNestedPreset} className="shrink-0">
            {nestedPresetLabel}
          </Button>
        ) : null}
      </div>

      <div className="rounded-xl border border-border/70 bg-muted/15 overflow-hidden">
        <div className="px-3 py-2 border-b border-border/60 bg-background/60">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Step 1 · Sample payload
          </p>
        </div>
        <div className="p-3 space-y-2">
          <Textarea
            value={samplePayload}
            onChange={(event) => onSamplePayloadChange(event.target.value)}
            rows={7}
            className="font-mono text-xs bg-background/80 resize-y min-h-[140px]"
            placeholder='{"event": "order.created", "data": { "title": "..." }}'
          />
          {parseError && samplePayload.trim() ? (
            <p className="text-[11px] text-destructive">Fix JSON syntax to enable drag-and-drop mapping.</p>
          ) : null}
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveDrag(null)}
      >
        <div className="rounded-xl border border-border/70 bg-muted/15 overflow-hidden">
          <div className="px-3 py-2 border-b border-border/60 bg-background/60">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Step 2 · Map source → target
            </p>
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-0 xl:divide-x divide-border/60">
            <div className="p-3 min-h-[320px]">
              <PayloadFieldExplorer samplePayload={samplePayload} />
            </div>

            <div className="p-3 space-y-3 max-h-[420px] overflow-y-auto bg-background/40">
              <div>
                <p className="text-xs font-medium">{targetTitle}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{targetDescription}</p>
              </div>
              {mappingFields.map((field) => (
                <MappingDropZone
                  key={field}
                  field={field}
                  label={fieldLabels[field] || field}
                  value={mappingForm[field] ?? ''}
                  onChange={(value) => updateField(field, value)}
                  placeholder={(defaultFieldMappings[field] || []).join(', ')}
                  required={requiredFields.includes(field)}
                />
              ))}
            </div>
          </div>
        </div>

        <DragOverlay dropAnimation={null}>
          {activeDrag ? (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-primary bg-card shadow-lg">
              <GripVertical className="w-3.5 h-3.5 text-muted-foreground" />
              <code className="text-xs font-mono">{activeDrag.path}</code>
              <span className="text-[10px] text-muted-foreground uppercase">{activeDrag.valueType}</span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
