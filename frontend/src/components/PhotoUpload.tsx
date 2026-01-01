import { useState, useRef } from 'react';
import { photosApi } from '../api';
import { useCreatePhoto } from '../hooks';
import type { CreatePhotoRequest } from '../types/generated';

interface PhotoUploadProps {
  entityType: string;
  entityId: string;
  onUploadComplete?: () => void;
  onError?: (error: Error) => void;
}

export default function PhotoUpload({
  entityType,
  entityId,
  onUploadComplete,
  onError,
}: PhotoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const createPhoto = useCreatePhoto();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert('File size must be less than 10MB');
      return;
    }

    await uploadFile(file);
  };

  const uploadFile = async (file: File) => {
    setUploading(true);
    setProgress(0);

    try {
      // Step 1: Get presigned upload URL
      const { upload_url, s3_key } = await photosApi.getUploadUrl(
        entityType,
        entityId,
        file.type
      );

      // Step 2: Upload file directly to S3
      const xhr = new XMLHttpRequest();

      await new Promise<void>((resolve, reject) => {
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const percentComplete = (e.loaded / e.total) * 100;
            setProgress(percentComplete);
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status === 200 || xhr.status === 204) {
            resolve();
          } else {
            const errorText = xhr.responseText || `Status ${xhr.status}`;
            console.error('Upload failed:', errorText);
            reject(new Error(`Upload failed: ${errorText}`));
          }
        });

        xhr.addEventListener('error', () => {
          reject(new Error('Network error during upload'));
        });

        xhr.addEventListener('abort', () => {
          reject(new Error('Upload was aborted'));
        });

        xhr.open('PUT', upload_url);
        xhr.setRequestHeader('Content-Type', file.type);
        xhr.send(file);
      });

      // Step 3: Get image dimensions (optional)
      const dimensions = await getImageDimensions(file);

      // Step 4: Create photo record in database
      const photoData: CreatePhotoRequest = {
        entity_type: entityType,
        entity_id: entityId,
        s3_key,
        thumbnail_s3_key: undefined, // TODO: Generate thumbnail
        content_type: file.type,
        file_size: file.size,
        width: dimensions.width,
        height: dimensions.height,
      };

      await createPhoto.mutateAsync(photoData);

      setProgress(100);
      onUploadComplete?.();

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Upload error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      onError?.(error as Error);
      alert(`Failed to upload photo: ${errorMessage}. Please check the console for details.`);
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const getImageDimensions = (file: File): Promise<{ width: number; height: number }> => {
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve({ width: img.width, height: img.height });
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve({ width: 0, height: 0 });
      };
      img.src = url;
    });
  };

  return (
    <div className="photo-upload">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        disabled={uploading}
        style={{ display: 'none' }}
        id={`photo-upload-${entityId}`}
      />
      <label
        htmlFor={`photo-upload-${entityId}`}
        className={`btn btn-secondary ${uploading ? 'disabled' : ''}`}
      >
        {uploading ? `Uploading... ${Math.round(progress)}%` : '📷 Upload Photo'}
      </label>
      {uploading && (
        <div className="upload-progress">
          <div
            className="upload-progress-bar"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
}
