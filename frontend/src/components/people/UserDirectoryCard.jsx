import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import db from '@/api/apiClient';
import { Briefcase, MessageCircle, Sparkles } from 'lucide-react';
import UserAvatar from '@/components/users/UserAvatar';
import { useIsUserOnline } from '@/components/presence/UserPresenceGate';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatTenure, getDisplayName } from '@/lib/profile';

export default function UserDirectoryCard({ user, className }) {
  const navigate = useNavigate();
  const displayName = getDisplayName(user);
  const presenceOnline = useIsUserOnline(user?.id);
  const isOnline = user?.is_online ?? presenceOnline;
  const skills = Array.isArray(user?.skills) ? user.skills.filter(Boolean).slice(0, 4) : [];
  const groups = (user?.access_group_names || []).filter(Boolean).slice(0, 2);
  const tenure = formatTenure(user?.joined_at);

  return (
    <article
      className={cn(
        'group flex h-full flex-col rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/30 hover:bg-primary/[0.02]',
        className
      )}
    >
      <div className="flex items-start gap-3">
        <UserAvatar user={user} className="h-12 w-12" />
        <div className="min-w-0 flex-1">
          <Link
            to={`/people/${user.id}`}
            className="block truncate text-sm font-semibold hover:text-primary"
          >
            {displayName}
          </Link>
          {isOnline ? (
            <p className="mt-0.5 text-[11px] font-medium text-success">Online</p>
          ) : null}
          {user?.job_title ? (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{user.job_title}</p>
          ) : null}
          {user?.department ? (
            <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
              <Briefcase className="h-3.5 w-3.5 shrink-0" />
              {user.department}
            </p>
          ) : null}
        </div>
      </div>

      {user?.bio ? (
        <p className="mt-4 line-clamp-3 text-sm leading-relaxed text-muted-foreground">{user.bio}</p>
      ) : (
        <p className="mt-4 text-sm italic text-muted-foreground/70">No bio added yet.</p>
      )}

      {user?.ask_me_about ? (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-primary/10 bg-primary/[0.04] px-3 py-2">
          <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
          <p className="text-xs leading-relaxed text-foreground/90">
            <span className="font-medium">Ask me about:</span> {user.ask_me_about}
          </p>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-1.5">
        {skills.map((skill) => (
          <Badge key={skill} variant="secondary" className="text-[10px] font-medium">
            {skill}
          </Badge>
        ))}
        {groups.map((name) => (
          <Badge key={name} variant="outline" className="text-[10px] font-medium">
            {name}
          </Badge>
        ))}
        {tenure ? (
          <Badge variant="outline" className="text-[10px] font-medium capitalize">
            {tenure}
          </Badge>
        ) : null}
      </div>

      <div className="mt-auto flex gap-2 pt-4">
        <Button asChild variant="outline" size="sm" className="h-8 flex-1 text-xs">
          <Link to={`/people/${user.id}`}>
            View profile
          </Link>
        </Button>
        <Button
          type="button"
          variant="default"
          size="sm"
          className="h-8 flex-1 text-xs"
          onClick={async () => {
            try {
              const payload = await db.messages.startConversation(user.id);
              if (payload?.conversation?.id) {
                navigate(`/messages/${payload.conversation.id}`);
                return;
              }
            } catch {
              // Fall through to compose view.
            }
            navigate(`/messages/new/${user.id}`);
          }}
        >
          <MessageCircle className="mr-2 h-3.5 w-3.5" />
          Message
        </Button>
      </div>
    </article>
  );
}
