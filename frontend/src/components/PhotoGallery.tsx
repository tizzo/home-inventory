import { usePhotos, useDeletePhoto } from '../hooks';
import { Button } from '@/components/ui/button';

interface PhotoGalleryProps {
  entityType: string;
  entityId: string;
}

export default function PhotoGallery({
  entityType,
  entityId,
}: PhotoGalleryProps) {
  const { data: photos, isLoading, error } = usePhotos(entityType, entityId);
  const deletePhoto = useDeletePhoto();

  const handleDelete = async (photoId: string) => {
    if (window.confirm('Are you sure you want to delete this photo?')) {
      try {
        await deletePhoto.mutateAsync({
          id: photoId,
          entityType,
          entityId,
        });
      } catch (err) {
        console.error('Failed to delete photo:', err);
        alert('Failed to delete photo. Please try again.');
      }
    }
  };

  if (isLoading) {
    return <div className="p-4 text-center text-muted-foreground">Loading photos...</div>;
  }

  if (error) {
    return <div className="p-4 text-center text-destructive">Error loading photos: {error.message}</div>;
  }

  if (!photos || photos.length === 0) {
    return null; // Don't show anything if no photos
  }

  return (
    <div className="mt-6 pt-6 border-t border-border">
      <h3 className="text-sm font-medium text-muted-foreground mb-4">
        Photos ({photos.length})
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
        {photos.map((photo) => (
          <div key={photo.id} className="relative group aspect-square">
            <img
              src={photo.thumbnail_url || photo.url}
              alt={`Photo for ${entityType}`}
              loading="lazy"
              onClick={() => window.open(photo.url, '_blank')}
              className="w-full h-full object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
            />
            <Button
              variant="destructive"
              size="icon"
              onClick={() => handleDelete(photo.id)}
              disabled={deletePhoto.isPending}
              aria-label="Delete photo"
              className="absolute top-1 right-1 h-7 w-7 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
            >
              <span className="text-sm">&times;</span>
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
