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
import { getCroppedImageBlob, toAbsoluteUrl } from '@/lib/media';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function ProfilePictureUploader({
  profilePicture,
  displayName,
  onUpdated,
  className,
}) {
  const fileInputRef = useRef(null);
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [imageSrc, setImageSrc] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);

  const initial = displayName?.[0]?.toUpperCase() || 'U';
  const avatarUrl = toAbsoluteUrl(profilePicture);

  const onCropComplete = useCallback((_croppedArea, pixels) => {
    setCroppedAreaPixels(pixels);
  }, []);

  const resetCropState = () => {
    setImageSrc(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
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
    if (!imageSrc || !croppedAreaPixels) return;

    setUploading(true);
    try {
      const blob = await getCroppedImageBlob(imageSrc, croppedAreaPixels);
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
                onCropComplete={onCropComplete}
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
            <Button type="button" onClick={handleCropSave} disabled={uploading || !croppedAreaPixels}>
              {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Save Photo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
