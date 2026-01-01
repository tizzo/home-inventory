# Phase 2: Core Hierarchy - Detailed Work List

## Overview
Complete the hierarchical inventory system by implementing Shelves, Containers, and Items CRUD operations, hierarchy navigation, move operations, and audit logging.

**Estimated Total Time**: 3-4 days
**Current Progress**: 60% (Rooms ✓, Shelving Units ✓, Photos ✓)

---

## Task 1: Shelves CRUD (Backend)

### 1.1 Create Shelf Model
**File**: `backend/src/models/shelf.rs`
**Time**: 30 min

**Tasks**:
- [ ] Create `Shelf` struct with `#[typeshare]` annotation
  - Fields: `id`, `shelving_unit_id`, `name`, `description`, `position`, `label_id`, `created_at`, `updated_at`, `created_by`
- [ ] Create `ShelfResponse` struct (exclude `created_by`)
- [ ] Create `CreateShelfRequest` struct
  - Fields: `shelving_unit_id`, `name`, `description`, `position` (optional)
- [ ] Create `UpdateShelfRequest` struct
  - Fields: `name` (optional), `description` (optional), `position` (optional), `shelving_unit_id` (optional)
- [ ] Implement `From<Shelf> for ShelfResponse`
- [ ] Add `#[derive(FromRow, Serialize, Deserialize)]` to `Shelf`
- [ ] Export in `backend/src/models/mod.rs`

**Dependencies**: None
**Blocking**: Task 1.2

---

### 1.2 Create Shelf Routes
**File**: `backend/src/routes/shelves.rs`
**Time**: 1.5 hours

**Tasks**:
- [ ] Implement `list_shelves()` - GET `/api/shelves`
  - Query all shelves, order by `shelving_unit_id`, then `position`
- [ ] Implement `list_shelves_by_unit()` - GET `/api/units/:unit_id/shelves`
  - Filter by `shelving_unit_id`, order by `position`
- [ ] Implement `get_shelf()` - GET `/api/shelves/:id`
  - Return single shelf by ID
- [ ] Implement `create_shelf()` - POST `/api/shelves`
  - Validate `shelving_unit_id` exists
  - Auto-assign `position` if not provided (max position + 1)
  - Use hardcoded `user_id` for now (same as shelving_units)
- [ ] Implement `update_shelf()` - PUT `/api/shelves/:id`
  - Validate `shelving_unit_id` if provided
  - Update `position` if provided
- [ ] Implement `delete_shelf()` - DELETE `/api/shelves/:id`
  - Check for dependent containers/items (optional validation)
- [ ] Create `shelf_routes()` function
  - Routes: `/api/shelves`, `/api/shelves/:id`, `/api/units/:unit_id/shelves`
- [ ] Add routes to `backend/src/routes/mod.rs`
- [ ] Register routes in `backend/src/app.rs`

**Dependencies**: Task 1.1
**Blocking**: Task 1.3

---

### 1.3 Test Shelf Backend
**Time**: 30 min

**Tasks**:
- [ ] Test all endpoints with `curl` or Postman
- [ ] Verify position ordering works correctly
- [ ] Test validation (non-existent shelving_unit_id)
- [ ] Test position updates and reordering

**Dependencies**: Task 1.2

---

## Task 2: Shelves CRUD (Frontend)

### 2.1 Generate TypeScript Types
**Time**: 5 min

**Tasks**:
- [ ] Run `npm run generate-types` in frontend
- [ ] Verify `Shelf`, `ShelfResponse`, `CreateShelfRequest`, `UpdateShelfRequest` appear in `frontend/src/types/generated.ts`

**Dependencies**: Task 1.1

---

### 2.2 Create Shelves API Client
**File**: `frontend/src/api/shelves.ts`
**Time**: 30 min

**Tasks**:
- [ ] Create `shelvesApi` object with methods:
  - `getAll()` - GET `/api/shelves`
  - `getByUnit(unitId)` - GET `/api/units/:unit_id/shelves`
  - `getById(id)` - GET `/api/shelves/:id`
  - `create(data)` - POST `/api/shelves`
  - `update(id, data)` - PUT `/api/shelves/:id`
  - `delete(id)` - DELETE `/api/shelves/:id`
- [ ] Export from `frontend/src/api/index.ts`

**Dependencies**: Task 2.1

---

