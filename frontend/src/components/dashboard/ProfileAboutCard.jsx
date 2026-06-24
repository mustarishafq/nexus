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
import { useIsMobile } from '@/hooks/use-mobile';
import {
  formatBirthdayLabel,
  formatMemberSince,
  formatTenure,
  getProfileCompleteness,
  normalizeSkills,
  getDisplayName,
} from '@/lib/profile';
import { formatPhoneNumber, phoneTelHref } from '@/lib/phone';

const COMPACT_VISIBLE_COUNT = 4;
const MOBILE_COMPACT_VISIBLE_COUNT = 3;

const ABOUT_PRIORITY = {
  bio: 10,
  ask_me_about: 20,
  work_phone: 30,
  personal_phone: 40,
  manager: 50,
  job_title: 60,
  department: 70,
  email: 80,
  skills: 90,
  member_since: 100,
  birthday: 110,
  access_groups: 120,
};

const HERO_REDUNDANT_KEYS = new Set(['job_title', 'department', 'email']);

function AboutRow({ icon: Icon, label, children, iconClassName, className }) {
  return (
    <div className={cn('flex items-start gap-3 text-sm', className)}>
      <Icon className={cn('w-4 h-4 text-muted-foreground mt-0.5 shrink-0', iconClassName)} />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="font-medium">{children}</div>
      </div>
    </div>
  );
}

function ProfileStrengthBlock({
  percent,
  showChecklist,
  doneCount,
  totalCount,
  incompleteChecks,
  visibleChecks,
  checklistExpanded,
  setChecklistExpanded,
  showCompleteLink,
  compactClassName,
}) {
  return (
    <div className={cn('rounded-xl border border-border/80 bg-muted/20 p-4 space-y-3', compactClassName)}>
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
  );
}

