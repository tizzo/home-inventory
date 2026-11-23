import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { floorPlansApi } from '../api';
import { useCreateFloorPlan } from '../hooks';
import { prepareFloorPlanImage } from '../lib/floorPlan';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

function uploadErrorMessage(err: unknown): string {
  const status = (err as { response?: { status?: number } }).response?.status;
  if (status === 413) return 'This image is too large. Try a smaller file.';
  if (status === 400) return 'This image was not accepted. Use a PNG, JPEG or WebP file.';
  if (err instanceof Error && !('response' in err)) return err.message;
  return 'Upload failed. Please try again.';
}

export default function FloorPlanUploadPage() {
  const navigate = useNavigate();
  const createFloorPlan = useCreateFloorPlan();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Release the preview when the file changes or the page is left
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] ?? null;
    setFile(selected);
    setError(null);
    setPreviewUrl(selected ? URL.createObjectURL(selected) : null);
    if (selected && !name.trim()) {
      setName(selected.name.replace(/\.[^/.]+$/, ''));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !name.trim()) return;

    setIsUploading(true);
    setError(null);

    try {
      const image = await prepareFloorPlanImage(file);
      const { upload_url, s3_key } = await floorPlansApi.getUploadUrl(image.contentType);

      const upload = await fetch(upload_url, {
        method: 'PUT',
        headers: { 'Content-Type': image.contentType },
        body: image.blob,
      });
      if (!upload.ok) {
        throw new Error(`Upload failed with status ${upload.status}.`);
      }

      const floorPlan = await createFloorPlan.mutateAsync({
        name: name.trim(),
        description: description.trim() || undefined,
        s3_key,
        content_type: image.contentType,
        width: image.width,
        height: image.height,
      });

      // Straight to placement, where rooms are linked and units positioned
      navigate(`/floor-plans/${floorPlan.id}/edit`);
    } catch (err) {
      console.error('Failed to upload floor plan:', err);
      setError(uploadErrorMessage(err));
      setIsUploading(false);
    }
  };

  return (
    <div className="max-w-xl">
      <div className="text-sm text-muted-foreground mb-2">
        <Link to="/floor-plans" className="hover:underline">
          Floor Plans
        </Link>{' '}
        / New
      </div>
      <h1 className="text-2xl font-bold mb-6">Add Floor Plan</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="floor-plan-file">Floor plan image *</Label>
          <Input
            id="floor-plan-file"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleFileChange}
            disabled={isUploading}
            required
              className="text-foreground"
            />
          <p className="text-xs text-muted-foreground">
            PNG, JPEG or WebP. Very large images are resized automatically.
          </p>
        </div>

        {previewUrl && (
          <img
            src={previewUrl}
            alt="Preview of the selected floor plan"
            className="w-full max-h-80 object-contain rounded-lg border border-border bg-muted"
          />
        )}

        <div className="space-y-2">
          <Label htmlFor="floor-plan-name">Name *</Label>
          <Input
            id="floor-plan-name"
            className="text-foreground"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Ground Floor, Basement"
            maxLength={255}
            disabled={isUploading}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="floor-plan-description">Description</Label>
          <Textarea
            id="floor-plan-description"
            className="text-foreground"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional description"
            rows={3}
            disabled={isUploading}
          />
        </div>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="flex gap-3 pt-4 border-t border-border">
          <Button type="submit" disabled={isUploading || !file || !name.trim()} className="flex-1">
            {isUploading ? 'Uploading...' : 'Upload Floor Plan'}
          </Button>
          <Button type="button" variant="outline" className="flex-1 text-foreground" asChild>
            <Link to="/floor-plans">Cancel</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
