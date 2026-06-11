import React from 'react';
import { Link } from 'react-router-dom';
import { Cake, Mail, Calendar, Layers, Sparkles, ArrowRight, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  formatBirthdayLabel,
  formatMemberSince,
  getProfileCompleteness,
} from '@/lib/profile';

export default function ProfileAboutCard({ user }) {
  const { percent } = getProfileCompleteness(user);
  const groups = (user?.access_group_names || []).filter(Boolean);
  const memberSince = formatMemberSince(user?.joined_at);
  const birthday = formatBirthdayLabel(user?.date_of_birth);

  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden">
      <div className="flex items-center gap-2 p-5 pb-3">
        <User className="w-4 h-4 text-primary" />
        <h3 className="font-semibold text-sm">About</h3>
      </div>

      <div className="px-5 pb-5 space-y-4">
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
          {percent < 100 ? (
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
