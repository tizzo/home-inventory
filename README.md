# Home Inventory System

A serverless home inventory management system with QR code labeling, barcode scanning, and hierarchical organization.

## Architecture

### Stack
- **Backend**: Rust (Axum + aws-lambda-web)
- **Frontend**: TypeScript React (Mobile-first PWA)
- **Database**: Aurora DSQL (PostgreSQL locally)
- **Auth**: AWS Cognito with Google OAuth
- **Hosting**: 
  - Frontend: Cloudflare Pages (`app.yourdomain.com`)
  - Backend: AWS Lambda + API Gateway (`api.yourdomain.com`)
- **Infrastructure**: Pulumi (TypeScript)

### Key Features
- **Hierarchical Organization**: Room → Shelving Unit → Shelf → Container → Item
- **QR Code Labels**: Generic numbered labels (#1, #2, #3...) - print and assign
- **Barcode Scanning**: Scan product barcodes to auto-populate item details
- **Photo Management**: Attach photos to any entity
- **Search & Tags**: Full-text search with tagging
- **Audit Trail**: Complete history of all changes
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

## Authentication Flow

1. User visits `app.yourdomain.com`
2. Clicks "Login with Google"
3. Redirects to Cognito Hosted UI
4. User authenticates with Google
5. Cognito redirects to `/auth/callback?code=xxx`
6. Backend exchanges code for Cognito tokens
7. Backend creates session in DynamoDB
8. Backend sets HttpOnly session cookie (`Domain=.yourdomain.com`)
9. Backend redirects to `/dashboard`
10. All API calls automatically include session cookie
11. Backend validates session on each request

## API Endpoints

### Authentication
- `GET /auth/login` - Redirect to Cognito
- `GET /auth/callback` - OAuth callback
- `POST /auth/logout` - Destroy session

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

### Items (similar patterns for Shelves, Containers, Items)
- Standard CRUD operations
- Hierarchy queries
- Move operations

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

### Phase 1: Foundation ✓
- [x] Project structure
- [ ] Auth flow (Cognito + Google + Session cookies)
- [ ] Basic CRUD for Rooms
- [ ] Database setup with migrations
- [ ] Type generation pipeline

### Phase 2: Core Hierarchy
- [ ] All entity types (Units, Shelves, Containers, Items)
- [ ] Audit logging
- [ ] Move operations
- [ ] Basic frontend with CRUD forms
- [ ] Photo upload

### Phase 3: Labels & QR
- [ ] Label generation service
- [ ] QR code generation
- [ ] PDF generation (Avery 5160 format)
- [ ] Label assignment flow
- [ ] Camera QR scanning

### Phase 4: Barcode & Search
- [ ] Barcode scanning
- [ ] Product lookup APIs
- [ ] Search implementation
- [ ] Tag system

### Phase 5: Polish
- [ ] Continuous QR scanning (AR-style)
- [ ] Performance optimization
- [ ] Comprehensive testing
- [ ] Documentation

## Configuration

### Environment Variables

**Backend:**
```bash
DATABASE_URL=postgresql://...           # Database connection
AWS_REGION=us-east-1                    # AWS region
COGNITO_USER_POOL_ID=us-east-1_xxx      # Cognito pool
COGNITO_CLIENT_ID=xxx                   # Cognito app client
COGNITO_DOMAIN=auth.yourdomain.com      # Cognito domain
SESSION_TABLE=sessions                  # DynamoDB table
PHOTOS_BUCKET=inventory-photos          # S3 bucket
FRONTEND_URL=https://app.yourdomain.com # For OAuth redirect
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
