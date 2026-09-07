// @ts-nocheck
import React from 'react';
import { Activity, HeartPulse, Home, IdCard, Plus, Trash2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import PhoneInput from '@/components/profile/PhoneInput';
import IcInput from '@/components/profile/IcInput';
import { applyIcDateOfBirth } from '@/lib/ic';
import { formatDateForInput } from '@/lib/utils';
import {
  EMPTY_CHILD,
  EMPTY_HEALTH_STATUS,
  GENDER_OPTIONS,
  HEALTH_STATUS_OPTIONS,
  MARITAL_STATUS_OPTIONS,
  RACE_OPTIONS,
  RELIGION_OPTIONS,
  formatAgeLabel,
  normalizeHealthStatus,
  toggleHealthCondition,
} from '@/lib/profile';

function SectionHeading({ icon: Icon, title, description }) {
  return (
    <div>
      <h3 className="text-sm font-medium flex items-center gap-2">
        <Icon className="w-4 h-4 text-primary" />
        {title}
      </h3>
      {description ? <p className="text-xs text-muted-foreground mt-1">{description}</p> : null}
    </div>
  );
}

function SelectField({ id, label, value, options, onChange, placeholder = 'Not specified' }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value || 'unset'} onValueChange={(next) => onChange(next === 'unset' ? '' : next)}>
        <SelectTrigger id={id}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="unset">{placeholder}</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function AgeHint({ dateOfBirth }) {
  const label = formatAgeLabel(dateOfBirth);
  if (!label) return null;
  return <p className="text-xs text-muted-foreground">Age {label}</p>;
}

function DateOfBirthField({ id, label, value, onChange, today }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="date"
        max={today}
        value={formatDateForInput(value)}
        onChange={(e) => onChange(e.target.value)}
      />
      <AgeHint dateOfBirth={value} />
    </div>
  );
}

function SpouseDetailsEditor({ value, onChange, today }) {
  const spouse = value || {};

  const updateField = (key, nextValue) => {
    onChange({ ...spouse, [key]: nextValue });
  };

  const updateIc = (nextIc) => {
    onChange({
      ...spouse,
      ic_number: nextIc,
      date_of_birth: applyIcDateOfBirth(spouse.date_of_birth, nextIc),
    });
  };

  return (
    <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="spouse-full_name">Full name</Label>
          <Input
            id="spouse-full_name"
            value={spouse.full_name || ''}
            onChange={(e) => updateField('full_name', e.target.value)}
            placeholder="Spouse full name"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="spouse-ic_number">IC no.</Label>
          <IcInput
            id="spouse-ic_number"
            value={spouse.ic_number || ''}
            onChange={updateIc}
          />
        </div>
        <DateOfBirthField
          id="spouse-date_of_birth"
          label="Date of birth"
          value={spouse.date_of_birth}
          onChange={(next) => updateField('date_of_birth', next)}
          today={today}
        />
        <div className="space-y-1.5">
          <Label htmlFor="spouse-phone">Phone no.</Label>
          <PhoneInput
            id="spouse-phone"
            value={spouse.phone || ''}
            onChange={(next) => updateField('phone', next)}
            placeholder="e.g. +60123456789"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="spouse-occupation">Occupation</Label>
          <Input
            id="spouse-occupation"
            value={spouse.occupation || ''}
            onChange={(e) => updateField('occupation', e.target.value)}
            placeholder="e.g. Teacher"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="spouse-employer_name">Employer's name</Label>
          <Input
            id="spouse-employer_name"
            value={spouse.employer_name || ''}
            onChange={(e) => updateField('employer_name', e.target.value)}
            placeholder="Company or organisation"
          />
        </div>
        <div className="sm:col-span-2 space-y-1.5">
          <Label htmlFor="spouse-employer_address">Employer's address</Label>
          <Textarea
            id="spouse-employer_address"
            value={spouse.employer_address || ''}
            onChange={(e) => updateField('employer_address', e.target.value)}
            placeholder="Full address"
            rows={3}
          />
        </div>
      </div>
    </div>
  );
}