### 2.3 Create Shelves Hooks
**File**: `frontend/src/hooks/useShelves.ts`
**Time**: 30 min

**Tasks**:
- [ ] Create `useShelves()` - query all shelves
- [ ] Create `useShelvesByUnit(unitId)` - query shelves for a unit
- [ ] Create `useShelf(id)` - query single shelf
- [ ] Create `useCreateShelf()` - mutation
- [ ] Create `useUpdateShelf()` - mutation
- [ ] Create `useDeleteShelf()` - mutation
- [ ] Export from `frontend/src/hooks/index.ts`

**Dependencies**: Task 2.2

---

### 2.4 Create Shelves Page
**File**: `frontend/src/pages/ShelvesPage.tsx`
**Time**: 2 hours

**Tasks**:
- [ ] Create page component similar to `RoomsPage.tsx`
- [ ] Add route parameter for `unitId` (optional - show all or filtered)
- [ ] Display shelves in grid/list view
- [ ] Show parent unit name and room name (breadcrumb)
- [ ] Implement create modal
- [ ] Implement edit modal with deep linking (`/units/:unitId/shelves/:shelfId/edit`)
- [ ] Add position field (number input)
- [ ] Integrate `PhotoGallery` and `PhotoUpload` in edit modal
- [ ] Add delete confirmation
- [ ] Show position in shelf cards
- [ ] Add route to `frontend/src/App.tsx`
- [ ] Export from `frontend/src/pages/index.ts`

**Dependencies**: Task 2.3

---

### 2.5 Add Navigation to Shelves
**Time**: 30 min

**Tasks**:
- [ ] Add "Shelves" link to navbar (or make it contextual)
- [ ] Add link from Shelving Units page to view shelves
- [ ] Add breadcrumb navigation (Room → Unit → Shelves)

**Dependencies**: Task 2.4

---

## Task 3: Containers CRUD (Backend)

### 3.1 Create Container Model
**File**: `backend/src/models/container.rs`
**Time**: 45 min

**Tasks**:
- [ ] Create `Container` struct with `#[typeshare]` annotation
  - Fields: `id`, `shelf_id` (optional), `parent_container_id` (optional), `name`, `description`, `label_id`, `created_at`, `updated_at`, `created_by`
- [ ] Create `ContainerResponse` struct
- [ ] Create `CreateContainerRequest` struct
  - Fields: `shelf_id` (optional), `parent_container_id` (optional), `name`, `description`
  - Validation: exactly one of `shelf_id` or `parent_container_id` must be provided
- [ ] Create `UpdateContainerRequest` struct
  - Fields: `name` (optional), `description` (optional), `shelf_id` (optional), `parent_container_id` (optional)
  - Validation: can change location but must maintain constraint
- [ ] Implement `From<Container> for ContainerResponse`
- [ ] Export in `backend/src/models/mod.rs`

**Dependencies**: None
**Blocking**: Task 3.2

---

### 3.2 Create Container Routes
**File**: `backend/src/routes/containers.rs`
**Time**: 2 hours

**Tasks**:
- [ ] Implement `list_containers()` - GET `/api/containers`
  - Query all containers
- [ ] Implement `list_containers_by_shelf()` - GET `/api/shelves/:shelf_id/containers`
  - Filter by `shelf_id`, exclude nested containers
- [ ] Implement `list_containers_by_parent()` - GET `/api/containers/:parent_id/children`
  - Filter by `parent_container_id` (for nested containers)
- [ ] Implement `get_container()` - GET `/api/containers/:id`
- [ ] Implement `create_container()` - POST `/api/containers`
  - Validate location constraint (shelf_id XOR parent_container_id)
  - Validate shelf/parent exists
- [ ] Implement `update_container()` - PUT `/api/containers/:id`
  - Handle location changes (move between shelf/parent)
  - Validate new location exists
- [ ] Implement `delete_container()` - DELETE `/api/containers/:id`
  - Check for nested containers and items
  - Optionally cascade delete or prevent deletion
- [ ] Create `container_routes()` function
- [ ] Add routes to `backend/src/routes/mod.rs`
- [ ] Register routes in `backend/src/app.rs`

**Dependencies**: Task 3.1
**Blocking**: Task 3.3

---

### 3.3 Test Container Backend
**Time**: 30 min

**Tasks**:
- [ ] Test location constraint validation
- [ ] Test nested container creation
- [ ] Test moving containers between locations
- [ ] Test deletion with nested items