export default function ProfileAboutCard({
  user,
  showCompleteLink = true,
  showChecklist = false,
  compact = false,
  defaultCollapsed = false,
  isOwnProfile = false,
}) {
  const isMobile = useIsMobile();
  const isMobileCompact = compact && isMobile;
  const isCollapsible = defaultCollapsed && isMobile;
  const [checklistExpanded, setChecklistExpanded] = useState(false);
  const [aboutExpanded, setAboutExpanded] = useState(false);
  const [bioExpanded, setBioExpanded] = useState(false);
  const [cardCollapsed, setCardCollapsed] = useState(defaultCollapsed);
  const { percent, doneCount, totalCount, checks } = getProfileCompleteness(user);
  const incompleteChecks = checks.filter((item) => !item.done);
  const visibleChecks = checklistExpanded ? incompleteChecks : incompleteChecks.slice(0, 3);
  const groups = (user?.access_group_names || []).filter(Boolean);
  const skills = normalizeSkills(user?.skills);
  const memberSince = formatMemberSince(user?.joined_at);
  const birthday = formatBirthdayLabel(user?.date_of_birth);
  const tenure = formatTenure(user?.joined_at);
  const hasPhoneActions = Boolean(user?.work_phone || user?.personal_phone);
  const showContactActions = isMobileCompact && hasPhoneActions && !isOwnProfile;

  const profileStrength = (
    <ProfileStrengthBlock
      percent={percent}
      showChecklist={showChecklist}
      doneCount={doneCount}
      totalCount={totalCount}
      incompleteChecks={incompleteChecks}
      visibleChecks={visibleChecks}
      checklistExpanded={checklistExpanded}
      setChecklistExpanded={setChecklistExpanded}
      showCompleteLink={showCompleteLink}
      compactClassName={isMobileCompact ? 'p-3.5' : undefined}
    />
  );

  const aboutItems = [
    user?.bio ? {
      key: 'bio',
      priority: ABOUT_PRIORITY.bio,
      content: (
        <div className="rounded-xl border border-border/80 bg-muted/20 p-3.5 sm:p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1.5">Bio</p>
          <p
            className={cn(
              'text-sm leading-relaxed whitespace-pre-wrap',
              isMobile && !bioExpanded && 'line-clamp-3'
            )}
          >
            {user.bio}
          </p>
          {isMobile && user.bio.length > 120 ? (
            <button
              type="button"
              onClick={() => setBioExpanded((prev) => !prev)}
              className="mt-1.5 text-xs text-primary hover:underline"
            >
              {bioExpanded ? 'Show less' : 'Read more'}
            </button>
          ) : null}
        </div>
      ),
    } : null,
    user?.ask_me_about ? {
      key: 'ask_me_about',
      priority: ABOUT_PRIORITY.ask_me_about,
      content: (
        <AboutRow icon={MessageSquare} label="Ask me about" iconClassName="text-primary">
          {user.ask_me_about}
        </AboutRow>
      ),
    } : null,
    user?.work_phone && !showContactActions ? {
      key: 'work_phone',
      priority: ABOUT_PRIORITY.work_phone,
      content: (
        <AboutRow icon={Phone} label="Work phone">
          {isOwnProfile ? (
            formatPhoneNumber(user.work_phone)
          ) : (
            <a href={phoneTelHref(user.work_phone)} className="hover:text-primary">
              {formatPhoneNumber(user.work_phone)}
            </a>
          )}
        </AboutRow>
      ),
    } : null,
    user?.personal_phone && !showContactActions ? {
      key: 'personal_phone',
      priority: ABOUT_PRIORITY.personal_phone,
      content: (
        <AboutRow icon={Phone} label="Personal phone">
          {isOwnProfile ? (
            formatPhoneNumber(user.personal_phone)
          ) : (
            <a href={phoneTelHref(user.personal_phone)} className="hover:text-primary">
              {formatPhoneNumber(user.personal_phone)}
            </a>
          )}
        </AboutRow>
      ),
    } : null,
    user?.manager ? {
      key: 'manager',
      priority: ABOUT_PRIORITY.manager,
      content: (
        <AboutRow icon={Users} label="Reports to">
          <Link to={`/people/${user.manager.id}`} className="hover:text-primary">
            {getDisplayName(user.manager)}
          </Link>
        </AboutRow>
      ),
    } : null,
    user?.job_title ? {
      key: 'job_title',
      priority: ABOUT_PRIORITY.job_title,
      content: (
        <AboutRow icon={Briefcase} label="Job title" iconClassName="text-primary">
          {user.job_title}
        </AboutRow>
      ),
    } : null,
    user?.department ? {
      key: 'department',
      priority: ABOUT_PRIORITY.department,
      content: (
        <AboutRow icon={Briefcase} label="Department">
          {user.department}
        </AboutRow>
      ),
    } : null,
    user?.email ? {
      key: 'email',
      priority: ABOUT_PRIORITY.email,
      content: (
        <AboutRow icon={Mail} label="Email">
          <span className="truncate block">{user.email}</span>
        </AboutRow>
      ),
    } : null,
    memberSince ? {
      key: 'member_since',
      priority: ABOUT_PRIORITY.member_since,
      mobileGrid: true,
      content: isMobile ? (
        <div className="rounded-lg border border-border/60 bg-muted/10 px-3 py-2.5">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Member since</p>
          <p className="text-sm font-medium mt-0.5">{memberSince}</p>
          {tenure ? (
            <p className="text-[11px] text-muted-foreground mt-0.5">{tenure} with the team</p>
          ) : null}
        </div>
      ) : (
        <AboutRow icon={Calendar} label="Member since">
          <>
            {memberSince}
            {tenure ? (
              <p className="text-xs text-muted-foreground font-normal mt-0.5">{tenure} with the team</p>
            ) : null}
          </>
        </AboutRow>
      ),
    } : null,
    birthday ? {
      key: 'birthday',
      priority: ABOUT_PRIORITY.birthday,
      mobileGrid: true,
      content: isMobile ? (
        <div className="rounded-lg border border-border/60 bg-muted/10 px-3 py-2.5">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Birthday</p>
          <p className="text-sm font-medium mt-0.5">{birthday}</p>
        </div>
      ) : (
        <AboutRow icon={Cake} label="Birthday">
          {birthday}
        </AboutRow>
      ),
    } : null,
    skills.length > 0 ? {
      key: 'skills',
      priority: ABOUT_PRIORITY.skills,
      content: (
        <AboutRow icon={Sparkles} label="Skills & interests">
          <div className="flex flex-wrap gap-1.5 mt-1.5 font-normal">
            {(isMobileCompact && !aboutExpanded ? skills.slice(0, 5) : skills).map((skill) => (
              <Badge key={skill} variant="secondary" className="text-[10px] font-medium">
                {skill}
              </Badge>
            ))}
            {isMobileCompact && !aboutExpanded && skills.length > 5 ? (
              <Badge variant="outline" className="text-[10px] font-medium">
                +{skills.length - 5}
              </Badge>
            ) : null}
          </div>
        </AboutRow>
      ),
    } : null,
    {
      key: 'access_groups',
      priority: ABOUT_PRIORITY.access_groups,
      content: (
        <AboutRow icon={Layers} label="Access groups">
          {groups.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 mt-1.5 font-normal">
              {(isMobileCompact && !aboutExpanded ? groups.slice(0, 4) : groups).map((name, index) => (
                <Badge key={`${name}-${index}`} variant="secondary" className="text-[10px] font-medium">
                  {name}
                </Badge>
              ))}
              {isMobileCompact && !aboutExpanded && groups.length > 4 ? (
                <Badge variant="outline" className="text-[10px] font-medium">
                  +{groups.length - 4}
                </Badge>
              ) : null}
            </div>
          ) : (
            <p className="text-muted-foreground text-xs font-normal mt-0.5">No groups assigned yet</p>
          )}
        </AboutRow>
      ),
    },
  ]
    .filter(Boolean)
    .filter((item) => !(isMobileCompact && HERO_REDUNDANT_KEYS.has(item.key)))
    .sort((a, b) => a.priority - b.priority);

  const visibleLimit = isMobileCompact ? MOBILE_COMPACT_VISIBLE_COUNT : COMPACT_VISIBLE_COUNT;
  const hasHiddenAboutItems = compact && aboutItems.length > visibleLimit;
  const visibleAboutItems = compact && !aboutExpanded
    ? aboutItems.slice(0, visibleLimit)
    : aboutItems;
  const hiddenAboutCount = aboutItems.length - visibleLimit;

  const gridItems = visibleAboutItems.filter((item) => item.mobileGrid);
  const listItems = visibleAboutItems.filter((item) => !item.mobileGrid);

  const phoneActions = showContactActions ? (
    <div className="flex flex-wrap gap-2">
      {user?.work_phone ? (
        <a
          href={phoneTelHref(user.work_phone)}
          className="inline-flex flex-1 min-w-[7.5rem] items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium hover:bg-muted/50 transition-colors"
        >
          <Phone className="w-3.5 h-3.5 text-primary" />
          Work
        </a>
      ) : null}
      {user?.personal_phone ? (
        <a
          href={phoneTelHref(user.personal_phone)}
          className="inline-flex flex-1 min-w-[7.5rem] items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium hover:bg-muted/50 transition-colors"
        >
          <Phone className="w-3.5 h-3.5 text-primary" />
          Personal
        </a>
      ) : null}
      {user?.email ? (
        <a
          href={`mailto:${user.email}`}
          className="inline-flex flex-1 min-w-[7.5rem] items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium hover:bg-muted/50 transition-colors"
        >
          <Mail className="w-3.5 h-3.5 text-primary" />
          Email
        </a>
      ) : null}
    </div>
  ) : null;

  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden">
      {isCollapsible ? (
        <button
          type="button"
          onClick={() => setCardCollapsed((prev) => !prev)}
          className={cn(
            'flex w-full items-center justify-between gap-2 p-5 text-left',
            isMobile && 'px-4 pt-4',
            cardCollapsed ? 'pb-4' : 'pb-3'
          )}
        >
          <div className="flex items-center gap-2 min-w-0">
            <User className="w-4 h-4 text-primary shrink-0" />
            <h3 className="font-semibold text-sm">About</h3>
            {cardCollapsed ? (
              <span className="text-xs text-muted-foreground truncate">
                {percent}% profile complete
              </span>
            ) : null}
          </div>
          <ChevronDown
            className={cn(
              'w-4 h-4 text-muted-foreground shrink-0 transition-transform',
              !cardCollapsed && 'rotate-180'
            )}
          />
        </button>
      ) : (
        <div className={cn('flex items-center gap-2 p-5 pb-3', isMobile && 'px-4 pt-4 pb-2')}>
          <User className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-sm">About</h3>
        </div>
      )}

      {isCollapsible && cardCollapsed ? null : (
      <div className={cn('px-5 pb-5 space-y-4', isMobile && 'px-4 pb-4 space-y-3')}>
        {isMobileCompact ? profileStrength : null}

        {phoneActions}

        {isMobile ? (
          <>
            {listItems.map((item) => (
              <React.Fragment key={item.key}>{item.content}</React.Fragment>
            ))}
            {gridItems.length > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                {gridItems.map((item) => (
                  <React.Fragment key={item.key}>{item.content}</React.Fragment>
                ))}
              </div>
            ) : null}
          </>
        ) : (
          visibleAboutItems.map((item) => (
            <React.Fragment key={item.key}>{item.content}</React.Fragment>
          ))
        )}

        {hasHiddenAboutItems ? (
          <button
            type="button"
            onClick={() => setAboutExpanded((prev) => !prev)}
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            {aboutExpanded ? 'Show less' : `Show ${hiddenAboutCount} more`}
            <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', aboutExpanded && 'rotate-180')} />
          </button>
        ) : null}

        {!isMobileCompact ? profileStrength : null}
      </div>
      )}
    </div>
  );
}
