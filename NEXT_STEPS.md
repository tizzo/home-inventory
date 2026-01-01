# Next Steps & Development Roadmap

## Current Status Summary

### ✅ Completed Features
- **Foundation**: Project structure, database migrations, type generation
- **Rooms**: Full CRUD (backend + frontend) with modal-based editing
- **Shelving Units**: Full CRUD (backend + frontend)
- **Photos**: Upload, display, delete with S3/MinIO integration
- **Labels**: Generation, PDF export (Avery 18660), assignment
- **Frontend**: React Router, deep linking, modern UI with photo previews

### 🚧 Partially Complete
- **Database Schema**: All tables exist (Shelves, Containers, Items) but no API routes yet
- **Audit Logging**: Table exists but not implemented in application code

### ❌ Not Started
- Authentication (Cognito + Google OAuth)
- Shelves, Containers, Items CRUD
- Move operations
- QR code scanning
- Barcode scanning
- Search functionality
- Tag system

## Recommended Next Steps (Priority Order)

### 1. Complete Core Hierarchy (Phase 2)
**Why**: Foundation for the entire inventory system. Users need to organize items hierarchically.

**Tasks**:
- [ ] Implement Shelves CRUD (backend routes + frontend)
- [ ] Implement Containers CRUD (backend routes + frontend)
- [ ] Implement Items CRUD (backend routes + frontend)
- [ ] Add hierarchy navigation UI (Room → Unit → Shelf → Container → Item)
- [ ] Implement move operations (change parent/container)

**Estimated Effort**: 2-3 days

**Benefits**:
- Complete the core data model
- Enable full inventory organization
- Foundation for search and scanning features

### 2. Implement Audit Logging (Phase 2)
**Why**: Track all changes for accountability and debugging.

**Tasks**:
- [ ] Create audit service to log all CRUD operations
- [ ] Add audit logging to all route handlers
- [ ] Create audit log viewing UI
- [ ] Add filters (by user, entity, date range)

**Estimated Effort**: 1 day

**Benefits**:
- Complete change history
- Debugging and troubleshooting
- User accountability

### 3. QR Code Scanning (Phase 3)
**Why**: Core feature for label-based organization. Users need to scan printed labels.

**Tasks**:
- [ ] Add camera access to frontend
- [ ] Implement QR code scanning library (e.g., `html5-qrcode` or `@zxing/library`)
- [ ] Create scan page/component
- [ ] Handle scanned QR codes (lookup label, navigate to entity)
- [ ] Add scan button to navigation

**Estimated Effort**: 1-2 days

**Benefits**:
- Complete the label workflow (generate → print → scan → assign)
- Mobile-first scanning experience
- Foundation for AR-style continuous scanning

### 4. Authentication (Phase 1)
**Why**: Required for production. Currently no user context.

**Tasks**:
- [ ] Set up AWS Cognito User Pool
- [ ] Configure Google OAuth provider
- [ ] Implement session management (DynamoDB or database)
- [ ] Add auth routes (`/auth/login`, `/auth/callback`, `/auth/logout`)
- [ ] Add auth middleware to protect routes
- [ ] Update frontend with login/logout UI
- [ ] Add user context to all operations

**Estimated Effort**: 2-3 days

**Benefits**:
- Multi-user support
- Secure access
- User-specific data
- Production-ready

### 5. Search & Tags (Phase 4)
**Why**: Essential for finding items in large inventories.

**Tasks**:
- [ ] Implement full-text search (PostgreSQL `tsvector` or similar)
- [ ] Create search API endpoint
- [ ] Build search UI with filters
- [ ] Implement tag system (CRUD for tags, assign to entities)
- [ ] Add tag filtering to search

**Estimated Effort**: 2-3 days

**Benefits**:
- Find items quickly
- Organize by categories
- Better UX for large inventories

### 6. Barcode Scanning (Phase 4)
**Why**: Auto-populate product information from barcodes.

**Tasks**:
- [ ] Integrate barcode scanning (camera-based)
- [ ] Add product lookup API integration (e.g., Open Product Data)
- [ ] Create product cache table (already exists in schema)
- [ ] Auto-populate item details from barcode scan
- [ ] Add barcode field to items

**Estimated Effort**: 2-3 days

**Benefits**:
- Faster item entry
- Accurate product information
- Better inventory tracking

## Quick Wins (Can Do Anytime)

### Immediate Improvements
- [ ] Add loading skeletons instead of "Loading..." text
- [ ] Add error boundaries in React
- [ ] Improve form validation (React Hook Form + Zod)
- [ ] Add confirmation dialogs for destructive actions
- [ ] Add toast notifications instead of alerts
- [ ] Implement optimistic updates for better UX

### UI/UX Enhancements
- [ ] Add empty states with helpful messages
- [ ] Add keyboard shortcuts
- [ ] Improve mobile responsiveness
- [ ] Add drag-and-drop for photo reordering
- [ ] Add bulk operations (delete multiple, assign multiple labels)

## Technical Debt

### Code Quality
- [ ] Add comprehensive error handling
- [ ] Add input validation on backend
- [ ] Add rate limiting
- [ ] Add request logging
- [ ] Set up monitoring/observability

### Testing
- [ ] Add unit tests for backend routes
- [ ] Add integration tests
- [ ] Add frontend component tests
- [ ] Add E2E tests for critical flows

### Documentation
- [ ] API documentation (OpenAPI/Swagger)
- [ ] Component documentation
- [ ] Deployment guide
- [ ] Architecture diagrams

## Recommended Priority Order

1. **Complete Core Hierarchy** (Shelves, Containers, Items) - Most critical for MVP
2. **QR Code Scanning** - Completes the label workflow
3. **Authentication** - Required for production
4. **Search & Tags** - Essential for usability
5. **Barcode Scanning** - Nice-to-have enhancement
6. **Audit Logging** - Important but can be added incrementally

## Notes

- All database tables already exist, so implementation is primarily about adding routes and UI
- Photo system is fully functional and can be reused for all entity types
- Label system is complete except for scanning
- Frontend architecture is solid and ready to scale
