import { usePhotos, useDeletePhoto } from '../hooks';

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
    return <div className="photo-gallery-loading">Loading photos...</div>;
  }

  if (error) {
    return <div className="photo-gallery-error">Error loading photos: {error.message}</div>;
  }

  if (!photos || photos.length === 0) {
    return null; // Don't show anything if no photos
  }

  return (
    <div className="photo-gallery">
      <h3>Photos</h3>
      <div className="photo-grid">
        {photos.map((photo) => (
          <div key={photo.id} className="photo-item">
            <img
              src={photo.thumbnail_url || photo.url}
              alt={`Photo for ${entityType}`}
              loading="lazy"
              onClick={() => window.open(photo.url, '_blank')}
            />
            <button
              className="photo-delete"
              onClick={() => handleDelete(photo.id)}
              disabled={deletePhoto.isPending}
              aria-label="Delete photo"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
