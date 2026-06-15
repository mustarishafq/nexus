import React from 'react';
import { Link } from 'react-router-dom';
import {
  Briefcase, GraduationCap, History, Phone, UserRound, Users,
} from 'lucide-react';
import {
  formatHistoryRange,
  getDisplayName,
  getEmploymentTypeLabel,
  normalizeEducationHistory,
  normalizeWorkHistory,
} from '@/lib/profile';

function ContactRow({ icon: Icon, label, value, href }) {
  if (!value) return null;

  const content = href ? (
    <a href={href} className="font-medium hover:text-primary break-all">
      {value}
    </a>
  ) : (
    <p className="font-medium break-all">{value}</p>
  );

  return (
    <div className="flex items-start gap-3 text-sm">
      <Icon className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        {content}
      </div>
    </div>
  );
}

function HistorySection({ title, icon: Icon, items, renderItem }) {
  if (!items.length) return null;

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2 p-5 pb-3">
        <Icon className="w-4 h-4 text-primary" />
        <h3 className="font-semibold text-sm">{title}</h3>
      </div>
      <div className="px-5 pb-5 space-y-3">
        {items.map((item, index) => (
          <div key={`${title}-${index}`} className="rounded-xl border border-border/80 bg-muted/20 p-4">
            {renderItem(item)}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ProfileStaffDetails({ user }) {
  const education = normalizeEducationHistory(user?.education_history);
  const experience = normalizeWorkHistory(user?.work_history);
  const manager = user?.manager;
  const employmentType = getEmploymentTypeLabel(user?.employment_type);

  const hasWorkDetails = Boolean(
    user?.job_title || manager || user?.work_phone || user?.personal_phone || employmentType
  );

  return (
    <div className="space-y-4">
      {hasWorkDetails ? (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="flex items-center gap-2 p-5 pb-3">
            <Briefcase className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-sm">Work</h3>
          </div>
          <div className="px-5 pb-5 space-y-4">
            {user?.job_title ? (
              <div>
                <p className="text-xs text-muted-foreground">Job title</p>
                <p className="text-sm font-medium mt-0.5">{user.job_title}</p>
              </div>
            ) : null}

            {employmentType ? (
              <div>
                <p className="text-xs text-muted-foreground">Employment type</p>
                <p className="text-sm font-medium mt-0.5">{employmentType}</p>
              </div>
            ) : null}

            {manager ? (
              <div className="flex items-start gap-3 text-sm">
                <Users className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Reports to</p>
                  <Link to={`/people/${manager.id}`} className="font-medium hover:text-primary">
                    {getDisplayName(manager)}
                  </Link>
                  {manager.job_title ? (
                    <p className="text-xs text-muted-foreground mt-0.5">{manager.job_title}</p>
                  ) : null}
                </div>
              </div>
            ) : null}

            <ContactRow
              icon={Phone}
              label="Work phone"
              value={user?.work_phone}
              href={user?.work_phone ? `tel:${user.work_phone}` : null}
            />
            <ContactRow
              icon={Phone}
              label="Personal phone"
              value={user?.personal_phone}
              href={user?.personal_phone ? `tel:${user.personal_phone}` : null}
            />
          </div>
        </div>
      ) : null}

      <HistorySection
        title="Education"
        icon={GraduationCap}
        items={education}
        renderItem={(item) => (
          <div className="space-y-1">
            <p className="text-sm font-medium">{item.institution}</p>
            {item.qualification ? <p className="text-sm">{item.qualification}</p> : null}
            {item.field_of_study ? (
              <p className="text-xs text-muted-foreground">{item.field_of_study}</p>
            ) : null}
            {formatHistoryRange(item.year_from, item.year_to) ? (
              <p className="text-xs text-muted-foreground">
                {formatHistoryRange(item.year_from, item.year_to)}
              </p>
            ) : null}
          </div>
        )}
      />

      <HistorySection
        title="Experience"
        icon={History}
        items={experience}
        renderItem={(item) => (
          <div className="space-y-1">
            <p className="text-sm font-medium">{item.company}</p>
            {item.job_title ? <p className="text-sm">{item.job_title}</p> : null}
            {formatHistoryRange(item.date_from, item.date_to) ? (
              <p className="text-xs text-muted-foreground">
                {formatHistoryRange(item.date_from, item.date_to)}
              </p>
            ) : null}
            {item.description ? (
              <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">{item.description}</p>
            ) : null}
          </div>
        )}
      />

      {user?.employee_id ? (
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-start gap-3 text-sm">
            <UserRound className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Employee ID</p>
              <p className="font-medium">{user.employee_id}</p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
