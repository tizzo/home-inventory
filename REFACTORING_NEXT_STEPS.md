# Refactoring Next Steps: Component Composition

## What Was Accomplished

### 1. Bug Fixes
- ✅ Fixed shelf creation error (`UnexpectedNullError` when MAX(position) returns NULL)
- Changed `fetch_optional` to `fetch_one` in `backend/src/routes/shelves.rs:140`

### 2. New Features
- ✅ Added move functionality for shelving units
  - Backend: `POST /api/units/:id/move`
  - Frontend: Move button + modal in ShelvingUnitsPage

### 3. Reusable Components Created
Created 3 new composable components to eliminate code duplication:

#### EntityField (`src/components/EntityField.tsx`)
Form field wrapper for EntitySelector with consistent styling and QR scanning support.

#### MoveModal (`src/components/MoveModal.tsx`)
Generic modal for moving entities between locations with fuzzy search + QR scanning.

#### EntityCreateModal (`src/components/EntityCreateModal.tsx`)
Generic modal for creating entities with optional parent selection.

### 4. Example Implementation
- ✅ Refactored ShelvesPage move modal (reduced ~60 lines to ~10)

---

## What Needs To Be Done

### Status: Partially Complete
- ✅ ShelvesPage - Already refactored (reference implementation)
- ⏳ ItemsPage - Needs refactoring
- ⏳ ContainersPage - Needs refactoring
- ⏳ ShelvingUnitsPage - Needs refactoring

### Phase 1: Replace All Move Modals

Replace existing move modals with the new `MoveModal` component. Each replacement should:
1. Import `MoveModal` from components
2. Remove manual modal JSX
3. Remove state variable for `moveTarget*` (no longer needed)
4. Simplify `handleMove` function to just accept `targetId: string`
5. Pass appropriate `targetEntityType` to MoveModal

#### Files to Update:

**ItemsPage.tsx** (Lines ~689-800)
- Current: Manual modal with dropdown for shelf/container selection
- Replace with: `MoveModal` with conditional `targetEntityType` based on `moveLocationType`
- Target entities: `shelf` or `container`
```tsx
// Before: ~100 lines of modal JSX
// After:
<MoveModal
  isOpen={!!moveModalItem}
  onClose={() => setMoveModalItem(null)}
  title="Move Item"
  entityName={moveModalItem?.name || ''}
  targetEntityType={moveLocationType === 'shelf' ? 'shelf' : 'container'}
  targetLabel={moveLocationType === 'shelf' ? 'Target Shelf' : 'Target Container'}
  onMove={handleMove}
  isPending={moveItem.isPending}
/>
```

**ContainersPage.tsx** (Lines ~614-720)
- Current: Manual modal with dropdown for shelf/parent container
- Replace with: `MoveModal` with conditional `targetEntityType`
- Target entities: `shelf` or `container` (parent)
```tsx
<MoveModal
  isOpen={!!moveModalContainer}
  onClose={() => setMoveModalContainer(null)}
  title="Move Container"
  entityName={moveModalContainer?.name || ''}
  targetEntityType={moveLocationType === 'shelf' ? 'shelf' : 'container'}
  targetLabel={moveLocationType === 'shelf' ? 'Target Shelf' : 'Parent Container'}
  onMove={handleMove}
  isPending={moveContainer.isPending}
/>
```

**ShelvingUnitsPage.tsx** (Lines ~431-489)
- Current: Manual modal with dropdown for room selection (just added)
- Replace with: `MoveModal`
- Target entity: `room`
```tsx
<MoveModal
  isOpen={!!moveModalUnit}
  onClose={() => setMoveModalUnit(null)}
  title="Move Shelving Unit"
  entityName={moveModalUnit?.name || ''}
  targetEntityType="room"
  targetLabel="Target Room"
  onMove={handleMove}
  isPending={moveUnit.isPending}
/>
```

**ShelvesPage.tsx**
- ✅ Already done! Use as reference implementation
- Location: Lines ~488-500

