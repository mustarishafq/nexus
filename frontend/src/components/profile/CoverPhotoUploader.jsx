// @ts-nocheck
import db from '@/api/base44Client';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import Cropper from 'react-easy-crop';
import { Camera, ImageIcon, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import {
  COVER_PHOTO_ASPECT,
  COVER_PHOTO_MOBILE_ASPECT,
  COVER_PHOTO_MAX_WIDTH,
  COVER_PHOTO_MOBILE_VISIBLE_WIDTH_RATIO,
  getCoverDisplayPreviewDataUrl,
  getCroppedImageBlob,
  toAbsoluteUrl,
} from '@/lib/media';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const DEFAULT_COVER = '/icons/banner.png';

function CoverCropPreview({ label, aspectClass, previewUrl }) {
  return (
    <div className="space-y-1.5 min-w-0">
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <div className={cn('relative w-full overflow-hidden rounded-md border border-border bg-muted', aspectClass)}>
        {previewUrl ? (
          <img src={previewUrl} alt="" className="h-full w-full object-cover object-center" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-[10px] text-muted-foreground">
            Adjust crop
          </div>
        )}
      </div>
    </div>
  );
}

export default function CoverPhotoUploader({
  coverPicture,
  onUpdated,
  variant = 'profile',
  className,
  readOnly = false,
}) {
  const fileInputRef = useRef(null);
  const cropContainerRef = useRef(null);
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [imageSrc, setImageSrc] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [croppedAreaPercent, setCroppedAreaPercent] = useState(null);
  const [cropAreaRect, setCropAreaRect] = useState(null);
  const [desktopPreviewUrl, setDesktopPreviewUrl] = useState(null);
  const [mobilePreviewUrl, setMobilePreviewUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);

  const coverUrl = toAbsoluteUrl(coverPicture) || DEFAULT_COVER;

  const updateCropAreaRect = useCallback(() => {
    const container = cropContainerRef.current;
    const cropArea = container?.querySelector('.reactEasyCrop_CropArea');
    if (!container || !cropArea) {
      setCropAreaRect(null);
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const areaRect = cropArea.getBoundingClientRect();
    setCropAreaRect({
      top: areaRect.top - containerRect.top,
      left: areaRect.left - containerRect.left,
      width: areaRect.width,
      height: areaRect.height,
    });
  }, []);

  const onCropAreaChange = useCallback(
    (croppedArea, pixels) => {
      setCroppedAreaPercent(croppedArea);
      setCroppedAreaPixels(pixels);
      requestAnimationFrame(updateCropAreaRect);
    },
    [updateCropAreaRect]
  );

  useEffect(() => {
    if (!cropDialogOpen || !imageSrc || !croppedAreaPixels) {
      setDesktopPreviewUrl(null);
      setMobilePreviewUrl(null);
      return;
    }

    let cancelled = false;

    const updatePreviews = async () => {
      try {
        const [desktop, mobile] = await Promise.all([
          getCoverDisplayPreviewDataUrl(imageSrc, croppedAreaPixels, COVER_PHOTO_ASPECT),
          getCoverDisplayPreviewDataUrl(imageSrc, croppedAreaPixels, COVER_PHOTO_MOBILE_ASPECT),
        ]);

        if (!cancelled) {
          setDesktopPreviewUrl(desktop);
          setMobilePreviewUrl(mobile);
        }
      } catch {
        if (!cancelled) {
          setDesktopPreviewUrl(null);
          setMobilePreviewUrl(null);
        }
      }
    };

    updatePreviews();

    return () => {
      cancelled = true;
    };
  }, [cropDialogOpen, imageSrc, croppedAreaPixels]);

  useEffect(() => {
    if (!cropDialogOpen) return undefined;

    const container = cropContainerRef.current;
    if (!container) return undefined;

    const cropArea = container.querySelector('.reactEasyCrop_CropArea');
    const observer = new ResizeObserver(() => updateCropAreaRect());

    if (cropArea) {
      observer.observe(cropArea);
    }
    observer.observe(container);

    const frame = requestAnimationFrame(updateCropAreaRect);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [cropDialogOpen, imageSrc, crop, zoom, updateCropAreaRect]);

  const resetCropState = () => {
    setImageSrc(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setCroppedAreaPercent(null);
    setCropAreaRect(null);
    setDesktopPreviewUrl(null);
    setMobilePreviewUrl(null);
  };

  const handleFileSelect = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image must be smaller than 10 MB.');
      return;
    }

    const reader = new FileReader();
    reader.addEventListener('load', () => {
      setImageSrc(reader.result);
      setCropDialogOpen(true);
    });
    reader.readAsDataURL(file);
  };

  const handleCropCancel = () => {
    setCropDialogOpen(false);
    resetCropState();
  };

  const handleCropSave = async () => {
    if (!imageSrc || !croppedAreaPercent) return;

    setUploading(true);
    try {
      const blob = await getCroppedImageBlob(
        imageSrc,
        { percentages: croppedAreaPercent, pixels: croppedAreaPixels },
        { maxWidth: COVER_PHOTO_MAX_WIDTH }
      );
      const file = new File([blob], 'cover-photo-new.jpg', { type: 'image/jpeg' });
      const { file_url } = await db.integrations.Core.UploadFile({
        file,
        folder: 'cover-pictures-new',
      });
      await db.auth.updateMe({ cover_picture: file_url });
      await onUpdated?.();
      toast.success('Cover photo updated.');
      setCropDialogOpen(false);
      resetCropState();
    } catch (err) {
      toast.error(err?.message || 'Failed to upload cover photo.');
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    setRemoving(true);
    try {
      await db.auth.updateMe({ cover_picture: null });
      await onUpdated?.();
      toast.success('Cover photo removed.');
    } catch (err) {
      toast.error(err?.message || 'Failed to remove cover photo.');
    } finally {
      setRemoving(false);
    }
  };

  const cropDialog = (
    <Dialog open={cropDialogOpen} onOpenChange={(open) => !open && handleCropCancel()}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Crop cover photo</DialogTitle>
          <DialogDescription>
            Drag to reposition and zoom. The solid frame is desktop; the dashed frame shows what mobile will display.
          </DialogDescription>
        </DialogHeader>

        <div
          ref={cropContainerRef}
          className="relative h-56 sm:h-72 w-full overflow-hidden rounded-lg bg-muted"
        >
          {imageSrc ? (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={COVER_PHOTO_ASPECT}
              cropShape="rect"
              showGrid
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropAreaChange={onCropAreaChange}
            />
          ) : null}

          {cropAreaRect ? (
            <>
              <div
                className="pointer-events-none absolute z-20 rounded-sm border-2 border-dashed border-primary/90"
                style={{
                  top: cropAreaRect.top,
                  left:
                    cropAreaRect.left +
                    (cropAreaRect.width * (1 - COVER_PHOTO_MOBILE_VISIBLE_WIDTH_RATIO)) / 2,
                  width: cropAreaRect.width * COVER_PHOTO_MOBILE_VISIBLE_WIDTH_RATIO,
                  height: cropAreaRect.height,
                }}
              >
                <span className="absolute bottom-1 left-1/2 -translate-x-1/2 rounded bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground shadow-sm">
                  Mobile
                </span>
              </div>
              <span
                className="pointer-events-none absolute z-20 rounded bg-background/90 px-1.5 py-0.5 text-[10px] font-medium text-foreground shadow-sm"
                style={{ top: cropAreaRect.top + 6, left: cropAreaRect.left + 8 }}
              >
                Desktop
              </span>
            </>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <CoverCropPreview
            label="Desktop preview"
            aspectClass="aspect-[4/1]"
            previewUrl={desktopPreviewUrl}
          />
          <CoverCropPreview
            label="Mobile preview"
            aspectClass="aspect-[3/2]"
            previewUrl={mobilePreviewUrl}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="cover-photo-zoom">Zoom</Label>
          <Slider
            id="cover-photo-zoom"
            min={1}
            max={4}
            step={0.05}
            value={[zoom]}
            onValueChange={([value]) => setZoom(value)}
          />
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleCropCancel} disabled={uploading}>
            Cancel
          </Button>
          <Button type="button" onClick={handleCropSave} disabled={uploading || !croppedAreaPercent}>
            {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Save Cover
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  if (variant === 'overlay') {
    if (readOnly) {
      return null;
    }

    return (
      <>
        <div className={cn('absolute top-2 right-2 sm:top-3 sm:right-3 z-10 flex gap-1.5 sm:gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity', className)}>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-8 px-2 sm:px-3 gap-0 sm:gap-1.5 shadow-md bg-background/90 backdrop-blur-sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || removing}
            aria-label={coverPicture ? 'Change cover photo' : 'Add cover photo'}
          >
            <Camera className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{coverPicture ? 'Change cover' : 'Add cover'}</span>
          </Button>
          {coverPicture ? (
            <Button
              type="button"
              size="icon"
              variant="secondary"
              className="h-8 w-8 shadow-md bg-background/90 backdrop-blur-sm text-destructive hover:text-destructive"
              onClick={handleRemove}
              disabled={uploading || removing}
              aria-label="Remove cover photo"
            >
              {removing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            </Button>
          ) : null}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileSelect}
        />
        {cropDialog}
      </>
    );
  }

  return (
    <>
      <div className={cn('space-y-3', className)}>
        <div className="relative aspect-[4/1] w-full rounded-xl overflow-hidden border border-border bg-muted">
          <img src={coverUrl} alt="Cover preview" className="h-full w-full object-cover object-center" />
          <div className="absolute inset-0 bg-gradient-to-t from-background/50 via-transparent to-transparent" />
          <div className="absolute bottom-3 left-3 flex items-center gap-2 text-xs text-foreground/90">
            <ImageIcon className="w-3.5 h-3.5" />
            Dashboard cover photo
          </div>
        </div>
        <div>
          <p className="text-sm font-medium">Cover Photo</p>
          <p className="text-xs text-muted-foreground">
            Wide banner shown on your dashboard. JPG or PNG, up to 10 MB.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || removing}
          >
            <Camera className="w-4 h-4 mr-2" />
            {coverPicture ? 'Change Cover' : 'Upload Cover'}
          </Button>
          {coverPicture ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleRemove}
              disabled={uploading || removing}
              className="text-destructive hover:text-destructive"
            >
              {removing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              Remove
            </Button>
          ) : null}
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelect}
      />
      {cropDialog}
    </>
  );
}
