import React, { useRef, useState } from 'react';
import { Loader2, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';

import db from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import SplashBackground from '@/components/pwa/splash-animations/SplashBackground';
import { detectSplashMediaType } from '@/lib/splashConfig';
import { toAbsoluteUrl } from '@/lib/media';

const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,image/svg+xml,video/mp4,video/webm,video/quicktime';
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

function isVideoFile(file) {
  return file.type.startsWith('video/');
}

export default function SplashMediaUploader({ value, onChange, onClear, splashConfig }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const mediaType = value ? detectSplashMediaType(value) : null;
  const previewUrl = value ? toAbsoluteUrl(value) : '';

  const handleSelect = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const video = isVideoFile(file);
    const maxBytes = video ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;

    if (!video && !file.type.startsWith('image/')) {
      toast.error('Please choose an image or video file.');
      return;
    }

    if (file.size > maxBytes) {
      toast.error(video ? 'Video must be 50 MB or smaller.' : 'Image must be 10 MB or smaller.');
      return;
    }

    setUploading(true);
    try {
      const payload = await db.integrations.Core.UploadFile({ file, folder: 'splash-media' });
      const fileUrl = payload?.file_url;
      if (!fileUrl) {
        throw new Error('Upload did not return a file URL.');
      }
      onChange(fileUrl);
      toast.success(video ? 'Splash video uploaded.' : 'Splash logo uploaded.');
    } catch (error) {
      toast.error(error?.data?.message || error?.message || 'Failed to upload splash media.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-3">
      <Label>Splash media file</Label>

      {value ? (
        <div className="overflow-hidden rounded-xl border bg-muted/20">
          <div className="relative flex h-36 items-center justify-center overflow-hidden p-4">
            {splashConfig ? <SplashBackground config={splashConfig} /> : (
              <div className="absolute inset-0 bg-muted" aria-hidden="true" />
            )}
            {mediaType === 'video' ? (
              <video
                src={previewUrl}
                muted
                loop
                autoPlay
                playsInline
                className="relative z-10 max-h-full max-w-full rounded-lg object-contain"
              />
            ) : (
              <img
                src={previewUrl}
                alt=""
                className="relative z-10 max-h-full max-w-full rounded-lg object-contain"
              />
            )}
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
                  onClear?.();
                  toast.success('Custom splash media cleared.');
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
            <p className="text-sm font-medium">
              {uploading ? 'Uploading…' : 'Upload logo or video'}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Images up to 10 MB · MP4, WebM, MOV up to 50 MB
            </p>
          </div>
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={handleSelect}
      />
    </div>
  );
}
