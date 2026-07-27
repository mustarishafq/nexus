import React, { useState } from 'react';
import { Download, Loader2, Paperclip } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import db from '@/api/apiClient';

function formatFileSize(bytes) {
  if (bytes == null || Number.isNaN(Number(bytes))) return null;
  const size = Number(bytes);
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export default function EmailAttachments({
  attachments = [],
  uid,
  accountId,
  folder,
}) {
  const [downloadingPart, setDownloadingPart] = useState(null);

  if (!attachments.length) {
    return null;
  }

  const handleDownload = async (attachment) => {
    setDownloadingPart(attachment.part);
    try {
      await db.mail.downloadAttachment(uid, attachment.part, {
        accountId,
        folder,
        filename: attachment.filename,
      });
    } catch (error) {
      toast.error(error?.message || 'Unable to download attachment.');
    } finally {
      setDownloadingPart(null);
    }
  };

  return (
    <div className="mb-4 rounded-lg border border-border/60 bg-muted/20 p-3">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Paperclip className="h-3.5 w-3.5" />
        {attachments.length} attachment{attachments.length === 1 ? '' : 's'}
      </p>
      <ul className="space-y-2">
        {attachments.map((attachment) => {
          const sizeLabel = formatFileSize(attachment.size);
          const isDownloading = downloadingPart === attachment.part;

          return (
            <li
              key={attachment.part}
              className="flex items-center gap-2 rounded-md border border-border/50 bg-background/60 px-3 py-2 text-sm"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{attachment.filename}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {[attachment.mime, sizeLabel].filter(Boolean).join(' · ')}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 shrink-0 gap-1.5"
                disabled={isDownloading}
                onClick={() => handleDownload(attachment)}
              >
                {isDownloading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
                Download
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
