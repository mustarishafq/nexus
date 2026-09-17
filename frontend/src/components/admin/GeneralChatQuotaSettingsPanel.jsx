import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const WEEKDAYS = [
  { value: '1', label: 'Monday' },
  { value: '2', label: 'Tuesday' },
  { value: '3', label: 'Wednesday' },
  { value: '4', label: 'Thursday' },
  { value: '5', label: 'Friday' },
  { value: '6', label: 'Saturday' },
  { value: '7', label: 'Sunday' },
];

export default function GeneralChatQuotaSettingsPanel({ settings, onChange }) {
  const period = settings.general_chat_reset_period || 'monthly';

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="general_chat_token_limit">Default token limit</Label>
        <Input
          id="general_chat_token_limit"
          type="number"
          min={0}
          value={settings.general_chat_token_limit ?? 100000}
          onChange={(event) => onChange((current) => ({
            ...current,
            general_chat_token_limit: event.target.value,
          }))}
        />
        <p className="text-xs text-muted-foreground">
          Applies to every user unless an individual limit is set. Chat is blocked when remaining tokens hit zero.
        </p>
      </div>
      <div className="space-y-2">
        <Label>Reset period</Label>
        <Select
          value={period}
          onValueChange={(value) => onChange((current) => ({ ...current, general_chat_reset_period: value }))}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="daily">Daily</SelectItem>
            <SelectItem value="weekly">Weekly</SelectItem>
            <SelectItem value="monthly">Monthly</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="general_chat_reset_time">Reset time</Label>
        <Input
          id="general_chat_reset_time"
          type="time"
          value={settings.general_chat_reset_time || '00:00'}
          onChange={(event) => onChange((current) => ({
            ...current,
            general_chat_reset_time: event.target.value,
          }))}
        />
      </div>
      {period === 'weekly' ? (
        <div className="space-y-2 md:col-span-2">
          <Label>Reset weekday</Label>
          <Select
            value={String(settings.general_chat_reset_weekday || 1)}
            onValueChange={(value) => onChange((current) => ({
              ...current,
              general_chat_reset_weekday: Number(value),
            }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WEEKDAYS.map((day) => (
                <SelectItem key={day.value} value={day.value}>{day.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}
      {period === 'monthly' ? (
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="general_chat_reset_month_day">Reset day of month</Label>
          <Input
            id="general_chat_reset_month_day"
            type="number"
            min={1}
            max={28}
            value={settings.general_chat_reset_month_day ?? 1}
            onChange={(event) => onChange((current) => ({
              ...current,
              general_chat_reset_month_day: event.target.value,
            }))}
          />
        </div>
      ) : null}
    </div>
  );
}
