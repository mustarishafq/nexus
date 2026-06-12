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
import {
  DEFAULT_NOTIFICATION_EVENT_MAPPING,
  NOTIFICATION_FIELD_LABELS,
  appendMappingPath,
  parseSamplePayload,
} from '@/lib/notificationEventMapping';
import PayloadFieldExplorer from './PayloadFieldExplorer';
import MappingDropZone from './MappingDropZone';

const mappingFields = Object.keys(DEFAULT_NOTIFICATION_EVENT_MAPPING.field_mappings);

export default function NotificationFieldMappingBuilder({
  mappingForm,
  onMappingChange,
  samplePayload,
  onSamplePayloadChange,
  onApplyNestedPreset,
}) {
  const [activeDrag, setActiveDrag] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );

  const { data: parsedPayload } = useMemo(
    () => parseSamplePayload(samplePayload),
    [samplePayload]
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

  const handleDragCancel = () => {
    setActiveDrag(null);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Workflow className="w-4 h-4 text-primary" />
            <Label>Drag &amp; drop field mapping</Label>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            Paste a webhook payload, then drag source fields onto Nexus notification targets.
            Multiple paths per field are tried in order (comma-separated).
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onApplyNestedPreset}>
          Use nested preset
        </Button>
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Sample payload from external system</Label>
        <Textarea
          value={samplePayload}
          onChange={(event) => onSamplePayloadChange(event.target.value)}
          rows={6}
          className="font-mono text-xs"
          placeholder='{"event": "order.created", "data": { "title": "..." }}'
        />
        {!parsedPayload && samplePayload.trim() ? (
          <p className="text-[11px] text-destructive">Fix JSON syntax to enable drag-and-drop mapping.</p>
        ) : null}
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <PayloadFieldExplorer samplePayload={samplePayload} />

          <div className="rounded-lg border border-border/70 bg-background/80 p-3 space-y-3 max-h-[420px] overflow-y-auto">
            <div>
              <p className="text-xs font-medium">Nexus notification fields</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Drop source fields here. First matching path wins at runtime.
              </p>
            </div>
            {mappingFields.map((field) => (
              <MappingDropZone
                key={field}
                field={field}
                label={NOTIFICATION_FIELD_LABELS[field] || field}
                value={mappingForm[field] ?? ''}
                onChange={(value) => updateField(field, value)}
                placeholder={DEFAULT_NOTIFICATION_EVENT_MAPPING.field_mappings[field].join(', ')}
                required={field === 'title'}
              />
            ))}
          </div>
        </div>

        <DragOverlay dropAnimation={null}>
          {activeDrag ? (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-primary bg-card shadow-lg">
              <GripVertical className="w-3.5 h-3.5 text-muted-foreground" />
              <code className="text-xs font-mono">{activeDrag.path}</code>
              <span className="text-[10px] text-muted-foreground uppercase">
                {activeDrag.valueType}
              </span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
