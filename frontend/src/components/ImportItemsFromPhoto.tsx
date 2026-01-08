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
      
      // Extract error message from API response
      let errorMessage = 'Unknown error';
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as { response?: { data?: { message?: string } } };
        if (axiosError.response?.data?.message) {
          errorMessage = axiosError.response.data.message;
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      // Show user-friendly error message
      if (errorMessage.includes('AI service unavailable')) {
        alert('The AI service is not configured. Please contact your administrator to set up the AI analysis feature.');
      } else if (errorMessage.includes('Rate limit')) {
        alert('Too many requests. Please wait a moment and try again.');
      } else if (errorMessage.includes('Invalid API key')) {
        alert('The AI service configuration is invalid. Please contact your administrator.');
      } else {
        alert(`Failed to import items: ${errorMessage}`);
      }
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
        return `📤 Uploading... ${Math.round(progress)}%`;
      case 'analyzing':
        return '🤖 Analyzing with AI...';
      case 'error':
        return '❌ Error - Try Again';
      default:
        return '📸 Import Items from Photo';
    }
  };

  const getProgressBarColor = () => {
    switch (status) {
      case 'analyzing':
        return '#4CAF50'; // Green for AI processing
      case 'error':
        return '#f44336'; // Red for errors
      default:
        return '#2196F3'; // Blue for uploading
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
        <div className="upload-progress" style={{ 
          marginTop: '0.5rem',
          backgroundColor: '#e0e0e0',
          borderRadius: '4px',
          height: '6px',
          overflow: 'hidden',
          position: 'relative'
        }}>
          <div
            className="upload-progress-bar"
            style={{ 
              width: `${status === 'analyzing' ? 100 : progress}%`,
              backgroundColor: getProgressBarColor(),
              height: '100%',
              transition: 'width 0.3s ease, background-color 0.3s ease',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            {status === 'analyzing' && (
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: 'linear-gradient(45deg, transparent 25%, rgba(255,255,255,0.2) 25%, rgba(255,255,255,0.2) 50%, transparent 50%, transparent 75%, rgba(255,255,255,0.2) 75%)',
                  backgroundSize: '20px 20px',
                  animation: 'progress-stripes 1s linear infinite'
                }}
              />
            )}
          </div>
        </div>
      )}
      <style>{`
        @keyframes progress-stripes {
          from { background-position: 0 0; }
          to { background-position: 20px 0; }
        }
      `}</style>
    </div>
  );
}
