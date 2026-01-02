# Testing the Complete CRUD for Rooms

## Prerequisites

You need both the backend and database running to test the full CRUD functionality.

## Starting the Stack

### Option 1: Docker Compose (Recommended)

```bash
# Start PostgreSQL
cd /Users/htyson/.cursor/worktrees/home-inventory/pay
docker-compose up -d postgres

# Wait for DB to be ready
docker-compose logs -f postgres
# Press Ctrl+C when you see "database system is ready to accept connections"
```

### Option 2: Local PostgreSQL

If you have PostgreSQL running locally on port 5432, ensure the database exists:

```bash
psql postgresql://postgres:devpass@localhost:5432/postgres -c "CREATE DATABASE inventory;"
```

## Starting the Backend

```bash
cd /Users/htyson/.cursor/worktrees/home-inventory/pay/backend

# Set environment variable
export DATABASE_URL="postgresql://postgres:devpass@localhost:5432/inventory"

# Run with auto-reload (if you installed cargo-watch)
cargo watch -x run

# OR run normally
cargo run
```

The backend will:
1. Connect to the database
2. Run migrations automatically
3. Start listening on `http://localhost:3000`

You should see:
```
Server listening on http://0.0.0.0:3000
```

## Starting the Frontend

The frontend should already be running from earlier. If not:

```bash
cd /Users/htyson/.cursor/worktrees/home-inventory/pay/frontend
npm run dev
```

Frontend runs on `http://localhost:5173`

## Testing CRUD Operations

Visit **http://localhost:5173/rooms** in your browser.

### Test Create
1. Click "Add Room"
2. Enter name: "Garage"
3. Enter description: "Main garage with tools"
4. Click "Create Room"
5. ✅ Form should close and room appears in list

### Test Read
1. ✅ Room card shows name, description, creation date
2. ✅ If no rooms, shows "No rooms yet..." message

### Test Update
1. Click "Edit" on a room card
2. Change name to: "Garage - Workshop Area"
3. Update description
4. Click "Save Changes"
5. ✅ Form closes and room shows updated info
6. ✅ "Updated" timestamp appears

### Test Delete
1. Click "Delete" on a room card
2. Confirm deletion in dialog
3. ✅ Room disappears from list

### Test Edge Cases
- Try creating room with empty name → Should show validation error
- Edit and click "Cancel" → Changes should not save
- Delete and click "Cancel" → Room should remain
- Test with network disconnected → Should show error alerts

## Troubleshooting

### Backend won't start
```bash
# Check if port 3000 is in use
lsof -ti:3000 | xargs kill -9

# Check database connection
psql "postgresql://postgres:devpass@localhost:5432/inventory" -c "SELECT 1"
```

### Frontend shows proxy errors
- Backend is not running on port 3000
- Start the backend first, then refresh frontend

### Database connection refused
```bash
# Check if PostgreSQL is running
docker ps | grep postgres

# Or check local PostgreSQL
pg_isready

# Restart database
docker-compose restart postgres
```

### Migrations fail
```bash
# Reset database (CAUTION: deletes all data)
cd backend
sqlx database drop
sqlx database create
sqlx migrate run
```

## Quick Start Script

Save this as `start-dev.sh`:

```bash
#!/bin/bash

# Start database
docker-compose up -d postgres
sleep 3

# Start backend in background
cd backend
export DATABASE_URL="postgresql://postgres:devpass@localhost:5432/inventory"
cargo run &
BACKEND_PID=$!

# Wait for backend to start
sleep 5

# Frontend should already be running
echo "✅ Stack is ready!"
echo "Frontend: http://localhost:5173/rooms"
echo "Backend: http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop backend"
wait $BACKEND_PID
```

Then run:
```bash
chmod +x start-dev.sh
./start-dev.sh
```
