// @ts-nocheck
import db from '@/api/apiClient';
import React, { useCallback, useRef, useState } from 'react';
import Cropper from 'react-easy-crop';
import { ImagePlus, Loader2, Trash2 } from 'lucide-react';
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
  extractPublicStoragePath,
  exportQuizQuestionImage,
  getCenteredCoverCrop,
  normalizeMediaCropArea,
  QUIZ_QUESTION_IMAGE_SOURCE_MAX_BYTES,
  toPublicFileUrl,
} from '@/lib/media';
import { toast } from 'sonner';

const CROP_MIN_ZOOM = 0.2;
const CROP_MAX_ZOOM = 3;

async function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(reader.result));
    reader.addEventListener('error', () => reject(new Error('Could not read image.')));
    reader.readAsDataURL(file);
  });
}

async function fetchBlobAsDataUrl(url, { credentials = 'omit', headers } = {}) {
  const response = await fetch(url, { credentials, headers, mode: 'cors' });
  if (!response.ok) {
    throw new Error('Could not load image for recrop.');
  }
  const blob = await response.blob();
  if (!blob || blob.size === 0) {
    throw new Error('Could not load image for recrop.');
  }
  const type = String(blob.type || '');
  if (type && !type.startsWith('image/') && type !== 'application/octet-stream') {
    throw new Error('Could not load image for recrop.');
  }
  return readFileAsDataUrl(blob);
}

async function loadPublicImageAsDataUrl(url) {
  const storagePath = extractPublicStoragePath(url) || url;

  try {
    const blob = await db.integrations.Core.DownloadFile({ file_url: storagePath });
    return await readFileAsDataUrl(blob);
  } catch {
    // Fall through to same-origin / public disk.
  }

  if (typeof storagePath === 'string' && storagePath.startsWith('/storage/')) {
    try {
      return await fetchBlobAsDataUrl(storagePath);
    } catch {
      // Fall through to the absolute public URL.
    }
  }

  const publicUrl = toPublicFileUrl(url);
  if (publicUrl && publicUrl !== storagePath) {
    return fetchBlobAsDataUrl(publicUrl);
  }

  throw new Error('Could not load image for recrop.');
}

async function deleteQuizQuestionFile(fileUrl) {
  const stored = extractPublicStoragePath(fileUrl) || fileUrl;
  if (!stored || !String(stored).includes('quiz-question-images')) return;
  try {
    await db.integrations.Core.DeleteFile({ file_url: stored });
  } catch {
    // Already gone or not a quiz question file.
  }
}

