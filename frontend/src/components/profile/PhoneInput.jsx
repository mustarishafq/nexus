// @ts-nocheck
import React from 'react';
import { Input } from '@/components/ui/input';
import { formatPhoneNumber, normalizePhoneNumber } from '@/lib/phone';

export default function PhoneInput({ id, value = '', onChange, placeholder, maxLength = 30, ...props }) {
  return (
    <Input
      id={id}
      type="tel"
      inputMode="tel"
      autoComplete="tel"
      value={formatPhoneNumber(value) || value}
      onChange={(e) => onChange?.(normalizePhoneNumber(e.target.value))}
      onBlur={(e) => onChange?.(normalizePhoneNumber(e.target.value))}
      placeholder={placeholder}
      maxLength={maxLength}
      {...props}
    />
  );
}
