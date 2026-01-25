# Home Inventory System - TODO

**Last Updated**: December 2024

## 🎯 High Priority

### Tag Management UI
**Status**: Backend ready, frontend needed  
**Effort**: 1-2 days

- [ ] Create TagsPage for CRUD operations on tags
- [ ] Add tag selector component for assigning tags to entities
- [ ] Add tag filtering to entity list pages
- [ ] Display tags on entity cards
- [ ] Bulk tag operations (assign/remove tags from multiple entities)

**Why**: Tags are already in the database and AI proposes them, but users can't manage them yet.

---

### Search & Filtering
**Status**: Not started  
**Effort**: 2-3 days

- [ ] Implement PostgreSQL full-text search
  - Add `tsvector` columns to entities
  - Create search indexes
  - Add search API endpoint
- [ ] Create SearchPage with unified search across all entities
- [ ] Add search bar to navbar
- [ ] Filter by tags
- [ ] Filter by date ranges
- [ ] Advanced filters (by room, unit, shelf, container)

**Why**: Essential for finding items in large inventories.

---

### Component Refactoring
**Status**: Partially complete
**Effort**: 1 day

From [docs/REFACTORING.md](./docs/REFACTORING.md):

- [ ] Replace move modals in ItemsPage with `MoveModal` component
- [ ] Replace move modals in ContainersPage with `MoveModal` component  
- [ ] Replace move modals in ShelvingUnitsPage with `MoveModal` component
- [ ] Replace create modals with `EntityCreateModal` for consistency
  - [ ] ShelvesPage
  - [ ] ContainersPage
  - [ ] ItemsPage

**Why**: Code reduction (~60%), consistent UX, QR scanning everywhere.

---

## 📱 Features

### Barcode Scanning
**Status**: Field exists, scanning not implemented  
**Effort**: 2-3 days

- [ ] Integrate barcode scanning library (e.g., `@zxing/library`)
- [ ] Add camera-based barcode scanning to ItemsPage
- [ ] Implement product lookup API integration
  - [ ] Research APIs (Open Product Data, UPC Database)
  - [ ] Create product cache table usage
  - [ ] Auto-populate item details from barcode
- [ ] Add barcode to item search

**Why**: Faster item entry, accurate product information.

---

### Batch Operations
**Status**: Not started  
**Effort**: 2-3 days

- [ ] Bulk delete (select multiple entities, delete all)
- [ ] Bulk move (select multiple items, move to new location)
- [ ] Bulk label assignment (assign labels to multiple entities)
- [ ] Bulk tag operations (add/remove tags from multiple entities)
- [ ] Export selected entities to CSV/JSON
- [ ] Import from CSV/JSON

**Why**: Efficiency when managing large inventories.

---

### Reports & Analytics
**Status**: Not started  
**Effort**: 2-3 days

- [ ] Inventory summary dashboard
  - Total items count
  - Items by room/unit/shelf
  - Items by tag
  - Recently added items
  - Items without photos
  - Items without labels
- [ ] Export reports to PDF/CSV
- [ ] Inventory value tracking (if prices added)
- [ ] Usage analytics (most accessed items, etc.)

**Why**: Insights into inventory organization and usage.

---

## 🎨 UI/UX Improvements

### Loading States
**Status**: Basic "Loading..." text only  
**Effort**: 1 day

- [ ] Replace "Loading..." text with skeleton loaders
- [ ] Add loading spinners for buttons during async operations
- [ ] Add progress indicators for photo uploads
- [ ] Add optimistic updates for better perceived performance

---

### Error Handling
**Status**: Basic alerts only  
**Effort**: 1 day

- [ ] Add error boundaries in React
- [ ] Better error messages (user-friendly, not technical)
- [ ] Retry mechanisms for failed operations
- [ ] Offline detection and messaging
- [ ] Form validation improvements (React Hook Form + Zod)

---

### Mobile Responsiveness
**Status**: Partially responsive  
**Effort**: 2 days

- [ ] Test and fix mobile layouts
- [ ] Touch-friendly buttons and interactions
- [ ] Mobile-optimized photo upload
- [ ] Mobile-optimized QR scanning
- [ ] Responsive tables (convert to cards on mobile)
- [ ] Mobile navigation improvements

---

### Accessibility
**Status**: Basic support  
**Effort**: 2 days

- [ ] Keyboard navigation for all interactions
- [ ] Screen reader support (ARIA labels)
- [ ] Focus management in modals
- [ ] Color contrast improvements
- [ ] Keyboard shortcuts documentation

---

### Visual Enhancements
**Status**: Basic styling  
**Effort**: 2-3 days

- [ ] Dark mode support
- [ ] Empty states with helpful messages and illustrations
- [ ] Drag-and-drop photo reordering
- [ ] Animations and transitions polish
- [ ] Icon improvements (use Lucide or similar)
- [ ] Better photo gallery (lightbox, zoom, carousel)

