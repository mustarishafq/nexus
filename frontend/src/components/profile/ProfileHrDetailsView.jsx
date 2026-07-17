import React from 'react';
import { HeartPulse, Home, IdCard, Shield, Users } from 'lucide-react';
import { formatPhoneNumber, phoneTelHref } from '@/lib/phone';
import {
  getGenderLabel,
  getMaritalStatusLabel,
  getRaceLabel,
  getReligionLabel,
  normalizeSpouseDetails,
  SPOUSE_FIELDS,
} from '@/lib/profile';

function Section({ icon: Icon, title, children }) {
  if (!children) return null;

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2 p-5 pb-3">
        <Icon className="w-4 h-4 text-primary" />
        <h3 className="font-semibold text-sm">{title}</h3>
      </div>
      <div className="px-5 pb-5">{children}</div>
    </div>
  );
}

function Field({ label, value, href, multiline = false }) {
  if (!value) return null;

  const content = href ? (
    <a href={href} className="font-medium hover:text-primary break-all">
      {formatPhoneNumber(value)}
    </a>
  ) : multiline ? (
    <p className="font-medium whitespace-pre-wrap break-words">{value}</p>
  ) : (
    <p className="font-medium break-all">{value}</p>
  );

  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="text-sm mt-0.5">{content}</div>
    </div>
  );
}

function hasAnyValue(values) {
  return values.some((value) => {
    if (Array.isArray(value)) return value.length > 0;
    if (value && typeof value === 'object') {
      return Object.values(value).some((entry) => Boolean(String(entry || '').trim()));
    }
    return Boolean(String(value || '').trim());
  });
}

export default function ProfileHrDetailsView({ user }) {
  const spouse = normalizeSpouseDetails(user?.spouse_details);
  const children = Array.isArray(user?.children)
    ? user.children.filter((child) => child?.name || child?.age)
    : [];

  const demographics = [
    { label: 'Full legal name', value: user?.full_name },
    { label: 'Gender', value: getGenderLabel(user?.gender) },
    { label: 'Marital status', value: getMaritalStatusLabel(user?.marital_status) },
    { label: 'Place of birth', value: user?.place_of_birth },
    { label: 'Nationality', value: user?.nationality },
    { label: 'Religion', value: getReligionLabel(user?.religion) },
    { label: 'Race', value: getRaceLabel(user?.race) },
  ];

  const identity = [
    { label: 'IC no. (NRIC)', value: user?.ic_number },
    { label: 'EPF no.', value: user?.epf_number },
    { label: 'SOCSO no.', value: user?.socso_number },
    { label: 'Income tax no.', value: user?.income_tax_number },
  ];

  const nextOfKin = [
    { label: 'Full name', value: user?.emergency_contact_name },
    { label: 'Relationship', value: user?.next_of_kin_relationship },
    {
      label: 'Phone no.',
      value: user?.emergency_contact_phone,
      href: phoneTelHref(user?.emergency_contact_phone),
    },
    { label: 'IC no.', value: user?.next_of_kin_ic_number },
    { label: 'Nationality', value: user?.next_of_kin_nationality },
    { label: 'Occupation', value: user?.next_of_kin_occupation },
    { label: 'Home address', value: user?.next_of_kin_address, multiline: true },
  ];

  const spouseFields = SPOUSE_FIELDS.map((field) => ({
    label: field.label,
    value: spouse[field.key],
    href: field.key === 'phone' ? phoneTelHref(spouse[field.key]) : undefined,
    multiline: field.type === 'textarea',
  }));

  const showDemographics = hasAnyValue(demographics.map((field) => field.value));
  const showAddress = hasAnyValue([user?.current_address, user?.home_phone]);
  const showIdentity = hasAnyValue(identity.map((field) => field.value));
  const showNextOfKin = hasAnyValue(nextOfKin.map((field) => field.value));
  const showSpouse = hasAnyValue(spouseFields.map((field) => field.value));
  const showChildren = children.length > 0;

  if (!showDemographics && !showAddress && !showIdentity && !showNextOfKin && !showSpouse && !showChildren) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-5">
        <div className="flex items-start gap-3">
          <Shield className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium">HR profiling</p>
            <p className="text-xs text-muted-foreground mt-1">
              No private HR details have been filled in yet.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 px-1">
        <Shield className="w-4 h-4 text-primary" />
        <div>
          <p className="text-sm font-semibold">HR profiling</p>
          <p className="text-xs text-muted-foreground">Visible to Admin and HR only</p>
        </div>
      </div>

      {showDemographics ? (
        <Section icon={HeartPulse} title="Demographics">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {demographics.map((field) => (
              <Field key={field.label} label={field.label} value={field.value} />
            ))}
          </div>
        </Section>
      ) : null}

      {showAddress ? (
        <Section icon={Home} title="Current address">
          <div className="space-y-4">
            <Field label="Address" value={user?.current_address} multiline />
            <Field
              label="Home phone"
              value={user?.home_phone}
              href={phoneTelHref(user?.home_phone)}
            />
          </div>
        </Section>
      ) : null}

      {showIdentity ? (
        <Section icon={IdCard} title="Legal / HR identity">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {identity.map((field) => (
              <Field key={field.label} label={field.label} value={field.value} />
            ))}
          </div>
        </Section>
      ) : null}

      {showNextOfKin ? (
        <Section icon={Users} title="Next of kin">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {nextOfKin.map((field) => (
              <Field
                key={field.label}
                label={field.label}
                value={field.value}
                href={field.href}
                multiline={field.multiline}
              />
            ))}
          </div>
        </Section>
      ) : null}

      {showSpouse ? (
        <Section icon={Users} title="Spouse">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {spouseFields.map((field) => (
              <Field
                key={field.label}
                label={field.label}
                value={field.value}
                href={field.href}
                multiline={field.multiline}
              />
            ))}
          </div>
        </Section>
      ) : null}

      {showChildren ? (
        <Section icon={Users} title="Children">
          <div className="space-y-3">
            {children.map((child, index) => (
              <div
                key={`${child.name || 'child'}-${index}`}
                className="rounded-xl border border-border/80 bg-muted/20 p-4"
              >
                <p className="text-sm font-medium">{child.name || 'Unnamed'}</p>
                {child.age ? (
                  <p className="text-xs text-muted-foreground mt-0.5">Age {child.age}</p>
                ) : null}
              </div>
            ))}
          </div>
        </Section>
      ) : null}
    </div>
  );
}
