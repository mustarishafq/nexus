// @ts-nocheck
import React from 'react';
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  CHECK_IN_FORM_AUDIENCE_EVERYONE,
  CHECK_IN_FORM_AUDIENCE_PUBLIC,
  CHECK_IN_FORM_MAX_FIELDS,
  CHECK_IN_FORM_MAX_OPTIONS,
  CHECK_IN_FORM_TYPES,
  createCheckInFormField,
  defaultPollOptions,
  hasCheckInFormFieldKey,
  isPollField,
  normalizePollOptions,
} from '@/lib/eventCheckInForm';

function uniqueOptionId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `option-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function EventCheckInFormFieldsEditor({
  fields,
  onFieldsChange,
  audience,
  onAudienceChange,
}) {
  const list = Array.isArray(fields) ? fields : [];
  const atLimit = list.length >= CHECK_IN_FORM_MAX_FIELDS;
  const hasName = hasCheckInFormFieldKey(list, 'name');
  const hasPhone = hasCheckInFormFieldKey(list, 'phone');
  const staffMustFill = audience === CHECK_IN_FORM_AUDIENCE_EVERYONE;

  const updateField = (index, patch) => {
    onFieldsChange(list.map((field, fieldIndex) => (
      fieldIndex === index ? { ...field, ...patch } : field
    )));
  };

  const addField = (partial) => {
    if (atLimit) {
      return;
    }
    onFieldsChange([...list, createCheckInFormField(partial)]);
  };

  const removeField = (index) => {
    onFieldsChange(list.filter((_, fieldIndex) => fieldIndex !== index));
  };

  const moveField = (index, direction) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= list.length) {
      return;
    }

    const next = [...list];
    const [item] = next.splice(index, 1);
    next.splice(nextIndex, 0, item);
    onFieldsChange(next);
  };

  const handleTypeChange = (index, type) => {
    const field = list[index];
    const patch = { type };

    if (type === 'poll') {
      patch.multiple = Boolean(field?.multiple);
      patch.options = normalizePollOptions(field?.options).length >= 2
        ? normalizePollOptions(field.options)
        : defaultPollOptions();
    } else {
      patch.multiple = undefined;
      patch.options = undefined;
    }

    updateField(index, patch);
  };

  const updateOption = (fieldIndex, optionIndex, label) => {
    const field = list[fieldIndex];
    const options = [...(Array.isArray(field.options) ? field.options : [])];
    options[optionIndex] = { ...options[optionIndex], label };
    updateField(fieldIndex, { options });
  };

  const addOption = (fieldIndex) => {
    const field = list[fieldIndex];
    const options = [...(Array.isArray(field.options) ? field.options : [])];
    if (options.length >= CHECK_IN_FORM_MAX_OPTIONS) {
      return;
    }
    options.push({ id: uniqueOptionId(), label: `Option ${options.length + 1}` });
    updateField(fieldIndex, { options });
  };

  const removeOption = (fieldIndex, optionIndex) => {
    const field = list[fieldIndex];
    const options = (Array.isArray(field.options) ? field.options : [])
      .filter((_, index) => index !== optionIndex);
    updateField(fieldIndex, { options });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-0.5">
          <p className="text-sm font-medium">Ask staff too</p>
          <p className="text-xs text-muted-foreground">
            {staffMustFill
              ? 'Logged-in staff and Scan QR must fill these fields.'
              : 'Only public guests fill these fields. Staff keep one-tap check-in.'}
          </p>
        </div>
        <Switch
          checked={staffMustFill}
          onCheckedChange={(checked) => {
            onAudienceChange(checked ? CHECK_IN_FORM_AUDIENCE_EVERYONE : CHECK_IN_FORM_AUDIENCE_PUBLIC);
          }}
          aria-label="Require custom fields from staff"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label>Check-in fields</Label>
          <p className="text-[11px] text-muted-foreground">
            Email is always required. {list.length}/{CHECK_IN_FORM_MAX_FIELDS}
          </p>
        </div>

        {list.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Guests will only be asked for their email.
          </p>
        ) : (
          <div className="space-y-2">
            {list.map((field, index) => {
              const options = Array.isArray(field.options) ? field.options : [];
              const poll = isPollField(field);

              return (
                <div key={field.id || `${field.key}-${index}`} className="rounded-lg border bg-background p-2.5 space-y-2">
                  <div className="flex items-center gap-2">
                    <Input
                      value={field.label || ''}
                      onChange={(event) => updateField(index, { label: event.target.value })}
                      placeholder={poll ? 'Poll question' : 'Field label'}
                      className="h-8"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => removeField(index)}
                      aria-label={`Remove ${field.label || 'field'}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Select
                      value={field.type || 'text'}
                      onValueChange={(value) => handleTypeChange(index, value)}
                    >
                      <SelectTrigger className="h-8 w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CHECK_IN_FORM_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Switch
                        checked={Boolean(field.required)}
                        onCheckedChange={(checked) => updateField(index, { required: checked })}
                        aria-label={`Require ${field.label || 'field'}`}
                      />
                      Required
                    </label>
                    {poll ? (
                      <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Switch
                          checked={Boolean(field.multiple)}
                          onCheckedChange={(checked) => updateField(index, { multiple: checked })}
                          aria-label="Allow multiple poll answers"
                        />
                        Multiple
                      </label>
                    ) : null}
                    <div className="ml-auto flex items-center">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        disabled={index === 0}
                        onClick={() => moveField(index, -1)}
                        aria-label="Move field up"
                      >
                        <ChevronUp className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        disabled={index === list.length - 1}
                        onClick={() => moveField(index, 1)}
                        aria-label="Move field down"
                      >
                        <ChevronDown className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  {poll ? (
                    <div className="space-y-1.5 rounded-md border bg-muted/20 p-2">
                      <p className="text-[11px] font-medium text-muted-foreground">
                        {field.multiple ? 'Guests can pick more than one.' : 'Guests pick one option.'}
                      </p>
                      {options.map((option, optionIndex) => (
                        <div key={option.id || optionIndex} className="flex items-center gap-1.5">
                          <Input
                            value={option.label || ''}
                            onChange={(event) => updateOption(index, optionIndex, event.target.value)}
                            placeholder={`Option ${optionIndex + 1}`}
                            className="h-7 text-sm"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0"
                            disabled={options.length <= 2}
                            onClick={() => removeOption(index, optionIndex)}
                            aria-label={`Remove option ${optionIndex + 1}`}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 gap-1 text-xs"
                        disabled={options.length >= CHECK_IN_FORM_MAX_OPTIONS}
                        onClick={() => addOption(index)}
                      >
                        <Plus className="h-3 w-3" /> Add option
                      </Button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}

        <div className="flex flex-wrap gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 gap-1 text-xs"
            disabled={atLimit || hasName}
            onClick={() => addField({ label: 'Name', key: 'name', type: 'text', required: false })}
          >
            <Plus className="h-3 w-3" /> Name
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 gap-1 text-xs"
            disabled={atLimit || hasPhone}
            onClick={() => addField({ label: 'Phone', key: 'phone', type: 'phone', required: false })}
          >
            <Plus className="h-3 w-3" /> Phone
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 gap-1 text-xs"
            disabled={atLimit}
            onClick={() => addField({
              label: 'Poll',
              type: 'poll',
              required: false,
              multiple: false,
              options: defaultPollOptions(),
            })}
          >
            <Plus className="h-3 w-3" /> Poll
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 gap-1 text-xs"
            disabled={atLimit}
            onClick={() => addField({ label: 'New field', type: 'text', required: false })}
          >
            <Plus className="h-3 w-3" /> Custom
          </Button>
        </div>
      </div>
    </div>
  );
}
