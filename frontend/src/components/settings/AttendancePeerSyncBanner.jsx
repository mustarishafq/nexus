// @ts-nocheck
import { cn } from '@/lib/utils';

function formatWhen(value) {
  if (!value) return null;
  const when = new Date(value);
  return Number.isNaN(when.getTime()) ? String(value) : when.toLocaleString();
}

/**
 * One-line sync status — keeps peer sync visible without a heavy banner.
 * @param {'insan'|'brain'} peerLocal
 */
export default function AttendancePeerSyncBanner({
  peerLocal = 'insan',
  syncMeta = null,
  className,
}) {
  const peerName = peerLocal === 'insan' ? 'Brain' : 'Insan';
  const when = formatWhen(syncMeta?.last_synced_at);
  const inbound = syncMeta?.last_direction === 'inbound';

  let text = `Syncs with ${peerName} when you save`;
  if (when) {
    text = inbound
      ? `Last sync from ${peerName} · ${when}`
      : `Last sync to ${peerName} · ${when}`;
  }

  return (
    <p className={cn('text-xs text-muted-foreground', className)}>
      {text}
    </p>
  );
}
