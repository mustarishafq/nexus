import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Newspaper } from 'lucide-react';
import db from '@/api/apiClient';
import { Button } from '@/components/ui/button';
import { FeedItem } from '@/components/feed/FeedItems';

export default function CompanyFeedWidget() {
  const { data } = useQuery({
    queryKey: ['company-feed', 'dashboard'],
    queryFn: () => db.feed.list({ limit: 5 }),
    staleTime: 30_000,
  });

  const items = Array.isArray(data?.items) ? data.items.slice(0, 3) : [];

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border/50 px-3 py-3 md:px-5 md:py-4">
        <div className="flex items-center gap-2">
          <Newspaper className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Company Feed</h3>
        </div>
        <Button asChild variant="ghost" size="sm" className="h-7 text-xs text-primary hover:text-primary">
          <Link to="/feed">View all</Link>
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="px-5 py-8 text-center text-sm text-muted-foreground">
          No updates yet.{' '}
          <Link to="/feed" className="font-medium text-primary hover:underline">
            Share something with your team
          </Link>
        </div>
      ) : (
        <div className="divide-y divide-border/50">
          {items.map((item) => (
            <FeedItem key={`${item.type}-${item.id}`} item={item} compact />
          ))}
        </div>
      )}
    </div>
  );
}
