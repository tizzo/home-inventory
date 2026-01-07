import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { photosApi } from '../api';
import { useCreatePhoto, useAnalyzePhotoAndCreateDraft } from '../hooks';
import type { CreatePhotoRequest } from '../types/generated';

interface ImportItemsFromPhotoProps {
  containerId: string;
  onError?: (error: Error) => void;
}

export default function ImportItemsFromPhoto({
  containerId,
  onError,
}: ImportItemsFromPhotoProps) {
  const navigate = useNavigate();
  const [status, setStatus] = useState<
    'idle' | 'uploading' | 'analyzing' | 'error'
  >('idle');
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const createPhoto = useCreatePhoto();
  const analyzePhoto = useAnalyzePhotoAndCreateDraft();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert('File size must be less than 10MB');
      return;
    }

    await processPhoto(file);
  };

  const processPhoto = async (file: File) => {
    setStatus('uploading');
    setProgress(0);

    try {
      // Step 1: Get presigned upload URL
      const { upload_url, s3_key } = await photosApi.getUploadUrl(
        'container',
        containerId,
        file.type
      );

      // Step 2: Upload file directly to S3
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const percentComplete = (e.loaded / e.total) * 100;
            setProgress(percentComplete * 0.5); // 0-50% for upload
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status === 200 || xhr.status === 204) {
            resolve();
          } else {
            reject(new Error(`Upload failed: ${xhr.status}`));
          }
        });

        xhr.addEventListener('error', () => reject(new Error('Network error')));
        xhr.addEventListener('abort', () => reject(new Error('Upload aborted')));

        xhr.open('PUT', upload_url);
        xhr.setRequestHeader('Content-Type', file.type);
        xhr.send(file);
      });

      // Step 3: Get image dimensions
      const dimensions = await getImageDimensions(file);

      // Step 4: Create photo record
      const photoData: CreatePhotoRequest = {
        entity_type: 'container',
        entity_id: containerId,
        s3_key,
        thumbnail_s3_key: undefined,
        content_type: file.type,
        file_size: file.size,
        width: dimensions.width,
        height: dimensions.height,
      };

      const photo = await createPhoto.mutateAsync(photoData);
      setProgress(50);

      // Step 5: Analyze with AI
      setStatus('analyzing');
      const draft = await analyzePhoto.mutateAsync({
        container_id: containerId,
        photo_id: photo.id,
      });

      setProgress(100);

      // Step 6: Navigate to draft editor
      navigate(`/drafts/${draft.id}`);
    } catch (error) {
      console.error('Import error:', error);
      setStatus('error');
      onError?.(error as Error);
      alert(
        `Failed to import items: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      // Reset after a delay to allow user to see completion
      setTimeout(() => {
        setStatus('idle');
        setProgress(0);
      }, 1000);
    }
  };

  const getImageDimensions = (
    file: File
  ): Promise<{ width: number; height: number }> => {
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

  const isProcessing = status === 'uploading' || status === 'analyzing';

  const getButtonText = () => {
    switch (status) {
      case 'uploading':
        return `Uploading... ${Math.round(progress)}%`;
      case 'analyzing':
        return 'Analyzing with AI...';
      case 'error':
        return 'Error - Try Again';
      default:
        return '📸 Import Items from Photo';
    }
  };

  return (
    <div className="import-items-photo">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileSelect}
        disabled={isProcessing}
        style={{ display: 'none' }}
        id={`import-items-${containerId}`}
      />
      <label
        htmlFor={`import-items-${containerId}`}
        className={`btn btn-primary btn-sm ${isProcessing ? 'disabled' : ''}`}
        style={{ cursor: isProcessing ? 'not-allowed' : 'pointer' }}
      >
        {getButtonText()}
      </label>
      {isProcessing && (
        <div className="upload-progress" style={{ marginTop: '0.5rem' }}>
          <div
            className="upload-progress-bar"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
}
