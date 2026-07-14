// @ts-nocheck
import db from '@/api/apiClient';
import React, { useCallback, useRef, useState } from 'react';
import Cropper from 'react-easy-crop';
import { Camera, Loader2, Trash2 } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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
  getCenteredCoverCrop,
  getCoverCropBackgroundStyle,
  getResizedImageBlob,
  normalizeMediaCropArea,
  PROFILE_PHOTO_MAX_SIZE,
  toAbsoluteUrl,
} from '@/lib/media';
import RoleAvatarRing from '@/components/users/RoleAvatarRing';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const PROFILE_CROP_MIN_ZOOM = 0.2;
const PROFILE_CROP_MAX_ZOOM = 3;

function ProfileAvatarMedia({ url, crop, alt, className }) {
  if (!url) return null;

  return (
    <span
      role="img"
      aria-label={alt}
      className={cn('absolute inset-0 rounded-full', className)}
      style={getCoverCropBackgroundStyle(url, crop)}
    />
  );
}

export default function ProfilePictureUploader({
  profilePicture,
  profilePictureCrop = null,
  displayName,
  onUpdated,
  variant = 'profile',
  className,
  avatarClassName,
  readOnly = false,
  role,
  immersiveRing = false,
  onView,
}) {
  const fileInputRef = useRef(null);
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [imageSrc, setImageSrc] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPercent, setCroppedAreaPercent] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);

  const initial = displayName?.[0]?.toUpperCase() || 'U';
  const avatarUrl = toAbsoluteUrl(profilePicture);

  const onCropAreaChange = useCallback((croppedArea) => {
    setCroppedAreaPercent(croppedArea);
  }, []);

  const resetCropState = () => {
    setImageSrc(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
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
      const dataUrl = reader.result;
      const image = new Image();
      image.addEventListener('load', () => {
        setCroppedAreaPercent(getCenteredCoverCrop(image.naturalWidth, image.naturalHeight, 1));
        setCrop({ x: 0, y: 0 });
        setZoom(1);
        setImageSrc(dataUrl);
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

  const handleCropSave = async () => {
    if (!imageSrc || !croppedAreaPercent) return;

    setUploading(true);
    try {
      const cropArea = normalizeMediaCropArea(croppedAreaPercent);
      if (!cropArea) {
        toast.error('Invalid crop area. Adjust the framing and try again.');
        return;
      }

      // Keep the full image for lightbox; crop only controls the circular avatar fit.
      const blob = await getResizedImageBlob(imageSrc, {
        maxWidth: PROFILE_PHOTO_MAX_SIZE,
        maxHeight: PROFILE_PHOTO_MAX_SIZE,
      });
      const file = new File([blob], 'profile-picture.jpg', { type: 'image/jpeg' });
      const { file_url } = await db.integrations.Core.UploadFile({
        file,
        folder: 'profile-pictures',
      });
      await db.auth.updateMe({
        profile_picture: file_url,
        profile_picture_crop: cropArea,
      });
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
      await db.auth.updateMe({ profile_picture: null, profile_picture_crop: null });
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
            Drag to reposition and zoom. Crop controls the avatar fit; the full image is kept for preview.
          </DialogDescription>
        </DialogHeader>

        <div className="relative h-64 w-full overflow-hidden rounded-lg bg-muted">
          {imageSrc ? (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              minZoom={PROFILE_CROP_MIN_ZOOM}
              maxZoom={PROFILE_CROP_MAX_ZOOM}
              restrictPosition={false}
              aspect={1}
              cropShape="round"
              showGrid={false}
              objectFit="contain"
              initialCroppedAreaPercentages={croppedAreaPercent || undefined}
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
            min={PROFILE_CROP_MIN_ZOOM}
            max={PROFILE_CROP_MAX_ZOOM}
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
    const avatar = (
      <Avatar
        className={cn(
          'relative h-32 w-32 sm:h-36 sm:w-36 lg:h-40 lg:w-40 shadow-lg overflow-hidden',
          role ? 'border-0' : 'border-[3px] border-background',
          onView && 'cursor-zoom-in',
          avatarClassName
        )}
      >
        <ProfileAvatarMedia
          url={avatarUrl}
          crop={profilePictureCrop}
          alt={displayName || 'Profile picture'}
        />
        {!avatarUrl ? (
          <AvatarFallback className="text-2xl sm:text-3xl lg:text-4xl font-semibold bg-primary/10 text-primary">
            {initial}
          </AvatarFallback>
        ) : null}
      </Avatar>
    );

    const avatarNode = onView ? (
      <button
        type="button"
        onClick={onView}
        className="rounded-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        aria-label="View profile picture"
      >
        {role ? (
          <RoleAvatarRing role={role} immersive={immersiveRing}>
            {avatar}
          </RoleAvatarRing>
        ) : (
          avatar
        )}
      </button>
    ) : role ? (
      <RoleAvatarRing role={role} immersive={immersiveRing}>
        {avatar}
      </RoleAvatarRing>
    ) : (
      avatar
    );

    return (
      <>
        <div className={cn('relative w-fit shrink-0 group', className)}>
          {avatarNode}

          {!readOnly ? (
            <>
              <button
                type="button"
                className={cn(
                  'absolute bottom-0 left-0 flex items-center justify-center rounded-full border border-border/70 bg-background shadow-md text-muted-foreground',
                  'h-8 w-8 sm:h-9 sm:w-9',
                  'opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity'
                )}
                onClick={(event) => {
                  event.stopPropagation();
                  fileInputRef.current?.click();
                }}
                disabled={uploading || removing}
                aria-label={profilePicture ? 'Change profile photo' : 'Add profile photo'}
              >
                {uploading ? (
                  <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" />
                ) : (
                  <Camera className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                )}
              </button>

              {profilePicture ? (
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  className="absolute bottom-0 right-0 h-8 w-8 sm:h-9 sm:w-9 rounded-full shadow-md opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleRemove();
                  }}
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
        <Avatar className="relative h-20 w-20 overflow-hidden border border-border shadow-sm">
          <ProfileAvatarMedia
            url={avatarUrl}
            crop={profilePictureCrop}
            alt={displayName || 'Profile picture'}
          />
          {!avatarUrl ? (
            <AvatarFallback className="text-xl font-semibold bg-primary/10 text-primary">
              {initial}
            </AvatarFallback>
          ) : null}
        </Avatar>

        <div className="space-y-2">
          <div>
            <p className="text-sm font-medium">Profile Picture</p>
            <p className="text-xs text-muted-foreground">
              Upload a photo and adjust the circular fit. JPG or PNG, up to 10 MB.
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
