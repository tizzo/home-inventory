#!/bin/bash
# Quick start script for Home Inventory System

set -e

echo "🏠 Starting Home Inventory System"
echo ""

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null && ! command -v docker &> /dev/null; then
    echo "❌ Docker is required but not installed"
    exit 1
fi

# Start infrastructure
echo "📦 Starting infrastructure (PostgreSQL + MinIO)..."
docker-compose up -d postgres minio

echo "⏳ Waiting for services to be ready..."
sleep 5

# Check services
echo ""
echo "✅ Infrastructure started!"
echo ""
echo "📝 Next steps:"
echo ""
echo "1. Start Backend (in a new terminal):"
echo "   cd backend"
echo "   export DATABASE_URL=\"postgresql://postgres:devpass@localhost:5432/inventory\""
echo "   export S3_ENDPOINT=\"http://localhost:9000\""
echo "   export S3_ACCESS_KEY=\"minioadmin\""
echo "   export S3_SECRET_KEY=\"minioadmin\""
echo "   export S3_BUCKET=\"home-inventory-photos\""
echo "   cargo run"
echo ""
echo "2. Start Frontend (in another terminal):"
echo "   cd frontend"
echo "   npm run dev"
echo ""
echo "3. Visit: http://localhost:5173"
echo ""
echo "📊 Services:"
echo "   - Database: localhost:5432"
echo "   - MinIO API: http://localhost:9000"
echo "   - MinIO Console: http://localhost:9001 (minioadmin/minioadmin)"
echo "   - Backend: http://localhost:3000 (after starting)"
echo "   - Frontend: http://localhost:5173 (after starting)"
echo ""