**Dependencies**: Task 3.2

---

## Task 4: Containers CRUD (Frontend)

### 4.1 Generate Types & Create API Client
**Time**: 20 min

**Tasks**:
- [ ] Run `npm run generate-types`
- [ ] Create `frontend/src/api/containers.ts`
- [ ] Create `frontend/src/hooks/useContainers.ts`
- [ ] Export from index files

**Dependencies**: Task 3.1

---

### 4.2 Create Containers Page
**File**: `frontend/src/pages/ContainersPage.tsx`
**Time**: 2.5 hours

**Tasks**:
- [ ] Create page component
- [ ] Handle two contexts: shelf-based or parent-container-based
- [ ] Display containers in grid view
- [ ] Show location context (shelf name or parent container name)
- [ ] Implement create modal with location selector
  - Radio buttons: "On Shelf" vs "Inside Container"
  - Show shelf selector or parent container selector based on choice
- [ ] Implement edit modal with location change capability
- [ ] Show nested containers count
- [ ] Add "View Contents" button to navigate into container
- [ ] Integrate photos
- [ ] Add route to `App.tsx`

**Dependencies**: Task 4.1

---

## Task 5: Items CRUD (Backend)

### 5.1 Create Item Model
**File**: `backend/src/models/item.rs`
**Time**: 45 min

**Tasks**:
- [ ] Create `Item` struct with `#[typeshare]` annotation
  - Fields: `id`, `shelf_id` (optional), `container_id` (optional), `name`, `description`, `barcode`, `barcode_type`, `label_id`, `created_at`, `updated_at`, `created_by`
- [ ] Create `ItemResponse` struct
- [ ] Create `CreateItemRequest` struct
  - Fields: `shelf_id` (optional), `container_id` (optional), `name`, `description`, `barcode` (optional), `barcode_type` (optional)
  - Validation: exactly one of `shelf_id` or `container_id` must be provided
- [ ] Create `UpdateItemRequest` struct
  - Fields: `name` (optional), `description` (optional), `shelf_id` (optional), `container_id` (optional), `barcode` (optional), `barcode_type` (optional)
- [ ] Implement `From<Item> for ItemResponse`
- [ ] Export in `backend/src/models/mod.rs`

**Dependencies**: None
**Blocking**: Task 5.2

---

### 5.2 Create Item Routes
**File**: `backend/src/routes/items.rs`
**Time**: 2 hours

**Tasks**:
- [ ] Implement `list_items()` - GET `/api/items`
  - Query all items
- [ ] Implement `list_items_by_shelf()` - GET `/api/shelves/:shelf_id/items`
- [ ] Implement `list_items_by_container()` - GET `/api/containers/:container_id/items`
- [ ] Implement `get_item()` - GET `/api/items/:id`
- [ ] Implement `get_item_by_barcode()` - GET `/api/items/barcode/:barcode`
  - Lookup item by barcode (for future barcode scanning)
- [ ] Implement `create_item()` - POST `/api/items`
  - Validate location constraint
  - Validate shelf/container exists
- [ ] Implement `update_item()` - PUT `/api/items/:id`
  - Handle location changes
- [ ] Implement `delete_item()` - DELETE `/api/items/:id`
- [ ] Create `item_routes()` function
- [ ] Add routes to `backend/src/routes/mod.rs`
- [ ] Register routes in `backend/src/app.rs`

**Dependencies**: Task 5.1
**Blocking**: Task 5.3

---

### 5.3 Test Item Backend
**Time**: 30 min

**Tasks**:
- [ ] Test location constraint
- [ ] Test barcode lookup
- [ ] Test moving items between locations

**Dependencies**: Task 5.2

---

## Task 6: Items CRUD (Frontend)

### 6.1 Generate Types & Create API Client
**Time**: 20 min

**Tasks**:
- [ ] Run `npm run generate-types`
- [ ] Create `frontend/src/api/items.ts`
- [ ] Create `frontend/src/hooks/useItems.ts`
- [ ] Export from index files

**Dependencies**: Task 5.1

---

### 6.2 Create Items Page
**File**: `frontend/src/pages/ItemsPage.tsx`
**Time**: 2.5 hours

**Tasks**:
- [ ] Create page component
- [ ] Handle shelf-based or container-based context
- [ ] Display items in list/table view
- [ ] Show barcode if present
- [ ] Implement create modal with location selector
- [ ] Implement edit modal
- [ ] Add barcode field (text input, for future scanning)
- [ ] Integrate photos
- [ ] Add route to `App.tsx`

