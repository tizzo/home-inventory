# Quick Start Guide

## Prerequisites

- Docker and Docker Compose
- Rust (for backend)
- Node.js 20+ (for frontend)

## Starting Everything

### Option 1: Docker Compose (Recommended for Infrastructure)

Start database and MinIO:
```bash
cd /Users/htyson/.cursor/worktrees/home-inventory/pay
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
cd /Users/htyson/.cursor/worktrees/home-inventory/pay
docker-compose up -d postgres minio
docker-compose logs -f  # Watch logs
```

### Terminal 2: Backend
```bash
cd /Users/htyson/.cursor/worktrees/home-inventory/pay/backend
export DATABASE_URL="postgresql://postgres:devpass@localhost:5432/inventory"
export S3_ENDPOINT="http://localhost:9000"
export S3_ACCESS_KEY="minioadmin"
export S3_SECRET_KEY="minioadmin"
export S3_BUCKET="home-inventory-photos"
cargo run
```

### Terminal 3: Frontend
```bash
cd /Users/htyson/.cursor/worktrees/home-inventory/pay/frontend
npm run dev
```

## Verify Everything is Running

1. **Database**: `psql postgresql://postgres:devpass@localhost:5432/inventory -c "SELECT 1"`
2. **MinIO API**: `curl http://localhost:9000/minio/health/live`
3. **MinIO Console**: http://localhost:9001 (minioadmin/minioadmin)
4. **Backend**: `curl http://localhost:3000/health`
5. **Frontend**: http://localhost:5173

## Using the Makefile

```bash
# Start infrastructure
make up

# Start backend (in another terminal)
make backend

# Start frontend (in another terminal)
make frontend

# Or use the dev script (starts backend + frontend)
./dev.sh
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

## Production Deployment

For production, you'll deploy:
- Backend: Single binary (includes all routes)
- Frontend: Static files (build with `npm run build`)
- Database: Managed PostgreSQL/Aurora
- S3: AWS S3 or MinIO in production

The backend is a single deployable unit with all routes included.
