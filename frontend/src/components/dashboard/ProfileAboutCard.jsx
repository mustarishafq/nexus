import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Cake, Mail, Calendar, Layers, Sparkles, ArrowRight, User, Check, Circle,
  Briefcase, MessageSquare, Phone, Users, ChevronDown,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import {
  formatBirthdayLabel,
  formatMemberSince,
  formatTenure,
  getProfileCompleteness,
  normalizeSkills,
  getDisplayName,
} from '@/lib/profile';
import { formatPhoneNumber, phoneTelHref } from '@/lib/phone';

export default function ProfileAboutCard({ user, showCompleteLink = true, showChecklist = false }) {
  const [checklistExpanded, setChecklistExpanded] = useState(false);
  const { percent, doneCount, totalCount, checks } = getProfileCompleteness(user);
  const incompleteChecks = checks.filter((item) => !item.done);
  const visibleChecks = checklistExpanded ? incompleteChecks : incompleteChecks.slice(0, 3);
  const groups = (user?.access_group_names || []).filter(Boolean);
  const skills = normalizeSkills(user?.skills);
  const memberSince = formatMemberSince(user?.joined_at);
  const birthday = formatBirthdayLabel(user?.date_of_birth);

  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden">
      <div className="flex items-center gap-2 p-5 pb-3">
        <User className="w-4 h-4 text-primary" />
        <h3 className="font-semibold text-sm">About</h3>
      </div>

      <div className="px-5 pb-5 space-y-4">
        {user?.bio ? (
          <div className="rounded-xl border border-border/80 bg-muted/20 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">Bio</p>
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{user.bio}</p>
          </div>
        ) : null}

        {user?.ask_me_about ? (
          <div className="flex items-start gap-3 text-sm">
            <MessageSquare className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Ask me about</p>
              <p className="font-medium">{user.ask_me_about}</p>
            </div>
          </div>
        ) : null}

        {user?.job_title ? (
          <div className="flex items-start gap-3 text-sm">
            <Briefcase className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Job title</p>
              <p className="font-medium">{user.job_title}</p>
            </div>
          </div>
        ) : null}

        {user?.department ? (
          <div className="flex items-start gap-3 text-sm">
            <Briefcase className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">Department</p>
              <p className="font-medium">{user.department}</p>
            </div>
          </div>
        ) : null}

        {user?.manager ? (
          <div className="flex items-start gap-3 text-sm">
            <Users className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Reports to</p>
              <Link to={`/people/${user.manager.id}`} className="font-medium hover:text-primary">
                {getDisplayName(user.manager)}
              </Link>
            </div>
          </div>
        ) : null}

        {user?.work_phone ? (
          <div className="flex items-start gap-3 text-sm">
            <Phone className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Work phone</p>
              <a href={phoneTelHref(user.work_phone)} className="font-medium hover:text-primary">
                {formatPhoneNumber(user.work_phone)}
              </a>
            </div>
          </div>
        ) : null}

        {user?.personal_phone ? (
          <div className="flex items-start gap-3 text-sm">
            <Phone className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Personal phone</p>
              <a href={phoneTelHref(user.personal_phone)} className="font-medium hover:text-primary">
                {formatPhoneNumber(user.personal_phone)}
              </a>
            </div>
          </div>
        ) : null}

        {user?.email ? (
          <div className="flex items-start gap-3 text-sm">
            <Mail className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Email</p>
              <p className="font-medium truncate">{user.email}</p>
            </div>
          </div>
        ) : null}

        {memberSince ? (
          <div className="flex items-start gap-3 text-sm">
            <Calendar className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Member since</p>
              <p className="font-medium">{memberSince}</p>
              {formatTenure(user?.joined_at) ? (
                <p className="text-xs text-muted-foreground mt-0.5">{formatTenure(user.joined_at)} with the team</p>
              ) : null}
            </div>
          </div>
        ) : null}

        {birthday ? (
          <div className="flex items-start gap-3 text-sm">
            <Cake className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Birthday</p>
              <p className="font-medium">{birthday}</p>
            </div>
          </div>
        ) : null}

        {skills.length > 0 ? (
          <div className="flex items-start gap-3 text-sm">
            <Sparkles className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground mb-2">Skills & interests</p>
              <div className="flex flex-wrap gap-1.5">
                {skills.map((skill) => (
                  <Badge key={skill} variant="secondary" className="text-[10px] font-medium">
                    {skill}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        <div className="flex items-start gap-3 text-sm">
          <Layers className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground mb-2">Access groups</p>
            {groups.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {groups.map((name, index) => (
                  <Badge key={`${name}-${index}`} variant="secondary" className="text-[10px] font-medium">
                    {name}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-xs">No groups assigned yet</p>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border/80 bg-muted/20 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <p className="text-sm font-medium">Profile strength</p>
            </div>
            <span className="text-sm font-bold text-primary tabular-nums">{percent}%</span>
          </div>
          <Progress value={percent} className="h-2" />
          {showChecklist && percent < 100 ? (
            <div className="space-y-2 pt-1">
              <p className="text-xs text-muted-foreground">
                {doneCount} of {totalCount} sections complete
              </p>
              {incompleteChecks.length > 0 ? (
                <ul className="space-y-1.5">
                  {visibleChecks.map((item) => (
                    <li key={item.key} className="flex items-center gap-2 text-xs">
                      <Circle className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
                      <span className="text-foreground font-medium">{item.label}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              {incompleteChecks.length > 3 ? (
                <button
                  type="button"
                  onClick={() => setChecklistExpanded((prev) => !prev)}
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  {checklistExpanded ? 'Show less' : `Show all ${incompleteChecks.length} remaining`}
                  <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', checklistExpanded && 'rotate-180')} />
                </button>
              ) : null}
            </div>
          ) : showChecklist && percent === 100 ? (
            <p className="text-xs text-muted-foreground pt-1 flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-primary shrink-0" />
              All profile sections complete
            </p>
          ) : null}
          {showCompleteLink && percent < 100 ? (
            <Link to="/profile" className="block mt-2">
              <Button variant="outline" size="sm" className="w-full gap-2 h-8 text-xs">
                Complete profile
                <ArrowRight className="w-3 h-3" />
              </Button>
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