**Dependencies**: Task 6.1

---

## Task 7: Hierarchy Navigation UI

### 7.1 Create Breadcrumb Component
**File**: `frontend/src/components/Breadcrumb.tsx`
**Time**: 1 hour

**Tasks**:
- [ ] Create reusable breadcrumb component
- [ ] Accept hierarchy path: `[{ name, url }, ...]`
- [ ] Style with separators (→ or /)
- [ ] Make links clickable
- [ ] Export from `frontend/src/components/index.ts`

**Dependencies**: None

---

### 7.2 Create Hierarchy Navigation Hook
**File**: `frontend/src/hooks/useHierarchy.ts`
**Time**: 1.5 hours

**Tasks**:
- [ ] Create hook to build hierarchy path
- [ ] Given an item ID, fetch full path: Room → Unit → Shelf → Container → Item
- [ ] Cache hierarchy data
- [ ] Handle loading states
- [ ] Support different entry points (start from room, unit, shelf, container, or item)

**Dependencies**: All entity hooks (useRooms, useShelvingUnits, useShelves, useContainers, useItems)

---

### 7.3 Integrate Breadcrumbs
**Time**: 1 hour

**Tasks**:
- [ ] Add breadcrumbs to ShelvesPage
- [ ] Add breadcrumbs to ContainersPage
- [ ] Add breadcrumbs to ItemsPage
- [ ] Show full path from room to current entity

**Dependencies**: Task 7.1, Task 7.2

---

### 7.4 Create Hierarchy View Page
**File**: `frontend/src/pages/HierarchyPage.tsx`
**Time**: 2 hours

**Tasks**:
- [ ] Create page showing full hierarchy tree
- [ ] Start from room selection
- [ ] Expandable tree view (Room → Units → Shelves → Containers → Items)
- [ ] Click to navigate to detail pages
- [ ] Show counts at each level
- [ ] Add route `/hierarchy` to `App.tsx`

**Dependencies**: All entity pages

---

## Task 8: Move Operations

### 8.1 Create Move Service (Backend)
**File**: `backend/src/services/move.rs`
**Time**: 2 hours

**Tasks**:
- [ ] Create `MoveService` struct
- [ ] Implement `move_shelf()` - move shelf to different unit
- [ ] Implement `move_container()` - move container to different shelf/parent
- [ ] Implement `move_item()` - move item to different shelf/container
- [ ] Validate target location exists
- [ ] Validate no circular references (containers)
- [ ] Update `position` for shelves when moving
- [ ] Export from `backend/src/services/mod.rs`

**Dependencies**: All entity routes exist

---

### 8.2 Create Move Routes
**Time**: 1 hour

**Tasks**:
- [ ] Add `POST /api/shelves/:id/move` - move shelf to new unit
- [ ] Add `POST /api/containers/:id/move` - move container to new location
- [ ] Add `POST /api/items/:id/move` - move item to new location
- [ ] Request body: `{ target_shelf_id?, target_container_id?, target_unit_id? }`
- [ ] Return updated entity

**Dependencies**: Task 8.1

---

### 8.3 Create Move UI
**Time**: 2 hours

**Tasks**:
- [ ] Add "Move" button to entity cards
- [ ] Create move modal component
- [ ] Show current location
- [ ] Show available target locations (filtered appropriately)
- [ ] Handle move operation
- [ ] Show success/error feedback
- [ ] Refresh data after move

**Dependencies**: Task 8.2

---

## Task 9: Audit Logging

### 9.1 Create Audit Service
**File**: `backend/src/services/audit.rs`
**Time**: 2 hours

**Tasks**:
- [ ] Create `AuditService` struct
- [ ] Implement `log_action()` method
  - Parameters: `entity_type`, `entity_id`, `action` (CREATE, UPDATE, DELETE, MOVE), `user_id`, `changes` (JSONB), `metadata` (JSONB)
- [ ] Create helper methods:
  - `log_create()`, `log_update()`, `log_delete()`, `log_move()`
- [ ] Store in `audit_logs` table
- [ ] Export from `backend/src/services/mod.rs`

**Dependencies**: None

---

### 9.2 Integrate Audit Logging
**Time**: 3 hours