---

### Phase 2: Replace Create Modals with EntityCreateModal

**Status**: Not started

Replace manual create modals with `EntityCreateModal` to add QR scanning support and reduce code duplication.

#### ShelvesPage.tsx Create Modal (Lines ~280-380)
```tsx
// Replace with:
<EntityCreateModal
  isOpen={showCreateModal}
  onClose={closeCreateModal}
  title="Create New Shelf"
  parentEntityType={unitId ? undefined : "unit"}
  parentEntityLabel={unitId ? undefined : "Shelving Unit"}
  parentEntityId={unitId}
  fields={[
    { name: 'name', label: 'Shelf Name', type: 'text', required: true, placeholder: 'e.g., Top Shelf, Middle Shelf' },
    { name: 'description', label: 'Description', type: 'textarea', placeholder: 'Optional description' },
    { name: 'position', label: 'Position', type: 'number', placeholder: 'Optional shelf number' },
  ]}
  onSubmit={(data) => createShelf.mutateAsync({
    shelving_unit_id: data.unit_id || unitId,
    name: data.name,
    description: data.description,
    position: data.position ? parseInt(data.position) : undefined,
  })}
  isPending={createShelf.isPending}
/>
```

#### ContainersPage.tsx Create Modal (Lines ~465-580)
```tsx
<EntityCreateModal
  isOpen={showCreateModal}
  onClose={closeCreateModal}
  title="Create New Container"
  parentEntityType={shelfId ? "shelf" : parentId ? "container" : undefined}
  parentEntityLabel={shelfId ? "Shelf" : parentId ? "Parent Container" : undefined}
  parentEntityId={shelfId || parentId}
  fields={[
    { name: 'name', label: 'Container Name', type: 'text', required: true, placeholder: 'e.g., Storage Box, Drawer' },
    { name: 'description', label: 'Description', type: 'textarea', placeholder: 'Optional description' },
  ]}
  onSubmit={(data) => createContainer.mutateAsync({
    shelf_id: data.shelf_id || shelfId,
    parent_container_id: data.container_id || parentId,
    name: data.name,
    description: data.description,
  })}
  isPending={createContainer.isPending}
/>
```

#### ItemsPage.tsx Create Modal (Lines ~573-660)
```tsx
<EntityCreateModal
  isOpen={showCreateModal}
  onClose={closeCreateModal}
  title="Create New Item"
  parentEntityType={shelfId ? "shelf" : containerId ? "container" : undefined}
  parentEntityLabel={shelfId ? "Shelf" : containerId ? "Container" : undefined}
  parentEntityId={shelfId || containerId}
  fields={[
    { name: 'name', label: 'Item Name', type: 'text', required: true, placeholder: 'e.g., Laptop, Book' },
    { name: 'description', label: 'Description', type: 'textarea', placeholder: 'Optional description' },
    { name: 'barcode', label: 'Barcode', type: 'text', placeholder: 'Optional barcode' },
    { name: 'barcode_type', label: 'Barcode Type', type: 'text', placeholder: 'e.g., UPC, EAN' },
  ]}
  onSubmit={(data) => createItem.mutateAsync({
    shelf_id: data.shelf_id || shelfId,
    container_id: data.container_id || containerId,
    name: data.name,
    description: data.description,
    barcode: data.barcode,
    barcode_type: data.barcode_type,
  })}
  isPending={createItem.isPending}
/>
```

#### ShelvingUnitsPage.tsx Create Modal (Lines ~280-350)
- Note: This one doesn't need a parent selector (just room dropdown)
- Consider creating a simpler variant or using regular Modal
- Alternative: Use `EntityField` directly in the existing modal

#### RoomsPage.tsx Create Modal
- Simple form, no parent - keep as is OR use EntityCreateModal without parent

---

### Phase 3: Replace Edit Modals (Optional)

**Status**: Not planned

