# Quick Start Guide

**Last Updated**: December 2024

Get the Home Inventory System running locally in minutes.

## Prerequisites

- Docker and Docker Compose
- Rust 1.75+ (for backend)
- Node.js 20+ (for frontend)
- Google OAuth credentials (for authentication)
- Anthropic API key (for AI features, optional)

## Starting Everything

### Option 1: Docker Compose (Recommended for Infrastructure)

Start database and MinIO:
```bash
docker-compose up -d postgres minio
```

Wait a few seconds for services to start, then verify:
```bash
# Check services are running
docker-compose ps

# Check MinIO bucket was created
docker-compose logs minio-init
```

### Option 2: All Services via Docker Compose

If you want to run backend in Docker too:
```bash
docker-compose up -d
```

## Starting Backend

### Local Development (Recommended)

```bash
cd backend

# Set environment variables
export DATABASE_URL="postgresql://postgres:devpass@localhost:5432/inventory"
export S3_ENDPOINT="http://localhost:9000"
export S3_ACCESS_KEY="minioadmin"
export S3_SECRET_KEY="minioadmin"
export S3_BUCKET="home-inventory-photos"
export S3_REGION="us-east-1"

# Or create backend/.env file with:
# DATABASE_URL=postgresql://postgres:devpass@localhost:5432/inventory
# S3_ENDPOINT=http://localhost:9000
# S3_ACCESS_KEY=minioadmin
# S3_SECRET_KEY=minioadmin
# S3_BUCKET=home-inventory-photos
# S3_REGION=us-east-1

# Run backend
cargo run

# Or with auto-reload
cargo watch -x run
```

Backend will be available at: **http://localhost:3000**

## Starting Frontend

```bash
cd frontend

# Install dependencies (first time only)
npm install

# Start dev server
npm run dev
```

Frontend will be available at: **http://localhost:5173**

## Complete Startup Sequence

### Terminal 1: Infrastructure
```bash
docker-compose up -d postgres minio
docker-compose logs -f  # Watch logs
```

### Terminal 2: Backend
```bash
cd backend

# Set required environment variables
export DATABASE_URL="postgresql://postgres:devpass@localhost:5432/inventory"
export S3_ENDPOINT="http://localhost:9000"
export S3_ACCESS_KEY="minioadmin"
export S3_SECRET_KEY="minioadmin"
export S3_BUCKET="home-inventory-photos"
export APP_BASE_URL="http://localhost:5173"
export GOOGLE_CLIENT_ID="your-google-client-id"
export GOOGLE_CLIENT_SECRET="your-google-client-secret"
export GOOGLE_REDIRECT_URL="http://localhost:3000/api/auth/callback"

# Optional: AI features
export ANTHROPIC_API_KEY="your-anthropic-api-key"

cargo run
```

### Terminal 3: Frontend
```bash
cd frontend
npm run dev
```

## Verify Everything is Running

1. **Database**: `psql postgresql://postgres:devpass@localhost:5432/inventory -c "SELECT 1"`
2. **MinIO API**: `curl http://localhost:9000/minio/health/live`
3. **MinIO Console**: http://localhost:9001 (minioadmin/minioadmin)
4. **Backend Health**: `curl http://localhost:3000/health`
5. **Frontend**: http://localhost:5173

## First Time Setup

### 1. Google OAuth Setup

See [backend/GOOGLE_AUTH_SETUP.md](./backend/GOOGLE_AUTH_SETUP.md) for detailed instructions.

Quick steps:
1. Go to Google Cloud Console
2. Create OAuth 2.0 credentials
3. Add authorized redirect URI: `http://localhost:3000/api/auth/callback`
4. Copy Client ID and Secret to environment variables

### 2. Anthropic API Key (Optional)

For AI-powered item import from photos:
1. Sign up at https://console.anthropic.com/
2. Create an API key
3. Set `ANTHROPIC_API_KEY` environment variable

### 3. First Login

1. Visit http://localhost:5173
2. Click "Login with Google"
3. Authorize the application
4. You'll be redirected back and logged in

## What You Can Do

Once running, you can:

### Basic Organization
- ✅ Create rooms (e.g., "Garage", "Kitchen")
- ✅ Add shelving units to rooms
- ✅ Add shelves to units
- ✅ Create containers on shelves
- ✅ Add items to containers or shelves
- ✅ Upload photos to any entity
- ✅ Move entities between locations

### Labels & QR Codes
- ✅ Generate QR code labels
- ✅ Print labels as PDF (Avery 18660 format)
- ✅ Assign labels to entities
- ✅ Scan QR codes to quickly select entities

### AI Features (requires Anthropic API key)
- ✅ Take photo of items
- ✅ AI analyzes and identifies items
- ✅ Review and edit AI suggestions
- ✅ Bulk create items from photo
- ✅ AI proposes container descriptions and tags

### Audit & History
- ✅ View all changes in audit log
- ✅ Filter by entity type, action, or user
- ✅ See who made what changes and when

## Development Tips

### Type Generation

After changing backend models:
```bash
cd frontend
npm run generate-types
```

### Database Migrations

Create a new migration:
```bash
cd backend
sqlx migrate add your_migration_name
```

Run migrations:
```bash
sqlx migrate run
```

### Code Quality

Before committing:
```bash
# Backend
cd backend
cargo fmt
cargo clippy -- -D warnings
cargo test

# Frontend
cd frontend
npm run type-check
npm run lint
npm run build
```

## Troubleshooting

### Services won't start
```bash
# Check what's using the ports
lsof -ti:5432 | xargs kill -9  # PostgreSQL
lsof -ti:9000 | xargs kill -9  # MinIO
lsof -ti:3000 | xargs kill -9  # Backend
lsof -ti:5173 | xargs kill -9  # Frontend
```

### Database connection errors
```bash
# Restart database
docker-compose restart postgres

# Check database logs
docker-compose logs postgres
```

### MinIO bucket not created
```bash
# Check minio-init logs
docker-compose logs minio-init

# Manually create bucket in console: http://localhost:9001
```

### Backend won't start
- Check environment variables are set
- Verify database is running
- Verify MinIO is running
- Check backend logs for errors

## Stopping Everything

```bash
# Stop infrastructure
docker-compose down

# Stop backend: Ctrl+C in terminal
# Stop frontend: Ctrl+C in terminal
```

## Environment Variables Reference

### Required (Backend)
```bash
DATABASE_URL=postgresql://postgres:devpass@localhost:5432/inventory
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_BUCKET=home-inventory-photos
S3_REGION=us-east-1
APP_BASE_URL=http://localhost:5173
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URL=http://localhost:3000/api/auth/callback
```

### Optional (Backend)
```bash
ANTHROPIC_API_KEY=your-api-key  # For AI features
RUST_LOG=info                    # Logging level
```

## Production Deployment

For production, you'll deploy:
- **Backend**: AWS Lambda + API Gateway (Rust binary)
- **Frontend**: Cloudflare Pages (static files)
- **Database**: Aurora DSQL or managed PostgreSQL
- **Storage**: AWS S3
- **Auth**: Google OAuth (no Cognito needed)

See [README.md](./README.md) for full deployment instructions.

## Next Steps

After getting everything running:

1. **Read the docs**: Check [docs/PROJECT_STATUS.md](./docs/PROJECT_STATUS.md) to see what's implemented
2. **Try features**: Create some rooms, add items, upload photos
3. **Explore AI**: Try the photo analysis feature (needs Anthropic API key)
4. **Check TODOs**: See [TODO.md](./TODO.md) for planned features
5. **Contribute**: Review [docs/REFACTORING.md](./docs/REFACTORING.md) for opportunities