export default function QuizQuestionImageField({ value, onChange, disabled = false }) {
  const fileInputRef = useRef(null);
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [imageSrc, setImageSrc] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPercent, setCroppedAreaPercent] = useState(null);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [uploading, setUploading] = useState(false);
  const localRecropSrcRef = useRef(null);
  const previewUrl = toPublicFileUrl(value);

  const onCropAreaChange = useCallback((croppedArea, croppedAreaPx) => {
    setCroppedAreaPercent(croppedArea);
    setCroppedAreaPixels(croppedAreaPx || null);
  }, []);

  const resetCropState = () => {
    setImageSrc(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPercent(null);
    setCroppedAreaPixels(null);
  };

  const openCropperWithSrc = (dataUrl) => {
    const image = new Image();
    image.addEventListener('load', () => {
      setCroppedAreaPercent(getCenteredCoverCrop(image.naturalWidth, image.naturalHeight, 1));
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setImageSrc(dataUrl);
      setCropDialogOpen(true);
    });
    image.addEventListener('error', () => {
      toast.error('Could not open that image.');
    });
    image.src = dataUrl;
  };

  const handleFileSelect = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/') || file.type === 'image/gif') {
      toast.error('Please select a JPG, PNG, or WebP image.');
      return;
    }

    if (file.size > QUIZ_QUESTION_IMAGE_SOURCE_MAX_BYTES) {
      toast.error('Image must be smaller than 10 MB.');
      return;
    }

    try {
      openCropperWithSrc(await readFileAsDataUrl(file));
    } catch (err) {
      toast.error(err?.message || 'Could not read image.');
    }
  };

  const handleRecrop = async () => {
    if (!value && !localRecropSrcRef.current) return;
    try {
      if (localRecropSrcRef.current) {
        openCropperWithSrc(localRecropSrcRef.current);
        return;
      }
      openCropperWithSrc(await loadPublicImageAsDataUrl(value));
    } catch (err) {
      const message = err?.message === 'Load failed' || err?.message === 'Failed to fetch'
        ? 'Could not load image for recrop.'
        : (err?.message || 'Could not load image for recrop.');
      toast.error(message);
    }
  };

  const handleCropCancel = () => {
    setCropDialogOpen(false);
    resetCropState();
  };

  const handleCropSave = async () => {
    if (!imageSrc || !croppedAreaPercent) return;

    const percentages = normalizeMediaCropArea(croppedAreaPercent);
    if (!percentages) {
      toast.error('Invalid crop area. Adjust the framing and try again.');
      return;
    }

    setUploading(true);
    const previous = value;
    try {
      const file = await exportQuizQuestionImage(imageSrc, {
        percentages,
        pixels: croppedAreaPixels,
      });
      const { file_url } = await db.integrations.Core.UploadFile({
        file,
        folder: 'quiz-question-images',
      });
      const storedUrl = extractPublicStoragePath(file_url) || file_url || null;
      localRecropSrcRef.current = imageSrc;
      onChange(storedUrl);
      if (previous && previous !== storedUrl) {
        await deleteQuizQuestionFile(previous);
      }
      toast.success('Question image saved.');
      setCropDialogOpen(false);
      resetCropState();
    } catch (err) {
      toast.error(err?.message || 'Failed to upload question image.');
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    const previous = value;
    localRecropSrcRef.current = null;
    onChange(null);
    if (previous) {
      await deleteQuizQuestionFile(previous);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <Label className="text-xs">Optional image</Label>
      {previewUrl ? (
        <img
          src={previewUrl}
          alt=""
          className="h-40 w-40 rounded-2xl object-cover aspect-square"
        />
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-fit"
          disabled={disabled || uploading}
          onClick={() => fileInputRef.current?.click()}
        >
          {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ImagePlus className="h-4 w-4 mr-2" />}
          {value ? 'Replace image' : 'Add image'}
        </Button>
        {value ? (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled || uploading}
              onClick={handleRecrop}
            >
              Recrop
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive"
              disabled={disabled || uploading}
              onClick={handleRemove}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Remove
            </Button>
          </>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">
        Square crop, saved at 1080×1080. JPG, PNG, or WebP up to 10 MB before crop.
      </p>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFileSelect}
      />

      <Dialog open={cropDialogOpen} onOpenChange={(open) => !open && handleCropCancel()}>
        <DialogContent className="md:max-w-md">
          <DialogHeader>
            <DialogTitle>Crop question image</DialogTitle>
            <DialogDescription>
              Drag to reposition and zoom. Play screens show this square crop with no frame around it.
            </DialogDescription>
          </DialogHeader>

          <div className="relative h-64 w-full overflow-hidden rounded-lg bg-muted">
            {imageSrc ? (
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                minZoom={CROP_MIN_ZOOM}
                maxZoom={CROP_MAX_ZOOM}
                restrictPosition={false}
                aspect={1}
                cropShape="rect"
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
            <Label htmlFor="quiz-question-image-zoom">Zoom</Label>
            <Slider
              id="quiz-question-image-zoom"
              min={CROP_MIN_ZOOM}
              max={CROP_MAX_ZOOM}
              step={0.05}
              value={[zoom]}
              onValueChange={([next]) => setZoom(next)}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleCropCancel} disabled={uploading}>
              Cancel
            </Button>
            <Button type="button" onClick={handleCropSave} disabled={uploading || !croppedAreaPercent}>
              {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Save image
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