**Tasks**:
- [ ] Add audit logging to all create operations
  - Rooms, Shelving Units, Shelves, Containers, Items
- [ ] Add audit logging to all update operations
  - Log changed fields in `changes` JSONB
- [ ] Add audit logging to all delete operations
- [ ] Add audit logging to move operations
- [ ] Use hardcoded user_id for now (will replace with auth later)

**Dependencies**: Task 9.1

---

### 9.3 Create Audit Log Routes
**File**: `backend/src/routes/audit.rs`
**Time**: 1.5 hours

**Tasks**:
- [ ] Implement `get_audit_logs()` - GET `/api/audit`
  - Query parameters: `entity_type?`, `entity_id?`, `user_id?`, `action?`, `limit?`, `offset?`
- [ ] Implement `get_audit_logs_by_entity()` - GET `/api/audit/entity/:type/:id`
  - Get all logs for a specific entity
- [ ] Create `audit_routes()` function
- [ ] Add routes to `backend/src/routes/mod.rs`
- [ ] Register routes in `backend/src/app.rs`

**Dependencies**: Task 9.1

---

### 9.4 Create Audit Log UI
**File**: `frontend/src/pages/AuditLogPage.tsx`
**Time**: 2 hours

**Tasks**:
- [ ] Create page to view audit logs
- [ ] Add filters (entity type, entity ID, user, action, date range)
- [ ] Display logs in table format
- [ ] Show formatted changes (before/after)
- [ ] Add pagination
- [ ] Add route `/audit` to `App.tsx`
- [ ] Add link from entity detail pages to view audit history

**Dependencies**: Task 9.3

---

## Task 10: Integration & Testing

### 10.1 End-to-End Testing
**Time**: 2 hours

**Tasks**:
- [ ] Test full hierarchy: Create Room → Unit → Shelf → Container → Item
- [ ] Test moving entities at each level
- [ ] Test photo upload for all entity types
- [ ] Test audit logging appears for all operations
- [ ] Test breadcrumb navigation works correctly
- [ ] Test deep linking for all entity types

**Dependencies**: All previous tasks

---

### 10.2 UI Polish
**Time**: 1 hour

**Tasks**:
- [ ] Ensure consistent styling across all entity pages
- [ ] Add loading states
- [ ] Add error handling
- [ ] Add empty states
- [ ] Verify mobile responsiveness

**Dependencies**: All previous tasks

---

## Summary

### Backend Tasks (Estimated: 12-14 hours)
1. Shelves model & routes (2.5 hours)
2. Containers model & routes (3 hours)
3. Items model & routes (3 hours)
4. Move operations (3 hours)
5. Audit logging (6.5 hours)

### Frontend Tasks (Estimated: 14-16 hours)
1. Shelves UI (3.5 hours)
2. Containers UI (3 hours)
3. Items UI (3 hours)
4. Hierarchy navigation (5.5 hours)
5. Move UI (2 hours)
6. Audit log UI (2 hours)

### Testing & Integration (Estimated: 3 hours)
1. End-to-end testing (2 hours)
2. UI polish (1 hour)

**Total Estimated Time**: 29-33 hours (~4 days)

---

## Dependencies Graph

```
Task 1 (Shelves Backend)
  └─> Task 2 (Shelves Frontend)
      └─> Task 7 (Hierarchy Navigation)

Task 3 (Containers Backend)
  └─> Task 4 (Containers Frontend)
      └─> Task 7 (Hierarchy Navigation)

Task 5 (Items Backend)
  └─> Task 6 (Items Frontend)
      └─> Task 7 (Hierarchy Navigation)

Task 7 (Hierarchy Navigation)
  └─> Task 8 (Move Operations)
      └─> Task 9 (Audit Logging)
          └─> Task 10 (Integration)
```

**Recommended Order**:
1. Shelves (Tasks 1-2)
2. Containers (Tasks 3-4)
3. Items (Tasks 5-6)
4. Hierarchy Navigation (Task 7)
5. Move Operations (Task 8)
6. Audit Logging (Task 9)
7. Integration (Task 10)

---

## Notes

- All database tables already exist, so focus is on routes and UI
- Photo system is reusable - just pass different `entityType` and `entityId`
- Label assignment can be added later (infrastructure exists)
- User ID is hardcoded for now - will be replaced when auth is implemented
- Position field for shelves should auto-increment if not provided
- Container nesting requires careful validation to prevent cycles
