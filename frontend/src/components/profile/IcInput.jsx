// @ts-nocheck
import React from 'react';
import { Input } from '@/components/ui/input';
import { formatIcNumber, normalizeIcNumber } from '@/lib/ic';

export default function IcInput({ id, value = '', onChange, placeholder = 'e.g. 900101-01-1234', ...props }) {
  return (
    <Input
      id={id}
      inputMode="numeric"
      autoComplete="off"
      value={formatIcNumber(value) || value}
      onChange={(e) => onChange?.(normalizeIcNumber(e.target.value))}
      onBlur={(e) => onChange?.(normalizeIcNumber(e.target.value))}
      placeholder={placeholder}
      maxLength={14}
      {...props}
    />
  );
}
