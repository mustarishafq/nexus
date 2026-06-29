import React, { useRef, useState } from 'react';
import { Loader2, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import db from '@/api/apiClient';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { toAbsoluteUrl } from '@/lib/media';
import { clearWatermarkLogoCache } from '@/lib/watermarkConfig';

const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,image/svg+xml';
const MAX_BYTES = 10 * 1024 * 1024;

export default function AttendanceWatermarkLogoUploader({ value, onChange, onClear }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const previewUrl = value ? toAbsoluteUrl(value) : '';

  const handleSelect = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file.');
      return;
    }

    if (file.size > MAX_BYTES) {
      toast.error('Logo must be 10 MB or smaller.');
      return;
    }

    setUploading(true);
    try {
      const payload = await db.integrations.Core.UploadFile({
        file,
        folder: 'attendance-watermark-logos',
      });
      const fileUrl = payload?.file_url;
      if (!fileUrl) {
        throw new Error('Upload did not return a file URL.');
      }
      onChange(fileUrl);
      clearWatermarkLogoCache();
      toast.success('Watermark logo uploaded.');
    } catch (error) {
      toast.error(error?.data?.message || error?.message || 'Failed to upload logo.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-3">
      <Label>Watermark logo</Label>

      {value ? (
        <div className="overflow-hidden rounded-xl border bg-muted/20">
          <div className="flex h-28 items-center justify-center bg-slate-900/80 p-4">
            <img src={previewUrl} alt="Watermark logo preview" className="max-h-full max-w-full object-contain" />
          </div>
          <div className="flex flex-col gap-2 border-t px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="min-w-0 break-all text-xs text-muted-foreground">{value}</p>
            <div className="flex shrink-0 items-center gap-2 self-stretch sm:self-auto">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={uploading}
                onClick={() => inputRef.current?.click()}
              >
                Replace
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                disabled={uploading}
                onClick={() => {
                  clearWatermarkLogoCache(value);
                  onClear?.();
                  toast.success('Watermark logo removed.');
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-8 text-center transition-colors hover:border-primary/50 hover:bg-muted/20 disabled:opacity-60"
        >
          {uploading ? (
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          ) : (
            <Upload className="h-8 w-8 text-muted-foreground" />
          )}
          <div>
            <p className="text-sm font-medium">{uploading ? 'Uploading…' : 'Upload logo'}</p>
            <p className="mt-1 text-xs text-muted-foreground">PNG, JPG, WebP, GIF, or SVG up to 10 MB</p>
          </div>
        </button>
      )}

      <input ref={inputRef} type="file" accept={ACCEPT} className="hidden" onChange={handleSelect} />
    </div>
  );
}
