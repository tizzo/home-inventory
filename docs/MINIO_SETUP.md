# MinIO Setup & Bucket Initialization

## Automatic Bucket Creation

The backend **automatically creates the bucket** when it starts up. You don't need to manually create it!

## How It Works

1. Backend starts and initializes S3 service
2. S3 service checks if bucket exists
3. If bucket doesn't exist, it creates it automatically
4. If bucket already exists, it continues normally

## Startup Sequence

When you run the backend, you should see logs like:

```
Initializing S3 service...
Initializing S3 service with bucket: home-inventory-photos, endpoint: Some("http://localhost:9000")
Using MinIO endpoint: http://localhost:9000
Bucket 'home-inventory-photos' does not exist, creating...
✅ Successfully created S3 bucket: home-inventory-photos
S3 service initialized successfully
```

Or if bucket already exists:

```
✅ S3 bucket 'home-inventory-photos' already exists
S3 service initialized successfully
```

## Manual Bucket Creation (Optional)

If you want to create the bucket manually before starting the backend:

### Option 1: Using MinIO Console
1. Open http://localhost:9001
2. Login with `minioadmin` / `minioadmin`
3. Click "Create Bucket"
4. Name: `home-inventory-photos`
5. Click "Create Bucket"

### Option 2: Using init_minio binary
```bash
cd backend
export S3_ENDPOINT=http://localhost:9000
export S3_ACCESS_KEY=minioadmin
export S3_SECRET_KEY=minioadmin
export S3_BUCKET=home-inventory-photos
cargo run --bin init_minio
```

### Option 3: Using mc (MinIO Client)
```bash
# Install mc: https://min.io/docs/minio/linux/reference/minio-mc.html
mc alias set local http://localhost:9000 minioadmin minioadmin
mc mb local/home-inventory-photos
```

## Troubleshooting "No Such Bucket" Error

If you're still getting "no such bucket" errors:

### 1. Check Backend Logs
Look for S3 initialization messages. If you see errors, the bucket creation failed.

### 2. Verify MinIO is Running
```bash
docker ps | grep minio
# Should show home-inventory-minio container

# Check MinIO logs
docker-compose logs minio
```

### 3. Check Environment Variables
```bash
# In backend directory
cat .env | grep S3_

# Should have:
# S3_ENDPOINT=http://localhost:9000
# S3_ACCESS_KEY=minioadmin
# S3_SECRET_KEY=minioadmin
# S3_BUCKET=home-inventory-photos
```

### 4. Test MinIO Connection
```bash
# Test MinIO API
curl http://localhost:9000/minio/health/live
# Should return: OK

# Test with credentials
curl -u minioadmin:minioadmin http://localhost:9000
```

### 5. Check Bucket in MinIO Console
1. Go to http://localhost:9001
2. Login with `minioadmin` / `minioadmin`
3. Check if `home-inventory-photos` bucket exists
4. If not, create it manually (see Option 1 above)

### 6. Restart Backend
After fixing issues, restart the backend:
```bash
# Stop backend (Ctrl+C)
# Then restart
cd backend
cargo run
```

## Common Issues

### Bucket Creation Fails
**Error:** `Failed to create S3 bucket`

**Causes:**
- MinIO not running
- Wrong credentials
- Network issues
- Permissions issue

**Fix:**
1. Verify MinIO is running
2. Check credentials match MinIO setup
3. Check network connectivity
4. Try creating bucket manually in console

### Bucket Already Exists Error
**Error:** `BucketAlreadyOwnedByYou` or `BucketAlreadyExists`

**This is OK!** The backend handles this gracefully and continues.

### Connection Refused
**Error:** Connection refused when trying to reach MinIO

**Fix:**
1. Start MinIO: `docker-compose up -d minio`
2. Wait a few seconds for it to start
3. Verify: `curl http://localhost:9000/minio/health/live`

## Quick Start Checklist

- [ ] MinIO is running (`docker-compose up -d minio`)
- [ ] Environment variables are set in `backend/.env`
- [ ] Backend starts without S3 errors
- [ ] Bucket creation message appears in logs
- [ ] Can access MinIO console at http://localhost:9001
- [ ] Bucket appears in MinIO console

## Production Notes

For production with AWS S3:
- Bucket should be created manually via AWS Console
- Backend will verify bucket exists but won't create it (AWS permissions)
- Set proper IAM policies for bucket access
