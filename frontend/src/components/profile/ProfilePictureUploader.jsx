// @ts-nocheck
import db from '@/api/base44Client';
import React, { useCallback, useRef, useState } from 'react';
import Cropper from 'react-easy-crop';
import { Camera, Loader2, Trash2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
import { getCroppedImageBlob, PROFILE_PHOTO_MAX_SIZE, toAbsoluteUrl } from '@/lib/media';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function ProfilePictureUploader({
  profilePicture,
  displayName,
  onUpdated,
  variant = 'profile',
  className,
  avatarClassName,
  readOnly = false,
}) {
  const fileInputRef = useRef(null);
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [imageSrc, setImageSrc] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [croppedAreaPercent, setCroppedAreaPercent] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);

  const initial = displayName?.[0]?.toUpperCase() || 'U';
  const avatarUrl = toAbsoluteUrl(profilePicture);

  const onCropAreaChange = useCallback((croppedArea, pixels) => {
    setCroppedAreaPercent(croppedArea);
    setCroppedAreaPixels(pixels);
  }, []);

  const resetCropState = () => {
    setImageSrc(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setCroppedAreaPercent(null);
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
        { maxWidth: PROFILE_PHOTO_MAX_SIZE, maxHeight: PROFILE_PHOTO_MAX_SIZE }
      );
      const file = new File([blob], 'profile-picture.jpg', { type: 'image/jpeg' });
      const { file_url } = await db.integrations.Core.UploadFile({
        file,
        folder: 'profile-pictures',
      });
      await db.auth.updateMe({ profile_picture: file_url });
      await onUpdated?.();
      toast.success('Profile picture updated.');
      setCropDialogOpen(false);
      resetCropState();
    } catch (err) {
      toast.error(err?.message || 'Failed to upload profile picture.');
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    setRemoving(true);
    try {
      await db.auth.updateMe({ profile_picture: null });
      await onUpdated?.();
      toast.success('Profile picture removed.');
    } catch (err) {
      toast.error(err?.message || 'Failed to remove profile picture.');
    } finally {
      setRemoving(false);
    }
  };

  const cropDialog = (
    <Dialog open={cropDialogOpen} onOpenChange={(open) => !open && handleCropCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Crop profile picture</DialogTitle>
          <DialogDescription>
            Drag to reposition and use the slider to zoom. Your photo will be saved as a square.
          </DialogDescription>
        </DialogHeader>

        <div className="relative h-64 w-full overflow-hidden rounded-lg bg-muted">
          {imageSrc ? (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropAreaChange={onCropAreaChange}
            />
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="profile-picture-zoom">Zoom</Label>
          <Slider
            id="profile-picture-zoom"
            min={1}
            max={3}
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
            Save Photo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  if (variant === 'overlay') {
    return (
      <>
        <div className={cn('relative w-fit shrink-0 group', className)}>
          <Avatar
            className={cn(
              'h-32 w-32 sm:h-36 sm:w-36 lg:h-40 lg:w-40 border-[5px] border-background shadow-xl ring-1 ring-border',
              avatarClassName
            )}
          >
            <AvatarImage src={avatarUrl} alt={displayName || 'Profile picture'} />
            <AvatarFallback className="text-2xl sm:text-3xl lg:text-4xl font-semibold bg-primary/10 text-primary">
              {initial}
            </AvatarFallback>
          </Avatar>

          {!readOnly ? (
            <>
              <button
                type="button"
                className="absolute inset-0 hidden sm:flex items-center justify-center rounded-full bg-background/60 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || removing}
                aria-label={profilePicture ? 'Change profile photo' : 'Add profile photo'}
              >
                {uploading ? (
                  <Loader2 className="w-6 h-6 animate-spin text-foreground" />
                ) : (
                  <Camera className="w-6 h-6 text-foreground" />
                )}
              </button>

              <button
                type="button"
                className="absolute bottom-0 left-0 sm:hidden flex items-center justify-center h-8 w-8 rounded-full border border-border/70 bg-background shadow-md text-muted-foreground"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || removing}
                aria-label={profilePicture ? 'Change profile photo' : 'Add profile photo'}
              >
                {uploading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Camera className="w-3.5 h-3.5" />
                )}
              </button>

              {profilePicture ? (
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  className="absolute bottom-0 right-0 h-8 w-8 sm:h-9 sm:w-9 rounded-full shadow-md opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                  onClick={handleRemove}
                  disabled={uploading || removing}
                  aria-label="Remove profile photo"
                >
                  {removing ? <Loader2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 animate-spin" /> : <Trash2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />}
                </Button>
              ) : null}
            </>
          ) : null}
        </div>

        {!readOnly ? (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileSelect}
            />
            {cropDialog}
          </>
        ) : null}
      </>
    );
  }

  return (
    <>
      <div className={cn('flex items-center gap-4', className)}>
        <Avatar className="h-20 w-20 border border-border shadow-sm">
          <AvatarImage src={avatarUrl} alt={displayName || 'Profile picture'} />
          <AvatarFallback className="text-xl font-semibold bg-primary/10 text-primary">
            {initial}
          </AvatarFallback>
        </Avatar>

        <div className="space-y-2">
          <div>
            <p className="text-sm font-medium">Profile Picture</p>
            <p className="text-xs text-muted-foreground">
              Upload a photo and crop it to a square. JPG or PNG, up to 10 MB.
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
              {profilePicture ? 'Change Photo' : 'Upload Photo'}
            </Button>
            {profilePicture ? (
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
      </div>

      {cropDialog}
    </>
  );
}
