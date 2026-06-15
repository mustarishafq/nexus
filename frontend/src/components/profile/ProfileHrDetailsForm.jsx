// @ts-nocheck
import React from 'react';
import { HeartPulse, Home, IdCard, Users } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ProfileHistoryEditor from '@/components/profile/ProfileHistoryEditor';
import PhoneInput from '@/components/profile/PhoneInput';
import IcInput from '@/components/profile/IcInput';
import {
  CHILDREN_FIELDS,
  GENDER_OPTIONS,
  MARITAL_STATUS_OPTIONS,
  RACE_OPTIONS,
  RELIGION_OPTIONS,
  SPOUSE_FIELDS,
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

function SpouseDetailsEditor({ value, onChange }) {
  const spouse = value || {};

  const updateField = (key, nextValue) => {
    onChange({ ...spouse, [key]: nextValue });
  };

  return (
    <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {SPOUSE_FIELDS.map((field) => (
          <div key={field.key} className={field.fullWidth ? 'sm:col-span-2 space-y-1.5' : 'space-y-1.5'}>
            <Label htmlFor={`spouse-${field.key}`}>{field.label}</Label>
            {field.key === 'phone' ? (
              <PhoneInput
                id={`spouse-${field.key}`}
                value={spouse[field.key] || ''}
                onChange={(next) => updateField(field.key, next)}
                placeholder={field.placeholder}
              />
            ) : field.key === 'ic_number' ? (
              <IcInput
                id={`spouse-${field.key}`}
                value={spouse[field.key] || ''}
                onChange={(next) => updateField(field.key, next)}
                placeholder={field.placeholder}
              />
            ) : field.type === 'textarea' ? (
              <Textarea
                id={`spouse-${field.key}`}
                value={spouse[field.key] || ''}
                onChange={(e) => updateField(field.key, e.target.value)}
                placeholder={field.placeholder}
                rows={3}
              />
            ) : (
              <Input
                id={`spouse-${field.key}`}
                value={spouse[field.key] || ''}
                onChange={(e) => updateField(field.key, e.target.value)}
                placeholder={field.placeholder}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ProfileHrDetailsForm({ value, onChange }) {
  const setField = (key, nextValue) => {
    onChange({ ...value, [key]: nextValue });
  };

  return (
    <div className="space-y-6">
      <SectionHeading
        icon={HeartPulse}
        title="Demographics"
        description="Only you and admins can see this information."
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
            onChange={(next) => setField('ic_number', next)}
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
      />

      <ProfileHistoryEditor
        label="Children"
        description="Add children details if applicable."
        value={value.children?.length ? value.children : [{ name: '', age: '' }]}
        onChange={(children) => setField('children', children)}
        fields={CHILDREN_FIELDS}
        maxItems={10}
        addLabel="Add child"
      />
    </div>
  );
}