Edit modals could potentially use EntityCreateModal with pre-filled values, but may be better left as manual modals since:
- They need to load existing data
- Parent entity shouldn't change via edit (use Move instead)
- Simpler to keep existing implementation
- Current implementation works well

**Recommendation**: Leave edit modals as-is. Focus on move and create modals first.

---

## Testing Checklist

After each refactoring, verify:

### For Move Modals:
- [ ] Move button appears on entity cards
- [ ] Clicking Move opens modal with entity selector
- [ ] Fuzzy search works (type to filter)
- [ ] QR scan button appears and opens camera
- [ ] Scanning QR code selects the target entity
- [ ] Move operation succeeds and shows success message
- [ ] Entity list refreshes after move
- [ ] Cancel button closes modal without changes

### For Create Modals:
- [ ] Add button opens create modal
- [ ] Parent entity selector appears (when not on specific parent page)
- [ ] Fuzzy search works in parent selector
- [ ] QR scan works to select parent
- [ ] Form validation works (required fields)
- [ ] Create operation succeeds
- [ ] New entity appears in list
- [ ] Modal closes after successful creation

---

## Code Patterns

### Before (Manual Modal):
```tsx
// State
const [moveModalItem, setMoveModalItem] = useState<ItemResponse | null>(null);
const [moveTargetShelf, setMoveTargetShelf] = useState<string>('');

// Handler
const handleMove = async (item: ItemResponse) => {
  if (!moveTargetShelf) {
    alert('Please select a target shelf');
    return;
  }
  await moveItem.mutateAsync({
    itemId: item.id,
    data: { target_shelf_id: moveTargetShelf }
  });
  setMoveModalItem(null);
  setMoveTargetShelf('');
};

// JSX (~60 lines)
<Modal isOpen={!!moveModalItem} onClose={...}>
  <form onSubmit={...}>
    <select value={moveTargetShelf} onChange={...}>
      {/* Render options */}
    </select>
    <button type="submit">Move</button>
  </form>
</Modal>
```

### After (MoveModal Component):
```tsx
// State (simplified)
const [moveModalItem, setMoveModalItem] = useState<ItemResponse | null>(null);

// Handler (simplified)
const handleMove = async (targetId: string) => {
  if (!moveModalItem) return;
  await moveItem.mutateAsync({
    itemId: moveModalItem.id,
    data: { target_shelf_id: targetId }
  });
};

// JSX (~10 lines)
<MoveModal
  isOpen={!!moveModalItem}
  onClose={() => setMoveModalItem(null)}
  title="Move Item"
  entityName={moveModalItem?.name || ''}
  targetEntityType="shelf"
  targetLabel="Target Shelf"
  onMove={handleMove}
  isPending={moveItem.isPending}
/>
```

---

## Benefits of This Refactoring

1. **Code Reduction**: ~60% less code per modal
2. **QR Scanning**: All modals get QR scanning automatically
3. **Fuzzy Search**: All dropdowns become searchable
4. **Consistency**: All modals look and behave the same
5. **Maintainability**: Fix once, fixes everywhere
6. **Type Safety**: Strongly typed entity types

---

## Future Enhancements

Consider adding these components later:

1. **EntityEditModal**: For edit operations with pre-filled data
2. **EntityFilterField**: For filtering lists with EntitySelector
3. **BulkMoveModal**: Move multiple entities at once
4. **LocationBreadcrumb**: Show full location path with QR scan support

---

## Notes

- All new components are exported from `src/components/index.ts`
- EntitySelector supports all entity types: `room`, `unit`, `shelf`, `container`, `item`
- The camera auto-starts when EntitySelector dropdown opens (can be disabled)
- QR codes scan the label URL format: `{base_url}/l/{label_id}`
- Components handle errors and loading states internally

---

## Questions?

If you run into issues:
1. Check `src/pages/ShelvesPage.tsx` (lines 488-500) for reference implementation
2. Verify component imports from `src/components`
3. Ensure EntitySelector is working in LabelDetailPage first
4. Test QR scanning separately before integration
