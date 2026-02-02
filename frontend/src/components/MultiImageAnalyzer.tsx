import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { photosApi } from '../api';
import { useCreatePhoto, useAnalyzePhotoAndCreateDraft } from '../hooks';
import type { CreatePhotoRequest } from '../types/generated';

interface MultiImageAnalyzerProps {
  locationType: 'container' | 'shelf';
  locationId: string;
  onAnalysisComplete?: (draftId: string) => void;
  onCancel?: () => void;
}

interface UploadedPhoto {
  id: string;
  url: string;
  file: File;
}

export default function MultiImageAnalyzer({
  locationType,
  locationId,
  onAnalysisComplete,
  onCancel,
}: MultiImageAnalyzerProps) {
  const navigate = useNavigate();
  const [uploadedPhotos, setUploadedPhotos] = useState<UploadedPhoto[]>([]);
  const [hint, setHint] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createPhoto = useCreatePhoto();
  const { mutate: analyzePhotos, isPending } = useAnalyzePhotoAndCreateDraft();

  const handlePhotoUpload = async (files: FileList) => {
    setError(null);
    const filesArray = Array.from(files);

    // Validate files
    for (const file of filesArray) {
      if (!file.type.startsWith('image/')) {
        setError('All files must be images');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        setError('Each file must be less than 10MB');
        return;
      }
    }

    setIsUploading(true);

    try {
      for (const file of filesArray) {
        // Get presigned upload URL
        const { upload_url, s3_key } = await photosApi.getUploadUrl(
          locationType,
          locationId,
          file.name
        );

        // Upload to S3
        await fetch(upload_url, {
          method: 'PUT',
          body: file,
          headers: {
            'Content-Type': file.type,
          },
        });

        // Create photo record
        const photoData: CreatePhotoRequest = {
          entity_type: locationType,
          entity_id: locationId,
          s3_key,
          content_type: file.type,
          file_size: file.size,
        };

        const photo = await createPhoto.mutateAsync(photoData);

        // Generate preview URL
        const previewUrl = URL.createObjectURL(file);

        setUploadedPhotos((prev) => [
          ...prev,
          { id: photo.id, url: previewUrl, file },
        ]);
      }
    } catch (err) {
      console.error('Upload error:', err);
      setError(err instanceof Error ? err.message : 'Failed to upload photos');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemovePhoto = (photoId: string) => {
    setUploadedPhotos((prev) => {
      const photo = prev.find((p) => p.id === photoId);
      if (photo) {
        URL.revokeObjectURL(photo.url);
      }
      return prev.filter((p) => p.id !== photoId);
    });
  };

  const handleAnalyze = () => {
    if (uploadedPhotos.length === 0) {
      setError('Please add at least one photo');
      return;
    }

    setError(null);

    const request = {
      photo_ids: uploadedPhotos.map((p) => p.id),
      hint: hint.trim() || undefined,
      ...(locationType === 'container'
        ? { container_id: locationId }
        : { shelf_id: locationId }),
    };

    analyzePhotos(request, {
      onSuccess: (data) => {
        // Clean up preview URLs
        uploadedPhotos.forEach((photo) => URL.revokeObjectURL(photo.url));

        if (onAnalysisComplete) {
          onAnalysisComplete(data.id);
        } else {
          navigate(`/drafts/${data.id}`);
        }
      },
      onError: (err) => {
        console.error('Analysis error:', err);
        setError(err.message || 'Failed to analyze photos');
      },
    });
  };

  const handleCancel = () => {
    // Clean up preview URLs
    uploadedPhotos.forEach((photo) => URL.revokeObjectURL(photo.url));
    if (onCancel) {
      onCancel();
    }
  };

  return (
    <div className="multi-image-analyzer">
      <div className="photo-upload-section">
        <label className="section-label">
          Photos ({uploadedPhotos.length})
        </label>

        <div className="photos-grid">
          {uploadedPhotos.map((photo) => (
            <div key={photo.id} className="photo-preview">
              <img
                src={photo.url}
                alt="Upload preview"
                className="preview-image"
              />
              <button
                onClick={() => handleRemovePhoto(photo.id)}
                className="remove-button"
                disabled={isUploading || isPending}
              >
                ✕
              </button>
              <div className="photo-name">{photo.file.name}</div>
            </div>
          ))}

          <label className="photo-upload-box">
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => {
                if (e.target.files) {
                  handlePhotoUpload(e.target.files);
                }
                e.target.value = '';
              }}
              disabled={isUploading || isPending}
              className="file-input"
            />
            <div className="upload-prompt">
              {isUploading ? '⏳ Uploading...' : '+ Add Photos'}
            </div>
          </label>
        </div>
      </div>

      <div className="hint-section">
        <label htmlFor="hint" className="section-label">
          Context Hint (Optional)
        </label>
        <input
          id="hint"
          type="text"
          value={hint}
          onChange={(e) => setHint(e.target.value)}
          placeholder={`e.g., "toolbox with hand tools" or "kitchen pantry shelf"`}
          disabled={isPending}
          className="hint-input"
        />
        <p className="hint-description">
          Provide context to help AI better identify items and suggest
          descriptions
        </p>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      <div className="action-buttons">
        <button
          onClick={handleAnalyze}
          disabled={isPending || isUploading || uploadedPhotos.length === 0}
          className="analyze-button"
        >
          {isPending ? 'Analyzing...' : 'Analyze with AI'}
        </button>

        {onCancel && (
          <button
            onClick={handleCancel}
            disabled={isPending || isUploading}
            className="cancel-button"
          >
            Cancel
          </button>
        )}
      </div>

      <style>{`
        .multi-image-analyzer {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .photo-upload-section {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .section-label {
          font-weight: 500;
          font-size: 0.875rem;
          color: #374151;
        }

        .photos-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
          gap: 1rem;
        }

        .photo-preview {
          position: relative;
          border: 1px solid #e5e7eb;
          border-radius: 0.5rem;
          overflow: hidden;
          background: #f9fafb;
        }

        .preview-image {
          width: 100%;
          height: 150px;
          object-fit: cover;
        }

        .remove-button {
          position: absolute;
          top: 0.5rem;
          right: 0.5rem;
          background: #ef4444;
          color: white;
          border: none;
          border-radius: 50%;
          width: 1.5rem;
          height: 1.5rem;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          opacity: 0;
          transition: opacity 0.2s;
          font-size: 0.875rem;
        }

        .photo-preview:hover .remove-button {
          opacity: 1;
        }

        .remove-button:hover {
          background: #dc2626;
        }

        .remove-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .photo-name {
          padding: 0.5rem;
          font-size: 0.75rem;
          color: #6b7280;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .photo-upload-box {
          border: 2px dashed #d1d5db;
          border-radius: 0.5rem;
          height: 150px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: border-color 0.2s, background-color 0.2s;
          background: #f9fafb;
        }

        .photo-upload-box:hover {
          border-color: #3b82f6;
          background: #eff6ff;
        }

        .file-input {
          display: none;
        }

        .upload-prompt {
          color: #6b7280;
          font-size: 0.875rem;
        }

        .hint-section {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .hint-input {
          width: 100%;
          padding: 0.75rem;
          border: 1px solid #d1d5db;
          border-radius: 0.5rem;
          font-size: 0.875rem;
        }

        .hint-input:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .hint-input:disabled {
          background: #f3f4f6;
          cursor: not-allowed;
        }

        .hint-description {
          font-size: 0.75rem;
          color: #6b7280;
          margin: 0;
        }

        .error-message {
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #991b1b;
          padding: 0.75rem 1rem;
          border-radius: 0.5rem;
          font-size: 0.875rem;
        }

        .action-buttons {
          display: flex;
          gap: 0.75rem;
        }

        .analyze-button {
          flex: 1;
          background: #3b82f6;
          color: white;
          padding: 0.75rem 1.5rem;
          border: none;
          border-radius: 0.5rem;
          font-weight: 500;
          cursor: pointer;
          transition: background-color 0.2s;
        }

        .analyze-button:hover:not(:disabled) {
          background: #2563eb;
        }

        .analyze-button:disabled {
          background: #9ca3af;
          cursor: not-allowed;
        }

        .cancel-button {
          padding: 0.75rem 1.5rem;
          border: 1px solid #d1d5db;
          border-radius: 0.5rem;
          background: white;
          color: #374151;
          font-weight: 500;
          cursor: pointer;
          transition: background-color 0.2s;
        }

        .cancel-button:hover:not(:disabled) {
          background: #f9fafb;
        }

        .cancel-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}