function ChildrenDetailsEditor({ value, onChange, today }) {
  const entries = Array.isArray(value) && value.length > 0 ? value : [{ ...EMPTY_CHILD }];

  const updateEntry = (index, patch) => {
    onChange(entries.map((entry, entryIndex) => (
      entryIndex === index ? { ...entry, ...patch } : entry
    )));
  };

  const addEntry = () => {
    if (entries.length >= 10) return;
    onChange([...entries, { ...EMPTY_CHILD }]);
  };

  const removeEntry = (index) => {
    const next = entries.filter((_, entryIndex) => entryIndex !== index);
    onChange(next.length > 0 ? next : [{ ...EMPTY_CHILD }]);
  };

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium">Children</p>
        <p className="text-xs text-muted-foreground mt-0.5">Add children details if applicable.</p>
      </div>

      <div className="space-y-3">
        {entries.map((child, index) => (
          <div key={`child-${index}`} className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Child {index + 1}
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
              <div className="space-y-1.5">
                <Label htmlFor={`child-${index}-name`}>Child name</Label>
                <Input
                  id={`child-${index}-name`}
                  value={child.name || ''}
                  onChange={(e) => updateEntry(index, { name: e.target.value })}
                  placeholder="Full name"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`child-${index}-ic`}>IC no.</Label>
                <IcInput
                  id={`child-${index}-ic`}
                  value={child.ic_number || ''}
                  onChange={(nextIc) => {
                    updateEntry(index, {
                      ic_number: nextIc,
                      date_of_birth: applyIcDateOfBirth(child.date_of_birth, nextIc),
                    });
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`child-${index}-school`}>School</Label>
                <Input
                  id={`child-${index}-school`}
                  value={child.school || ''}
                  onChange={(e) => updateEntry(index, { school: e.target.value })}
                  placeholder="School name"
                />
              </div>
              <DateOfBirthField
                id={`child-${index}-dob`}
                label="Date of birth"
                value={child.date_of_birth}
                onChange={(next) => updateEntry(index, { date_of_birth: next })}
                today={today}
              />
            </div>
          </div>
        ))}
      </div>

      {entries.length < 10 ? (
        <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={addEntry}>
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Add child
        </Button>
      ) : null}
    </div>
  );
}

function HealthStatusEditor({ value, onChange }) {
  const status = normalizeHealthStatus(value || EMPTY_HEALTH_STATUS);
  const selected = new Set(status.conditions);
  const othersChecked = selected.has('others');

  return (
    <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {HEALTH_STATUS_OPTIONS.map((option) => {
          const checked = selected.has(option.value);
          return (
            <label
              key={option.value}
              htmlFor={`health-${option.value}`}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted/60 cursor-pointer"
            >
              <Checkbox
                id={`health-${option.value}`}
                checked={checked}
                onCheckedChange={(next) => onChange(toggleHealthCondition(status, option.value, Boolean(next)))}
              />
              <span>{option.label}</span>
            </label>
          );
        })}
      </div>
      {othersChecked ? (
        <div className="space-y-1.5">
          <Label htmlFor="health-others-text">Other condition</Label>
          <Input
            id="health-others-text"
            value={status.others}
            onChange={(e) => onChange({ ...status, others: e.target.value })}
            placeholder="Describe the condition"
            maxLength={255}
          />
        </div>
      ) : null}
    </div>
  );
}

