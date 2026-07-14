// @ts-nocheck
import db from '@/api/apiClient';
import React, { useCallback, useRef, useState } from 'react';
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  COVER_PHOTO_ASPECT,
  COVER_PHOTO_MOBILE_ASPECT,
  COVER_PHOTO_MAX_WIDTH,
  getCenteredCoverCrop,
  getCoverCropBackgroundStyle,
  getResizedImageBlob,
  normalizeMediaCropArea,
  toAbsoluteUrl,
} from '@/lib/media';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const DEFAULT_COVER = '/icons/banner.png';
const COVER_CROP_MIN_ZOOM = 0.2;
const COVER_CROP_MAX_ZOOM = 4;

function CoverCropPreview({ label, aspectClass, imageSrc, crop, className }) {
  const hasCrop = Boolean(crop?.width && crop?.height);

  return (
    <div className={cn('space-y-1.5 min-w-0', className)}>
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <div
        className={cn(
          'relative w-full overflow-hidden rounded-md border border-border bg-muted',
          aspectClass
        )}
        style={hasCrop ? getCoverCropBackgroundStyle(imageSrc, crop) : undefined}
      >
        {!hasCrop ? (
          <div className="absolute inset-0 flex items-center justify-center text-[10px] text-muted-foreground">
            Adjust crop
          </div>
        ) : null}
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
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [imageSrc, setImageSrc] = useState(null);
  const [activeTab, setActiveTab] = useState('desktop');
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [desktopArea, setDesktopArea] = useState(null);
  const [mobileArea, setMobileArea] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);

  const coverUrl = toAbsoluteUrl(coverPicture) || DEFAULT_COVER;
  const activeAspect = activeTab === 'mobile' ? COVER_PHOTO_MOBILE_ASPECT : COVER_PHOTO_ASPECT;
  const activeInitialArea = activeTab === 'mobile' ? mobileArea : desktopArea;
  const activeArea = activeTab === 'mobile' ? mobileArea : desktopArea;

  const resetCropState = () => {
    setImageSrc(null);
    setActiveTab('desktop');
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setDesktopArea(null);
    setMobileArea(null);
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
      const dataUrl = reader.result;
      const image = new Image();
      image.addEventListener('load', () => {
        setDesktopArea(getCenteredCoverCrop(image.naturalWidth, image.naturalHeight, COVER_PHOTO_ASPECT));
        setMobileArea(
          getCenteredCoverCrop(image.naturalWidth, image.naturalHeight, COVER_PHOTO_MOBILE_ASPECT)
        );
        setCrop({ x: 0, y: 0 });
        setZoom(1);
        setImageSrc(dataUrl);
        setActiveTab('desktop');
        setCropDialogOpen(true);
      });
      image.src = dataUrl;
    });
    reader.readAsDataURL(file);
  };

  const handleCropCancel = () => {
    setCropDialogOpen(false);
    resetCropState();
  };

  const handleAreaChange = useCallback(
    (croppedArea) => {
      if (activeTab === 'mobile') {
        setMobileArea(croppedArea);
      } else {
        setDesktopArea(croppedArea);
      }
    },
    [activeTab]
  );

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
  };

  const handleCropSave = async () => {
    if (!imageSrc || !desktopArea || !mobileArea) return;

    setUploading(true);
    try {
      const desktopCrop = normalizeMediaCropArea(desktopArea);
      const mobileCrop = normalizeMediaCropArea(mobileArea);
      if (!desktopCrop || !mobileCrop) {
        toast.error('Invalid crop area. Adjust the framing and try again.');
        return;
      }

      // Keep the full image for lightbox/full-size preview; crops only control banner fit.
      const blob = await getResizedImageBlob(imageSrc, { maxWidth: COVER_PHOTO_MAX_WIDTH });
      const file = new File([blob], 'cover-photo-new.jpg', { type: 'image/jpeg' });
      const { file_url } = await db.integrations.Core.UploadFile({
        file,
        folder: 'cover-pictures-new',
      });
      await db.auth.updateMe({
        cover_picture: file_url,
        cover_picture_crops: {
          desktop: desktopCrop,
          mobile: mobileCrop,
        },
      });
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
      await db.auth.updateMe({ cover_picture: null, cover_picture_crops: null });
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
      <DialogContent className="flex max-h-[min(92dvh,900px)] w-[calc(100vw-1.5rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <div className="shrink-0 space-y-1.5 border-b border-border px-4 py-4 pr-12 sm:px-6">
          <DialogHeader className="space-y-1.5 text-left">
            <DialogTitle>Crop cover photo</DialogTitle>
            <DialogDescription>
              Adjust desktop and mobile framing separately. The full image is kept for preview; crop only
              controls how it fits on the banner.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3 sm:px-6">
          <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="desktop">Desktop</TabsTrigger>
              <TabsTrigger value="mobile">Mobile</TabsTrigger>
            </TabsList>
          </Tabs>

          <div
            className={cn(
              'relative w-full overflow-hidden rounded-lg bg-muted',
              activeTab === 'mobile' ? 'h-44 sm:h-56' : 'h-40 sm:h-52'
            )}
          >
            {imageSrc ? (
              <Cropper
                key={activeTab}
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                minZoom={COVER_CROP_MIN_ZOOM}
                maxZoom={COVER_CROP_MAX_ZOOM}
                restrictPosition={false}
                aspect={activeAspect}
                cropShape="rect"
                showGrid
                objectFit="contain"
                initialCroppedAreaPercentages={activeInitialArea || undefined}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropAreaChange={handleAreaChange}
              />
            ) : null}
          </div>

          {activeTab === 'mobile' ? (
            <CoverCropPreview
              label="Mobile fit preview"
              aspectClass="aspect-[3/2]"
              imageSrc={imageSrc}
              crop={activeArea}
              className="mx-auto w-full max-w-[180px] sm:max-w-[220px]"
            />
          ) : (
            <CoverCropPreview
              label="Desktop fit preview"
              aspectClass="aspect-[4/1]"
              imageSrc={imageSrc}
              crop={activeArea}
              className="w-full"
            />
          )}

          <div className="space-y-2 pb-1">
            <Label htmlFor="cover-photo-zoom">Zoom</Label>
            <Slider
              id="cover-photo-zoom"
              min={COVER_CROP_MIN_ZOOM}
              max={COVER_CROP_MAX_ZOOM}
              step={0.05}
              value={[zoom]}
              onValueChange={([value]) => setZoom(value)}
            />
            <p className="text-[11px] text-muted-foreground">
              Zoom out to fit more of the image in the frame.
            </p>
          </div>
        </div>

        <DialogFooter className="shrink-0 gap-2 border-t border-border px-4 py-3 sm:px-6">
          <Button type="button" variant="outline" onClick={handleCropCancel} disabled={uploading}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleCropSave}
            disabled={uploading || !desktopArea || !mobileArea}
          >
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
