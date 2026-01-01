# Photo Upload System Setup

## Overview

A reusable photo upload system using MinIO (local S3-compatible storage) that works across all resources (rooms, shelving units, items, etc.).

## Architecture

### Backend
- **MinIO**: Local S3-compatible storage (runs in Docker)
- **S3Service**: Handles presigned URLs for direct uploads
- **Photo Routes**: REST API for photo management
- **Photo Model**: Database schema with polymorphic associations

### Frontend
- **PhotoUpload Component**: Reusable upload button with progress
- **PhotoGallery Component**: Displays photos in a grid
- **React Query Hooks**: Data fetching and cache management

## Setup

### 1. Start MinIO

```bash
cd /Users/htyson/.cursor/worktrees/home-inventory/pay
docker-compose up -d minio
```

MinIO will be available at:
- **API**: http://localhost:9000
- **Console**: http://localhost:9001
- **Credentials**: minioadmin / minioadmin

### 2. Configure Backend Environment

Add to `backend/.env` or set environment variables:

```bash
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_BUCKET=home-inventory-photos
S3_REGION=us-east-1
```

### 3. Start Backend

The backend will automatically:
- Connect to MinIO
- Create the bucket if it doesn't exist
- Initialize S3 service

```bash
cd backend
export DATABASE_URL="postgresql://postgres:devpass@localhost:5432/inventory"
cargo run
```

### 4. Frontend

The frontend is already configured to use the backend API. No additional setup needed!

## Usage

### In Any Component

```tsx
import { PhotoUpload, PhotoGallery } from '../components';

function MyResourcePage({ resourceId }: { resourceId: string }) {
  return (
    <div>
      <PhotoGallery entityType="room" entityId={resourceId} />
      <PhotoUpload
        entityType="room"
        entityId={resourceId}
        onUploadComplete={() => console.log('Uploaded!')}
      />
    </div>
  );
}
```

### Supported Entity Types

- `room`
- `unit` (shelving unit)
- `shelf`
- `container`
- `item`

## API Endpoints

### Get Presigned Upload URL
```
POST /api/photos/upload-url?entity_type=room&entity_id=abc-123
Body: { "content_type": "image/jpeg" }
Response: { "upload_url": "...", "s3_key": "...", "expires_in": 3600 }
```

### Upload Flow
1. Frontend requests presigned URL
2. Frontend uploads directly to S3 using presigned URL
3. Frontend creates photo record in database
4. Photo appears in gallery automatically

### Get Photos for Entity
```
GET /api/photos?entity_type=room&entity_id=abc-123
Response: [{ "id": "...", "url": "...", ... }]
```

### Delete Photo
```
DELETE /api/photos/:id
```

## Features

### PhotoUpload Component
- ✅ File type validation (images only)
- ✅ File size validation (max 10MB)
- ✅ Upload progress indicator
- ✅ Automatic image dimension detection
- ✅ Error handling
- ✅ Disabled state during upload

### PhotoGallery Component
- ✅ Responsive grid layout
- ✅ Thumbnail support
- ✅ Click to view full size
- ✅ Delete with confirmation
- ✅ Loading and error states
- ✅ Auto-refresh after upload/delete

## Database Schema

```sql
CREATE TABLE photos (
    id UUID PRIMARY KEY,
    entity_type VARCHAR(20) NOT NULL,  -- 'room', 'unit', etc.
    entity_id UUID NOT NULL,
    s3_key VARCHAR(500) NOT NULL,
    thumbnail_s3_key VARCHAR(500),
    content_type VARCHAR(100) NOT NULL,
    file_size INTEGER NOT NULL,
    width INTEGER,
    height INTEGER,
    created_at TIMESTAMPTZ NOT NULL,
    created_by UUID NOT NULL
);
```

## File Storage Structure

```
s3://home-inventory-photos/
  room/
    {room-id}/
      {photo-id}.jpg
      {photo-id}.png
  unit/
    {unit-id}/
      {photo-id}.jpg
  ...
```

## Production Considerations

### AWS S3
For production, update environment variables:
```bash
S3_ENDPOINT=https://s3.amazonaws.com  # or your region endpoint
S3_ACCESS_KEY=<aws-access-key>
S3_SECRET_KEY=<aws-secret-key>
S3_BUCKET=home-inventory-photos-prod
S3_REGION=us-east-1
```

### CDN
Consider using CloudFront or similar for photo URLs:
- Faster delivery
- Lower S3 costs
- Better caching

### Thumbnails
Currently thumbnails are not generated. To add:
1. Use image processing library (image-rs, imagemagick)
2. Generate thumbnail on upload
3. Store both original and thumbnail in S3
4. Use thumbnail in gallery, original on click

### Security
- Add authentication to photo routes
- Validate entity ownership before upload
- Set proper S3 bucket policies
- Use presigned URLs with short expiration

## Troubleshooting

### MinIO not accessible
```bash
# Check if running
docker ps | grep minio

# Check logs
docker-compose logs minio

# Restart
docker-compose restart minio
```

### Upload fails
- Check MinIO console: http://localhost:9001
- Verify bucket exists
- Check CORS settings (if needed)
- Verify presigned URL hasn't expired

### Photos not showing
- Check browser console for errors
- Verify photo records in database
- Check presigned URL generation
- Verify S3 file exists

## Testing

### Manual Test
1. Start MinIO and backend
2. Visit http://localhost:5173/rooms
3. Click "Upload Photo" on a room
4. Select an image file
5. Wait for upload to complete
6. Photo should appear in gallery
7. Click photo to view full size
8. Click × to delete

### Integration Test
```bash
# Test presigned URL generation
curl -X POST "http://localhost:3000/api/photos/upload-url?entity_type=room&entity_id=test-id" \
  -H "Content-Type: application/json" \
  -d '{"content_type": "image/jpeg"}'
```
