import { useState, useRef } from 'react';

interface FileUploadProps {
  accept: string; // e.g., "application/pdf" or "application/pdf,image/*"
  maxSizeMB?: number;
  label: string;
  currentFileUrl?: string;
  onUploadComplete: (s3Key: string) => void;
  onClear?: () => void;
  onError?: (error: Error) => void;
  getUploadUrl: (contentType: string) => Promise<{ upload_url: string; s3_key: string }>;
}

export default function FileUpload({
  accept,
  maxSizeMB = 10,
  label,
  currentFileUrl,
  onUploadComplete,
  onClear,
  onError,
  getUploadUrl,
}: FileUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const acceptedTypes = accept.split(',').map(t => t.trim());
    const isValidType = acceptedTypes.some(type => {
      if (type.endsWith('/*')) {
        const prefix = type.slice(0, -2);
        return file.type.startsWith(prefix);
      }
      return file.type === type;
    });

    if (!isValidType) {
      alert(`Please select a valid file type: ${accept}`);
      return;
    }

    // Validate file size
    if (file.size > maxSizeMB * 1024 * 1024) {
      alert(`File size must be less than ${maxSizeMB}MB`);
      return;
    }

    await uploadFile(file);
  };

  const uploadFile = async (file: File) => {
    setUploading(true);
    setProgress(0);
    setFileName(file.name);

    try {
      // Step 1: Get presigned upload URL
      const { upload_url, s3_key } = await getUploadUrl(file.type);

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

      // Step 3: Notify parent component
      onUploadComplete(s3_key);

      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('File upload error:', error);
      const errorObj = error instanceof Error ? error : new Error(String(error));
      if (onError) {
        onError(errorObj);
      } else {
        alert(`Upload failed: ${errorObj.message}`);
      }
      setFileName(null);
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const handleClear = () => {
    setFileName(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (onClear) {
      onClear();
    }
  };

  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label}
      </label>

      {!fileName && !currentFileUrl && (
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept={accept}
            onChange={handleFileSelect}
            disabled={uploading}
            className="block w-full text-sm text-gray-500
              file:mr-4 file:py-2 file:px-4
              file:rounded-md file:border-0
              file:text-sm file:font-semibold
              file:bg-blue-50 file:text-blue-700
              hover:file:bg-blue-100
              disabled:opacity-50"
          />
        </div>
      )}

      {uploading && (
        <div className="mt-2">
          <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
            <span>{fileName}</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {(fileName || currentFileUrl) && !uploading && (
        <div className="mt-2 flex items-center justify-between bg-gray-50 p-3 rounded-md">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="text-sm text-gray-700">
              {fileName || 'File uploaded'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {currentFileUrl && (
              <a
                href={currentFileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                View
              </a>
            )}
            <button
              type="button"
              onClick={handleClear}
              className="text-sm text-red-600 hover:text-red-800"
            >
              Remove
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
