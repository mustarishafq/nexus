// @ts-nocheck
import React from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { isPollField } from '@/lib/eventCheckInForm';

export default function EventCheckInAnswersFields({
  fields,
  values,
  onChange,
  disabled = false,
  idPrefix = 'checkin',
}) {
  const list = Array.isArray(fields) ? fields : [];

  if (list.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {list.map((field) => {
        const key = field.key;
        const inputId = `${idPrefix}-${key}`;
        const required = Boolean(field.required);
        const label = field.required ? field.label : `${field.label} (optional)`;

        if (isPollField(field)) {
          const options = Array.isArray(field.options) ? field.options : [];
          const multiple = Boolean(field.multiple);
          const selected = multiple
            ? (Array.isArray(values?.[key]) ? values[key] : [])
            : String(values?.[key] ?? '');

          return (
            <div key={field.id || key} className="space-y-2">
              <Label>{label}</Label>
              {multiple ? (
                <div className="space-y-2 rounded-lg border bg-muted/10 p-3">
                  {options.map((option) => {
                    const optionId = `${inputId}-${option.id || option.label}`;
                    const checked = selected.includes(option.label);

                    return (
                      <label
                        key={option.id || option.label}
                        htmlFor={optionId}
                        className="flex items-center gap-2 text-sm"
                      >
                        <Checkbox
                          id={optionId}
                          checked={checked}
                          disabled={disabled}
                          onCheckedChange={(isChecked) => {
                            const next = isChecked
                              ? [...selected.filter((value) => value !== option.label), option.label]
                              : selected.filter((value) => value !== option.label);
                            onChange(key, next);
                          }}
                        />
                        <span>{option.label}</span>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <RadioGroup
                  value={selected}
                  onValueChange={(value) => onChange(key, value)}
                  disabled={disabled}
                  required={required}
                  className="rounded-lg border bg-muted/10 p-3"
                >
                  {options.map((option) => {
                    const optionId = `${inputId}-${option.id || option.label}`;

                    return (
                      <label
                        key={option.id || option.label}
                        htmlFor={optionId}
                        className="flex items-center gap-2 text-sm"
                      >
                        <RadioGroupItem
                          id={optionId}
                          value={option.label}
                          disabled={disabled}
                        />
                        <span>{option.label}</span>
                      </label>
                    );
                  })}
                </RadioGroup>
              )}
            </div>
          );
        }

        const value = values?.[key] ?? '';
        const commonProps = {
          id: inputId,
          value,
          disabled,
          required,
          onChange: (event) => onChange(key, event.target.value),
        };

        return (
          <div key={field.id || key} className="space-y-2">
            <Label htmlFor={inputId}>{label}</Label>
            {field.type === 'textarea' ? (
              <Textarea
                {...commonProps}
                rows={3}
                placeholder={field.label}
              />
            ) : (
              <Input
                {...commonProps}
                type={field.type === 'phone' ? 'tel' : 'text'}
                inputMode={field.type === 'phone' ? 'tel' : undefined}
                autoComplete={
                  key === 'name' ? 'name' : field.type === 'phone' ? 'tel' : 'off'
                }
                placeholder={field.label}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
