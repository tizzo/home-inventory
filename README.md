# Home Inventory System

A serverless home inventory management system with QR code labeling, barcode scanning, and hierarchical organization.

## Architecture

### Stack
- **Backend**: Rust (Axum + aws-lambda-web)
- **Frontend**: TypeScript React (Mobile-first PWA)
- **Database**: Aurora DSQL (PostgreSQL locally)
- **Auth**: Direct Google OAuth2 (No Cognito)

- **Hosting**: 
  - Frontend: Cloudflare Pages (`app.yourdomain.com`)
  - Backend: AWS Lambda + API Gateway (`api.yourdomain.com`)
- **Infrastructure**: Pulumi (TypeScript)

### Key Features
- **Hierarchical Organization**: Room → Shelving Unit → Shelf → Container → Item
- **Nested Containers**: Containers can contain other containers
- **QR Code Labels**: Generic numbered labels (#1, #2, #3...) - print and assign
- **QR Scanning**: Camera-based scanning in EntitySelector
- **AI-Powered Item Import**: Analyze photos to identify and create items
- **Photo Management**: Attach photos to any entity with S3/MinIO storage
- **Tags**: AI-proposed tags for containers and items
- **Audit Trail**: Complete history with user tracking
- **Move Operations**: Relocate any entity with validation
- **Deep Linking**: Every state has a shareable URL
- **Mobile-First**: Optimized for phone/tablet use

## Project Structure

```
home-inventory/
├── backend/              # Rust Lambda application
│   ├── src/
│   │   ├── main.rs      # Lambda entry point with aws-lambda-web
│   │   ├── app.rs       # Axum app setup
│   │   ├── db/          # Database connection and migrations
│   │   ├── models/      # Shared data types (generate TS types)
│   │   ├── routes/      # API route handlers
│   │   ├── auth/        # Session management
│   │   └── services/    # Business logic
│   ├── migrations/      # sqlx database migrations
│   ├── Cargo.toml
│   └── Dockerfile       # Lambda container build
├── frontend/            # React TypeScript app
│   ├── src/
│   │   ├── components/  # React components
│   │   ├── pages/       # Page components
│   │   ├── hooks/       # Custom hooks
│   │   ├── api/         # API client
│   │   └── types/       # Generated TypeScript types
│   ├── package.json
│   └── vite.config.ts
├── infrastructure/      # Pulumi IaC
│   ├── index.ts         # Main infrastructure definition
│   ├── dsql.ts          # Aurora DSQL setup
│   ├── lambda.ts        # Lambda + API Gateway
│   ├── cognito.ts       # Auth configuration
│   └── cloudflare.ts    # Pages deployment
├── migrations/          # SQL migration files (shared)
└── README.md
```

## Data Model

### Entities (Hierarchical)
- **Room** - Physical space (e.g., "Garage", "Kitchen")
- **ShelvingUnit** - Furniture in a room (e.g., "Metal Shelf Unit")
- **Shelf** - Level within a shelving unit (e.g., "Top Shelf")
- **Container** - Box/bin on a shelf (can nest)
- **Item** - Individual item in a container

### Supporting Entities
- **Label** - QR code labels (pre-generated, assigned on use)
- **Tag** - Categorization
- **Photo** - Images attached to entities
- **AuditLog** - Change history
- **User** - Authenticated users
- **Session** - User sessions (HttpOnly cookies)

### Key Features
- Everything is directly addressable via URL
- Everything can be relocated at any time
- Every action is audited with user + timestamp
- Generic numbered labels allow flexible organization

## Getting Started

### Prerequisites
- Rust 1.75+
- Node.js 20+
- Docker
- PostgreSQL 15+ (for local development)
- AWS CLI configured
- Pulumi CLI
- Cloudflare account

### Local Development

1. **Database Setup**
```bash
# Start PostgreSQL
docker run -d \
  --name inventory-db \
  -e POSTGRES_DB=inventory \
  -e POSTGRES_PASSWORD=devpass \
  -p 5432:5432 \
  postgres:15

# Set database URL
export DATABASE_URL="postgresql://postgres:devpass@localhost:5432/inventory"
```

2. **Backend Setup**
```bash
cd backend

# Install sqlx-cli
cargo install sqlx-cli --no-default-features --features postgres

# Run migrations
sqlx migrate run

# Run backend
cargo run
# Backend runs on http://localhost:3000
```

3. **Frontend Setup**
```bash
cd frontend

# Install dependencies
npm install

# Generate types from Rust
npm run generate-types

# Start dev server
npm run dev
# Frontend runs on http://localhost:5173
```

4. **Infrastructure (Optional for local)**
```bash
cd infrastructure

# Install dependencies
npm install

# Configure Pulumi
pulumi login
pulumi stack init dev

# Set required config
pulumi config set aws:region us-east-1
pulumi config set cloudflare:apiToken YOUR_TOKEN --secret
pulumi config set domain yourdomain.com

# Preview infrastructure
pulumi preview
```

### Testing

**Backend:**
```bash
cd backend

# Unit tests
cargo test

# Integration tests (requires DB)
cargo test --features integration-tests

# Check types
cargo check
```

**Frontend:**
```bash
cd frontend

# Unit tests
npm test

# Type check
npm run type-check

# Lint
npm run lint
```

### Deployment

```bash
# Deploy infrastructure and applications
cd infrastructure
pulumi up

# Manually deploy frontend (if not auto-deployed)
cd frontend
npm run build
npx wrangler pages deploy dist --project-name=home-inventory
```

## Authentication & Security

We integrate directly with **Google OAuth 2.0** for authentication, bypassing the need for AWS Cognito.

1.  **Direct Google Integration**:
    *   Backend directly exchanges authorization codes with Google.
    *   Uses secure `httpOnly`, `SameSite=Lax` cookies for session management.
    *   No passwords are ever stored or handled by our application.

2.  **Session Management**:
    *   Sessions are stored in-memory (development) or a persistent store (production).
    *   Session cookies are automatically handled by the browser.

3.  **Route Protection**:
    *   **Backend**: An `auth_guard` middleware protects all sensitive API routes. Any request without a valid session returns `401 Unauthorized`.
    *   **Frontend**: A `ProtectedRoute` component wraps all application pages. Unauthenticated users are shown an "Access Denied" screen and prompted to log in.


## API Endpoints

### Authentication
- `GET /auth/login` - Redirect to Google OAuth
- `GET /auth/callback` - OAuth callback
- `POST /auth/logout` - Destroy session
- `GET /auth/me` - Get current user

### Rooms
- `GET /api/rooms` - List all rooms
- `GET /api/rooms/:id` - Get room details
- `POST /api/rooms` - Create room
- `PUT /api/rooms/:id` - Update room
- `DELETE /api/rooms/:id` - Delete room

### Shelving Units
- `GET /api/units` - List all units
- `GET /api/units/:id` - Get unit details
- `GET /api/rooms/:roomId/units` - Units in a room
- `POST /api/units` - Create unit
- `PUT /api/units/:id` - Update unit
- `DELETE /api/units/:id` - Delete unit

### Shelves, Containers, Items
- Standard CRUD operations (GET, POST, PUT, DELETE)
- Hierarchy queries (by parent entity)
- Move operations (POST /api/{entity}/:id/move)
- Bulk operations (bulk create items)

### Item Import Drafts
- `POST /api/item-import-drafts` - Create draft
- `POST /api/item-import-drafts/analyze` - Analyze photo with AI
- `GET /api/item-import-drafts/:id` - Get draft
- `PUT /api/item-import-drafts/:id` - Update draft
- `POST /api/item-import-drafts/:id/commit` - Commit draft (create items)
- `DELETE /api/item-import-drafts/:id` - Delete draft

### Audit Logs
- `GET /api/audit` - List audit logs with filters
- `GET /api/audit/entity/:type/:id` - Logs for specific entity

### Labels
- `POST /api/labels/generate` - Generate batch of labels
- `GET /api/labels/:id` - Get label details
- `POST /api/labels/:id/assign` - Assign label to entity
- `GET /api/labels/print/:batchId` - Generate Avery label PDF

### Photos
- `POST /api/photos/upload-url` - Get pre-signed S3 URL
- `POST /api/photos` - Create photo record
- `GET /api/photos/:id` - Get photo
- `DELETE /api/photos/:id` - Delete photo

### Search
- `GET /api/search?q=christmas` - Search across all entities
- `GET /api/tags` - List all tags
- `GET /api/tags/:tag/items` - Items with tag

### Barcodes
- `POST /api/products/lookup` - Look up product by barcode
- `GET /api/items/barcode/:barcode` - Find item by barcode

## Development Phases

### Phase 1: Foundation ✓ (100% Complete)
- [x] Project structure
- [x] Auth flow (Direct Google OAuth2 + Session cookies)
- [x] AuthUser middleware extractor
- [x] Basic CRUD for Rooms
- [x] Database setup with migrations
- [x] Type generation pipeline

### Phase 2: Core Hierarchy ✓ (100% Complete)
- [x] Shelving Units CRUD
- [x] Shelves CRUD
- [x] Containers CRUD (with nested container support)
- [x] Items CRUD
- [x] Move operations (all entity types)
- [x] Full frontend with CRUD modals
- [x] Photo upload & display (all entities)
- [x] Audit logging with user tracking
- [x] Container contents view (items + sub-containers)

### Phase 3: Labels & QR ✓ (100% Complete)
- [x] Label generation service
- [x] QR code generation
- [x] PDF generation (Avery 18660 format)
- [x] Label assignment flow
- [x] Camera QR scanning in EntitySelector

### Phase 3.5: AI Features ✓ (100% Complete)
- [x] Photo analysis with Anthropic Claude
- [x] Item import drafts
- [x] AI-proposed container descriptions and tags
- [x] Draft review and commit workflow

### Phase 4: Search & Tags (30% Complete)
- [x] Tag database schema
- [x] Tag models (backend)
- [x] AI tag proposals
- [ ] Tag management UI
- [ ] Full-text search
- [ ] Tag filtering
- [ ] Barcode scanning (field exists)
- [ ] Product lookup APIs

### Phase 5: Polish & Testing (10% Complete)
- [x] Reusable components (MoveModal, EntityCreateModal, EntitySelector)
- [ ] Component refactoring (use reusable components everywhere)
- [ ] Loading skeletons
- [ ] Error boundaries
- [ ] Comprehensive testing
- [ ] API documentation

## Configuration

### Environment Variables

**Backend:**
```bash
DATABASE_URL=postgresql://...
APP_BASE_URL=http://localhost:5173          # Frontend URL for redirects
GOOGLE_CLIENT_ID=...                        # Google OAuth Credential
GOOGLE_CLIENT_SECRET=...                    # Google OAuth Secret
GOOGLE_REDIRECT_URL=http://localhost:3000/api/auth/callback # Backend Callback URL
AWS_REGION=us-east-1
PHOTOS_BUCKET=inventory-photos
ANTHROPIC_API_KEY=...                       # For AI photo analysis
S3_ENDPOINT=http://localhost:9000           # MinIO for local dev
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
```


**Frontend:**
```bash
VITE_API_URL=https://api.yourdomain.com  # Backend API
VITE_COGNITO_DOMAIN=auth.yourdomain.com  # For login redirect
```

## License

MIT

## Support

For issues and questions, please open a GitHub issue.