---

## 🧪 Testing

### Backend Testing
**Status**: 0% coverage  
**Effort**: 3-4 days

- [ ] Unit tests for route handlers
- [ ] Unit tests for services (audit, move, etc.)
- [ ] Integration tests for CRUD operations
- [ ] Test authentication flows
- [ ] Test move operations and validation
- [ ] Test audit logging

---

### Frontend Testing
**Status**: 0% coverage  
**Effort**: 3-4 days

- [ ] Component tests (React Testing Library)
- [ ] Hook tests
- [ ] Integration tests for pages
- [ ] E2E tests for critical flows (Playwright)
  - Create/edit/delete entities
  - Photo upload flow
  - Label generation and assignment
  - QR code scanning
  - Item import draft flow

---

## 📚 Documentation

### API Documentation
**Status**: Not started  
**Effort**: 2 days

- [ ] Generate OpenAPI/Swagger documentation
- [ ] Document all endpoints
- [ ] Add request/response examples
- [ ] Document authentication
- [ ] Document error codes

---

### User Documentation
**Status**: Minimal README only  
**Effort**: 2-3 days

- [ ] User guide (how to use the system)
- [ ] Setup guide for new users
- [ ] Best practices for organizing inventory
- [ ] Troubleshooting guide
- [ ] FAQ

---

### Developer Documentation
**Status**: Basic setup docs  
**Effort**: 2 days

- [ ] Architecture overview with diagrams
- [ ] Component documentation
- [ ] Database schema documentation
- [ ] Deployment guide (AWS Lambda)
- [ ] Contributing guide
- [ ] Code style guide

---

## 🔧 Technical Debt

### Code Quality
**Status**: Good, but can improve  
**Effort**: Ongoing

- [ ] Add comprehensive error handling
- [ ] Add input validation on backend (currently minimal)
- [ ] Add rate limiting to API
- [ ] Add request logging and monitoring
- [ ] Set up observability (metrics, traces)
- [ ] Security audit
- [ ] Performance optimization
- [ ] Code review and refactoring

---

### Infrastructure
**Status**: Local dev only  
**Effort**: 3-4 days

- [ ] Production deployment setup
- [ ] CI/CD pipeline
- [ ] Automated testing in CI
- [ ] Database backups
- [ ] Monitoring and alerting
- [ ] CDN for static assets
- [ ] Database connection pooling optimization

---

## 💡 Future Ideas

### Advanced Features
- [ ] Multi-tenant support (multiple users/organizations)
- [ ] Permissions and roles (admin, viewer, editor)
- [ ] Item check-in/check-out system
- [ ] Expiration date tracking
- [ ] Warranty tracking
- [ ] Purchase history
- [ ] Item location history (track moves over time)
- [ ] Notifications (low stock, expiring items, etc.)
- [ ] Integration with shopping lists
- [ ] Mobile app (React Native)
- [ ] Offline support with sync
- [ ] AR view (point camera, see item info overlay)
- [ ] Voice commands
- [ ] Smart home integration

### AI Enhancements
- [ ] Better item recognition from photos
- [ ] Automatic categorization
- [ ] Duplicate detection
- [ ] Smart suggestions (where to store items)
- [ ] Natural language search
- [ ] Automatic tag generation from descriptions

---

## 📋 Quick Wins (Can Do Anytime)

These are small improvements that can be done independently:

- [ ] Add confirmation dialogs for all destructive actions
- [ ] Add toast notifications instead of alerts
- [ ] Add "Last updated" timestamps to entity cards
- [ ] Add entity counts to navigation (e.g., "Rooms (5)")
- [ ] Add sorting options to list pages
- [ ] Add "View all" links from limited lists
- [ ] Add breadcrumb navigation to all pages
- [ ] Add "Back to top" button on long pages
- [ ] Add keyboard shortcut hints (tooltips)
- [ ] Add "Copy to clipboard" for entity IDs
- [ ] Add "Duplicate" action for entities
- [ ] Add recent items/activity feed
- [ ] Add favorites/bookmarks for frequently accessed items

---

## 🎓 Learning Opportunities

These are features that would be great for learning new technologies:

- [ ] GraphQL API (alternative to REST)
- [ ] WebSockets for real-time updates
- [ ] Server-Sent Events for notifications
- [ ] Redis caching
- [ ] Elasticsearch for advanced search
- [ ] Message queue (for async operations)
- [ ] Microservices architecture
- [ ] Kubernetes deployment
- [ ] Machine learning for image recognition

---

## Notes

- All database tables already exist
- Photo system is fully functional and reusable
- Label system is complete except for advanced features
- Frontend architecture is solid and ready to scale
- Authentication is working with Google OAuth
- Audit logging is complete with user tracking
- AI-powered item import is functional

**Current Focus**: Tag management UI, search implementation, and component refactoring are the highest priorities for immediate user value.