export default function ProfileHrDetailsForm({ value, onChange, variant = 'self' }) {
  const isAdminRecord = variant === 'admin';
  const today = formatDateForInput(new Date());
  const setField = (key, nextValue) => {
    onChange({ ...value, [key]: nextValue });
  };

  return (
    <div className="space-y-6">
      <SectionHeading
        icon={HeartPulse}
        title="Demographics"
        description={isAdminRecord
          ? 'Private to Admin and HR. Update any field for this staff record.'
          : 'Only you and admins can see this information.'}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <SelectField
          id="gender"
          label="Gender"
          value={value.gender}
          options={GENDER_OPTIONS}
          onChange={(next) => setField('gender', next)}
        />
        <SelectField
          id="marital_status"
          label="Marital status"
          value={value.marital_status}
          options={MARITAL_STATUS_OPTIONS}
          onChange={(next) => setField('marital_status', next)}
        />
        <DateOfBirthField
          id="hr-date_of_birth"
          label="Date of birth"
          value={value.date_of_birth}
          onChange={(next) => setField('date_of_birth', next)}
          today={today}
        />
        <div className="space-y-1.5">
          <Label>Age</Label>
          <Input
            value={formatAgeLabel(value.date_of_birth) || 'Calculated from date of birth'}
            readOnly
            className="bg-muted/40"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="place_of_birth">Place of birth</Label>
          <Input
            id="place_of_birth"
            value={value.place_of_birth || ''}
            onChange={(e) => setField('place_of_birth', e.target.value)}
            placeholder="e.g. Selangor"
            maxLength={100}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="nationality">Nationality</Label>
          <Input
            id="nationality"
            value={value.nationality || ''}
            onChange={(e) => setField('nationality', e.target.value)}
            placeholder="e.g. Malaysian"
            maxLength={50}
          />
        </div>
        <SelectField
          id="religion"
          label="Religion"
          value={value.religion}
          options={RELIGION_OPTIONS}
          onChange={(next) => setField('religion', next)}
        />
        <SelectField
          id="race"
          label="Race"
          value={value.race}
          options={RACE_OPTIONS}
          onChange={(next) => setField('race', next)}
        />
      </div>

      <Separator />

      <SectionHeading
        icon={Home}
        title="Current address"
        description="Your residential address for HR records."
      />

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="current_address">Address</Label>
          <Textarea
            id="current_address"
            value={value.current_address || ''}
            onChange={(e) => setField('current_address', e.target.value)}
            placeholder="Full residential address"
            rows={3}
            maxLength={1000}
          />
        </div>
        <div className="space-y-1.5 sm:max-w-xs">
          <Label htmlFor="home_phone">Home phone</Label>
          <PhoneInput
            id="home_phone"
            value={value.home_phone || ''}
            onChange={(next) => setField('home_phone', next)}
            placeholder="e.g. 03-1234 5678"
          />
        </div>
      </div>

      <Separator />

      <SectionHeading
        icon={IdCard}
        title="Legal / HR identity"
        description="Statutory numbers used for payroll and compliance."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="ic_number">IC no. (NRIC)</Label>
          <IcInput
            id="ic_number"
            value={value.ic_number || ''}
            onChange={(next) => {
              onChange({
                ...value,
                ic_number: next,
                date_of_birth: applyIcDateOfBirth(value.date_of_birth, next),
              });
            }}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="epf_number">EPF no.</Label>
          <Input
            id="epf_number"
            value={value.epf_number || ''}
            onChange={(e) => setField('epf_number', e.target.value)}
            placeholder="EPF membership number"
            maxLength={30}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="socso_number">SOCSO no.</Label>
          <Input
            id="socso_number"
            value={value.socso_number || ''}
            onChange={(e) => setField('socso_number', e.target.value)}
            placeholder="SOCSO number"
            maxLength={30}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="income_tax_number">Income tax no.</Label>
          <Input
            id="income_tax_number"
            value={value.income_tax_number || ''}
            onChange={(e) => setField('income_tax_number', e.target.value)}
            placeholder="Income tax reference"
            maxLength={30}
          />
        </div>
      </div>

      <Separator />

      <SectionHeading
        icon={Users}
        title="Next of kin"
        description="Emergency contact details for HR records."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="emergency_contact_name">Full name</Label>
          <Input
            id="emergency_contact_name"
            value={value.emergency_contact_name || ''}
            onChange={(e) => setField('emergency_contact_name', e.target.value)}
            placeholder="Next of kin name"
            maxLength={150}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="next_of_kin_relationship">Relationship</Label>
          <Input
            id="next_of_kin_relationship"
            value={value.next_of_kin_relationship || ''}
            onChange={(e) => setField('next_of_kin_relationship', e.target.value)}
            placeholder="e.g. Father, Mother, Spouse"
            maxLength={50}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="emergency_contact_phone">Phone no.</Label>
          <PhoneInput
            id="emergency_contact_phone"
            value={value.emergency_contact_phone || ''}
            onChange={(next) => setField('emergency_contact_phone', next)}
            placeholder="e.g. +60 12-345 6789"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="next_of_kin_ic_number">IC no.</Label>
          <IcInput
            id="next_of_kin_ic_number"
            value={value.next_of_kin_ic_number || ''}
            onChange={(next) => setField('next_of_kin_ic_number', next)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="next_of_kin_nationality">Nationality</Label>
          <Input
            id="next_of_kin_nationality"
            value={value.next_of_kin_nationality || ''}
            onChange={(e) => setField('next_of_kin_nationality', e.target.value)}
            placeholder="e.g. Malaysian"
            maxLength={50}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="next_of_kin_occupation">Occupation</Label>
          <Input
            id="next_of_kin_occupation"
            value={value.next_of_kin_occupation || ''}
            onChange={(e) => setField('next_of_kin_occupation', e.target.value)}
            placeholder="e.g. Site Foreman"
            maxLength={150}
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="next_of_kin_address">Home address</Label>
          <Textarea
            id="next_of_kin_address"
            value={value.next_of_kin_address || ''}
            onChange={(e) => setField('next_of_kin_address', e.target.value)}
            placeholder="Full address"
            rows={3}
            maxLength={1000}
          />
        </div>
      </div>

      <Separator />

      <SectionHeading
        icon={Users}
        title="Spouse"
        description="Optional spouse details for HR records."
      />
      <SpouseDetailsEditor
        value={value.spouse_details}
        onChange={(next) => setField('spouse_details', next)}
        today={today}
      />

      <ChildrenDetailsEditor
        value={value.children}
        onChange={(children) => setField('children', children)}
        today={today}
      />

      <Separator />

      <SectionHeading
        icon={Activity}
        title="Health status"
        description="Required for HR records. Select None if there are no conditions."
      />
      <HealthStatusEditor
        value={value.health_status}
        onChange={(next) => setField('health_status', next)}
      />
    </div>
  );
}
