# Photo Upload Troubleshooting Guide

## Common Issues and Fixes

### 1. Upload Fails in UI

**Check Backend Logs:**
```bash
# If running with cargo run
# Check terminal output for errors

# If running in Docker
docker-compose logs backend
```

**Common Causes:**

#### Missing Environment Variables
The backend needs these environment variables set:

```bash
# Required for MinIO
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_BUCKET=home-inventory-photos
S3_REGION=us-east-1

# Also supports AWS standard vars
AWS_ACCESS_KEY_ID=minioadmin
AWS_SECRET_ACCESS_KEY=minioadmin
```

**Fix:** Add to `backend/.env` file or export before running:
```bash
export S3_ENDPOINT=http://localhost:9000
export S3_ACCESS_KEY=minioadmin
export S3_SECRET_KEY=minioadmin
export S3_BUCKET=home-inventory-photos
cd backend
cargo run
```

#### MinIO Not Running
```bash
# Check if MinIO is running
docker ps | grep minio

# Start MinIO
docker-compose up -d minio

# Check MinIO logs
docker-compose logs minio
```

#### Backend Can't Connect to MinIO
- Verify MinIO is accessible: http://localhost:9000
- Check MinIO console: http://localhost:9001 (minioadmin/minioadmin)
- Verify `S3_ENDPOINT` is correct
- Check if backend and MinIO are on same network (docker-compose)

#### Presigned URL Generation Fails
Check backend logs for:
- Credential errors
- Bucket creation errors
- Network connection errors

**Debug Steps:**
1. Check backend startup logs for S3 initialization:
   ```
   Initializing S3 service with bucket: home-inventory-photos, endpoint: Some("http://localhost:9000")
   Using MinIO endpoint: http://localhost:9000
   ```

2. Test presigned URL endpoint manually:
   ```bash
   curl -X POST "http://localhost:3000/api/photos/upload-url?entity_type=room&entity_id=test-id" \
     -H "Content-Type: application/json" \
     -d '{"content_type": "image/jpeg"}'
   ```

3. Check browser console for errors when clicking "Upload Photo"

### 2. Upload Starts But Fails During Transfer

**Check Browser Console:**
- Look for CORS errors
- Check network tab for failed PUT request
- Verify presigned URL is valid (not expired)

**Common Causes:**

#### CORS Issues
MinIO needs CORS configured for browser uploads. The presigned URL should work, but if you see CORS errors:

1. Access MinIO console: http://localhost:9001
2. Go to Settings → CORS
3. Add rule:
   - Allowed Origins: `*` (or your frontend URL)
   - Allowed Methods: `PUT, GET, DELETE`
   - Allowed Headers: `*`

#### Presigned URL Expired
Presigned URLs expire after 1 hour. If you wait too long, request a new one.

#### File Too Large
Default max is 10MB. Check `PhotoUpload.tsx` for validation.

### 3. Upload Succeeds But Photo Doesn't Appear

**Check:**
1. Photo record created in database:
   ```sql
   SELECT * FROM photos ORDER BY created_at DESC LIMIT 5;
   ```

2. File exists in MinIO:
   - Go to MinIO console: http://localhost:9001
   - Navigate to `home-inventory-photos` bucket
   - Check if file exists

3. Gallery refresh:
   - React Query should auto-refresh
   - Check browser network tab for GET /api/photos request
   - Verify response includes photo with URL

4. Presigned download URL:
   - Check if URL generation succeeds
   - Verify URL is accessible in browser

### 4. Backend Compilation Errors

**If you see AWS SDK errors:**
```bash
cd backend
cargo clean
cargo build
```

**If credentials provider errors:**
- Verify AWS SDK version in Cargo.toml
- Check that `aws-config` and `aws-sdk-s3` are compatible versions

## Debug Checklist

- [ ] MinIO is running (`docker ps | grep minio`)
- [ ] Backend environment variables are set
- [ ] Backend can connect to MinIO (check logs)
- [ ] Bucket exists in MinIO (check console)
- [ ] Presigned URL endpoint works (test with curl)
- [ ] Browser console shows no errors
- [ ] Network tab shows successful PUT request
- [ ] Photo record exists in database
- [ ] File exists in MinIO bucket
- [ ] Gallery fetches photos successfully

## Testing the Full Flow

### 1. Test Presigned URL Generation
```bash
curl -X POST "http://localhost:3000/api/photos/upload-url?entity_type=room&entity_id=test-123" \
  -H "Content-Type: application/json" \
  -d '{"content_type": "image/jpeg"}'
```

Expected response:
```json
{
  "upload_url": "http://localhost:9000/home-inventory-photos/room/test-123/...",
  "s3_key": "room/test-123/...",
  "expires_in": 3600
}
```

### 2. Test Upload to Presigned URL
```bash
# Use the upload_url from step 1
curl -X PUT "http://localhost:9000/home-inventory-photos/room/test-123/..." \
  -H "Content-Type: image/jpeg" \
  --data-binary @test-image.jpg
```

### 3. Test Photo Creation
```bash
curl -X POST "http://localhost:3000/api/photos" \
  -H "Content-Type: application/json" \
  -d '{
    "entity_type": "room",
    "entity_id": "test-123",
    "s3_key": "room/test-123/...",
    "content_type": "image/jpeg",
    "file_size": 12345,
    "width": 800,
    "height": 600
  }'
```

### 4. Test Photo Retrieval
```bash
curl "http://localhost:3000/api/photos?entity_type=room&entity_id=test-123"
```

## Environment Setup

### Backend .env File
Create `backend/.env`:
```bash
DATABASE_URL=postgresql://postgres:devpass@localhost:5432/inventory
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_BUCKET=home-inventory-photos
S3_REGION=us-east-1
```

### Docker Compose
The docker-compose.yml already includes MinIO. Just start it:
```bash
docker-compose up -d minio
```

## Still Having Issues?

1. **Check all logs:**
   - Backend: Terminal output or `docker-compose logs backend`
   - MinIO: `docker-compose logs minio`
   - Browser: Console and Network tabs

2. **Verify connectivity:**
   ```bash
   # Test MinIO API
   curl http://localhost:9000/minio/health/live
   
   # Test backend
   curl http://localhost:3000/health
   ```

3. **Reset everything:**
   ```bash
   # Stop services
   docker-compose down
   
   # Remove volumes (CAUTION: deletes data)
   docker-compose down -v
   
   # Restart
   docker-compose up -d minio postgres
   ```

4. **Check file permissions:**
   - Ensure backend can write to MinIO
   - Check MinIO bucket policies
