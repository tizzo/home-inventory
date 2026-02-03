import { useState, useRef } from 'react';
import { floorPlansApi } from '../api';
import { useCreateFloorPlan } from '../hooks/useFloorPlans';
import '../App.css';

interface FloorPlanUploadProps {
  onUploadComplete?: (floorPlanId: string) => void;
  onCancel?: () => void;
}

export function FloorPlanUpload({ onUploadComplete, onCancel }: FloorPlanUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const createFloorPlan = useCreateFloorPlan();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      setError('Please select a PNG or JPG image');
      return;
    }

    // Validate file size (max 20MB for floor plans)
    if (file.size > 20 * 1024 * 1024) {
      setError('File size must be less than 20MB');
      return;
    }

    setSelectedFile(file);
    setError(null);

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewUrl(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Auto-fill name from filename if empty
    if (!name) {
      const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
      setName(nameWithoutExt);
    }
  };

  const getImageDimensions = (file: File): Promise<{ width: number; height: number }> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        resolve({ width: img.width, height: img.height });
      };
      img.onerror = (err) => {
        URL.revokeObjectURL(objectUrl);
        reject(err);
      };
      img.src = objectUrl;
    });
  };

  const handleUpload = async () => {
    if (!selectedFile || !name.trim()) {
      setError('Please provide a name and select a file');
      return;
    }

    setIsUploading(true);
    setError(null);
    setUploadProgress(0);

    try {
      // Step 1: Get presigned URL (10%)
      setUploadProgress(10);
      const { upload_url, s3_key } = await floorPlansApi.getUploadUrl(
        selectedFile.type
      );

      // Step 2: Upload to S3 (10-80%)
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const percent = 10 + (e.loaded / e.total) * 70;
            setUploadProgress(Math.round(percent));
          }
        });
        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        });
        xhr.addEventListener('error', () => reject(new Error('Upload failed')));
        xhr.open('PUT', upload_url);
        xhr.setRequestHeader('Content-Type', selectedFile.type);
        xhr.send(selectedFile);
      });

      // Step 3: Get image dimensions (85%)
      setUploadProgress(85);
      const dimensions = await getImageDimensions(selectedFile);

      // Step 4: Create floor plan record (90%)
      setUploadProgress(90);
      const floorPlan = await createFloorPlan.mutateAsync({
        name: name.trim(),
        description: description.trim() || undefined,
        s3_key,
        content_type: selectedFile.type,
        file_size: selectedFile.size,
        width: dimensions.width,
        height: dimensions.height,
      });

      // Done (100%)
      setUploadProgress(100);
      onUploadComplete?.(floorPlan.id);
    } catch (err) {
      console.error('Upload failed:', err);
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="floor-plan-upload">
      <h2>Add Floor Plan</h2>

      {error && <div className="error-message">{error}</div>}

      <div className="form-group">
        <label htmlFor="floor-plan-name">Name *</label>
        <input
          id="floor-plan-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., First Floor, Basement"
          disabled={isUploading}
        />
      </div>

      <div className="form-group">
        <label htmlFor="floor-plan-description">Description</label>
        <textarea
          id="floor-plan-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional description"
          disabled={isUploading}
        />
      </div>

      <div className="form-group">
        <label>Floor Plan Image *</label>
        <div
          className={`file-drop-zone ${selectedFile ? 'has-file' : ''}`}
          onClick={() => !isUploading && fileInputRef.current?.click()}
        >
          {previewUrl ? (
            <div className="preview-container">
              <img src={previewUrl} alt="Preview" className="file-preview" />
              <div className="file-info">
                {selectedFile?.name} ({Math.round(selectedFile!.size / 1024)} KB)
              </div>
            </div>
          ) : (
            <div className="drop-zone-content">
              <p>Click to select a PNG or JPG file</p>
              <p className="hint">Exported from MagicPlan or similar</p>
            </div>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
          disabled={isUploading}
        />
      </div>

      {isUploading && (
        <div className="upload-progress">
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
          <span className="progress-text">{uploadProgress}%</span>
        </div>
      )}

      <div className="form-actions">
        <button
          onClick={handleUpload}
          disabled={isUploading || !selectedFile || !name.trim()}
          className="btn btn-primary"
        >
          {isUploading ? 'Uploading...' : 'Upload Floor Plan'}
        </button>
        {onCancel && (
          <button
            onClick={onCancel}
            disabled={isUploading}
            className="btn btn-secondary"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
