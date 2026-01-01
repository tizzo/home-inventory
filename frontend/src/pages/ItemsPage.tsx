import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  useItems,
  useItemsByShelf,
  useItemsByContainer,
  useCreateItem,
  useUpdateItem,
  useDeleteItem,
  useMoveItem,
  useShelf,
  useContainer,
  useShelves,
  useContainers,
  useShelvingUnit,
  useRoom,
  usePhotos,
} from '../hooks';
import { Modal, PhotoUpload, PhotoGallery } from '../components';
import type {
  CreateItemRequest,
  UpdateItemRequest,
  ItemResponse,
  ShelfResponse,
  ContainerResponse,
} from '../types/generated';

export default function ItemsPage() {
  const navigate = useNavigate();
  const { shelfId, containerId, itemId } = useParams<{
    shelfId?: string;
    containerId?: string;
    itemId?: string;
  }>();

  // Determine context and fetch appropriate data
  const context = shelfId ? 'shelf' : containerId ? 'container' : 'all';
  const { data: allItems, isLoading: isLoadingAll } = useItems();
  const { data: shelfItems, isLoading: isLoadingShelf } = useItemsByShelf(
    shelfId || ''
  );
  const { data: containerItems, isLoading: isLoadingContainer } =
    useItemsByContainer(containerId || '');

  const items =
    context === 'shelf'
      ? shelfItems
      : context === 'container'
        ? containerItems
        : allItems;
  const isLoading =
    context === 'shelf'
      ? isLoadingShelf
      : context === 'container'
        ? isLoadingContainer
        : isLoadingAll;

  // Fetch context data for breadcrumbs
  const { data: shelf } = useShelf(shelfId || '');
  const { data: container } = useContainer(containerId || '');
  const { data: unit } = useShelvingUnit(shelf?.shelving_unit_id || '');
  const { data: room } = useRoom(unit?.room_id || '');
  const { data: allShelves } = useShelves();
  const { data: allContainers } = useContainers();

  const createItem = useCreateItem();
  const updateItem = useUpdateItem();
  const deleteItem = useDeleteItem();
  const moveItem = useMoveItem();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [moveModalItem, setMoveModalItem] = useState<ItemResponse | null>(null);
  const [moveLocationType, setMoveLocationType] = useState<'shelf' | 'container'>('shelf');
  const [moveTargetShelf, setMoveTargetShelf] = useState<string>('');
  const [moveTargetContainer, setMoveTargetContainer] = useState<string>('');

  const [locationType, setLocationType] = useState<'shelf' | 'container'>(
    shelfId ? 'shelf' : 'container'
  );
  const [createFormData, setCreateFormData] = useState<CreateItemRequest>({
    shelf_id: shelfId,
    container_id: containerId,
    name: '',
    description: '',
    barcode: '',
    barcode_type: '',
  });
  const [editFormData, setEditFormData] = useState<UpdateItemRequest>({
    name: '',
    description: '',
    barcode: '',
    barcode_type: '',
  });

  // Update create form when context changes
  useEffect(() => {
    if (shelfId) {
      setLocationType('shelf');
      setCreateFormData((prev) => ({
        ...prev,
        shelf_id: shelfId,
        container_id: undefined,
      }));
    } else if (containerId) {
      setLocationType('container');
      setCreateFormData((prev) => ({
        ...prev,
        shelf_id: undefined,
        container_id: containerId,
      }));
    }
  }, [shelfId, containerId]);

  // Get the item being edited from URL
  const editingItem = items?.find((i) => i.id === itemId);

  // Handle URL-based edit modal
  useEffect(() => {
    if (itemId && editingItem) {
      setEditFormData({
        name: editingItem.name,
        description: editingItem.description || '',
        barcode: editingItem.barcode || '',
        barcode_type: editingItem.barcode_type || '',
      });
    }
  }, [itemId, editingItem]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    // Validate location constraint
    if (
      (!createFormData.shelf_id && !createFormData.container_id) ||
      (createFormData.shelf_id && createFormData.container_id)
    ) {
      alert('Please select either a shelf or a container (not both)');
      return;
    }
    try {
      await createItem.mutateAsync({
        ...createFormData,
        barcode: createFormData.barcode || undefined,
        barcode_type: createFormData.barcode_type || undefined,
      });
      setCreateFormData({
        shelf_id: shelfId,
        container_id: containerId,
        name: '',
        description: '',
        barcode: '',
        barcode_type: '',
      });
      setShowCreateModal(false);
    } catch (err) {
      console.error('Failed to create item:', err);
      alert('Failed to create item. Please try again.');
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemId) return;

    try {
      await updateItem.mutateAsync({
        id: itemId,
        data: {
          ...editFormData,
          barcode: editFormData.barcode || undefined,
          barcode_type: editFormData.barcode_type || undefined,
        },
      });
      setEditFormData({ name: '', description: '', barcode: '', barcode_type: '' });
      if (shelfId) {
        navigate(`/shelves/${shelfId}/items`);
      } else if (containerId) {
        navigate(`/containers/${containerId}/items`);
      } else {
        navigate('/items');
      }
    } catch (err) {
      console.error('Failed to update item:', err);
      alert('Failed to update item. Please try again.');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete "${name}"?`)) {
      try {
        await deleteItem.mutateAsync(id);
        if (itemId === id) {
          if (shelfId) {
            navigate(`/shelves/${shelfId}/items`);
          } else if (containerId) {
            navigate(`/containers/${containerId}/items`);
          } else {
            navigate('/items');
          }
        }
      } catch (err) {
        console.error('Failed to delete item:', err);
        alert('Failed to delete item. Please try again.');
      }
    }
  };

  const openEditModal = (id: string) => {
    if (shelfId) {
      navigate(`/shelves/${shelfId}/items/${id}/edit`);
    } else if (containerId) {
      navigate(`/containers/${containerId}/items/${id}/edit`);
    } else {
      navigate(`/items/${id}/edit`);
    }
  };

  const closeEditModal = () => {
    if (shelfId) {
      navigate(`/shelves/${shelfId}/items`);
    } else if (containerId) {
      navigate(`/containers/${containerId}/items`);
    } else {
      navigate('/items');
    }
    setEditFormData({ name: '', description: '', barcode: '', barcode_type: '' });
  };

  const openCreateModal = () => {
    setShowCreateModal(true);
  };

  const closeCreateModal = () => {
    setShowCreateModal(false);
    setCreateFormData({
      shelf_id: shelfId,
      container_id: containerId,
      name: '',
      description: '',
      barcode: '',
      barcode_type: '',
    });
  };

  const handleMove = async (item: ItemResponse) => {
    if (moveLocationType === 'shelf' && !moveTargetShelf) {
      alert('Please select a target shelf');
      return;
    }
    if (moveLocationType === 'container' && !moveTargetContainer) {
      alert('Please select a target container');
      return;
    }
    try {
      await moveItem.mutateAsync({
        itemId: item.id,
        data: {
          target_shelf_id: moveLocationType === 'shelf' ? moveTargetShelf : undefined,
          target_container_id: moveLocationType === 'container' ? moveTargetContainer : undefined,
        },
      });
      setMoveModalItem(null);
      setMoveTargetShelf('');
      setMoveTargetContainer('');
      alert('Item moved successfully');
    } catch (err) {
      console.error('Failed to move item:', err);
      alert('Failed to move item. Please try again.');
    }
  };

  if (isLoading) return <div className="loading">Loading items...</div>;

  // Item card component with photos
  function ItemCard({
    item,
    onEdit,
    onDelete,
    onMove,
    updateItemPending,
    deleteItemPending,
    moveItemPending,
  }: {
    item: ItemResponse;
    onEdit: () => void;
    onDelete: () => void;
    onMove: () => void;
    updateItemPending: boolean;
    deleteItemPending: boolean;
    moveItemPending: boolean;
  }) {
    const { data: photos } = usePhotos('item', item.id);
    const firstPhoto = photos && photos.length > 0 ? photos[0] : null;

    return (
      <div className="room-card">
        <div className="card-header">
          <h3>{item.name}</h3>
          <div className="card-actions">
            <button
              className="btn btn-secondary btn-sm"
              onClick={onEdit}
              disabled={updateItemPending}
            >
              Edit
            </button>
            <button
              className="btn btn-danger btn-sm"
              onClick={onDelete}
              disabled={deleteItemPending}
            >
              Delete
            </button>
          </div>
        </div>
        {firstPhoto && (
          <div className="room-photo-preview">
            <img
              src={firstPhoto.thumbnail_url || firstPhoto.url}
              alt={item.name}
              onClick={() => window.open(firstPhoto.url, '_blank')}
              loading="lazy"
            />
            {photos && photos.length > 1 && (
              <div className="photo-count-badge">+{photos.length - 1}</div>
            )}
          </div>
        )}
        {item.barcode && (
          <div className="item-barcode">
            <strong>Barcode:</strong> {item.barcode}
            {item.barcode_type && ` (${item.barcode_type})`}
          </div>
        )}
        {item.description && (
          <p className="room-description">{item.description}</p>
        )}
        <div className="room-meta">
          <small>
            Created: {new Date(item.created_at).toLocaleDateString()}
          </small>
          {item.updated_at !== item.created_at && (
            <>
              {' • '}
              <small>
                Updated: {new Date(item.updated_at).toLocaleDateString()}
              </small>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          {room && unit && shelf && (
            <nav className="breadcrumb">
              <Link to="/rooms">Rooms</Link>
              {' → '}
              <Link to={`/rooms/${room.id}`}>{room.name}</Link>
              {' → '}
              <Link to={`/units/${unit.id}`}>{unit.name}</Link>
              {' → '}
              <Link to={`/units/${unit.id}/shelves`}>Shelves</Link>
              {' → '}
              <span>{shelf.name}</span>
              {' → Items'}
            </nav>
          )}
          {container && (
            <nav className="breadcrumb">
              <Link to="/containers">Containers</Link>
              {' → '}
              <span>{container.name}</span>
              {' → Items'}
            </nav>
          )}
          <h1>
            {shelf
              ? `Items in ${shelf.name}`
              : container
                ? `Items in ${container.name}`
                : 'All Items'}
          </h1>
        </div>
        <button className="btn btn-primary" onClick={openCreateModal}>
          Add Item
        </button>
      </div>

      {/* Create Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={closeCreateModal}
        title="Create New Item"
      >
        <form onSubmit={handleCreate}>
          <div className="form-group">
            <label>Location Type</label>
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
              <label>
                <input
                  type="radio"
                  value="shelf"
                  checked={locationType === 'shelf'}
                  onChange={() => {
                    setLocationType('shelf');
                    setCreateFormData({
                      ...createFormData,
                      shelf_id: shelfId || undefined,
                      container_id: undefined,
                    });
                  }}
                />
                {' '}On Shelf
              </label>
              <label>
                <input
                  type="radio"
                  value="container"
                  checked={locationType === 'container'}
                  onChange={() => {
                    setLocationType('container');
                    setCreateFormData({
                      ...createFormData,
                      shelf_id: undefined,
                      container_id: containerId || undefined,
                    });
                  }}
                />
                {' '}In Container
              </label>
            </div>
          </div>
          {locationType === 'shelf' && !shelfId && (
            <div className="form-group">
              <label htmlFor="create-shelf">Shelf *</label>
              <select
                id="create-shelf"
                value={createFormData.shelf_id || ''}
                onChange={(e) =>
                  setCreateFormData({
                    ...createFormData,
                    shelf_id: e.target.value,
                    container_id: undefined,
                  })
                }
                required
              >
                <option value="">Select a shelf</option>
                {allShelves?.map((s: ShelfResponse) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          {locationType === 'container' && !containerId && (
            <div className="form-group">
              <label htmlFor="create-container">Container *</label>
              <select
                id="create-container"
                value={createFormData.container_id || ''}
                onChange={(e) =>
                  setCreateFormData({
                    ...createFormData,
                    shelf_id: undefined,
                    container_id: e.target.value,
                  })
                }
                required
              >
                <option value="">Select a container</option>
                {allContainers?.map((c: ContainerResponse) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="create-name">Item Name *</label>
            <input
              id="create-name"
              type="text"
              value={createFormData.name}
              onChange={(e) =>
                setCreateFormData({ ...createFormData, name: e.target.value })
              }
              required
              placeholder="e.g., Laptop, Book, Tool"
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="create-description">Description</label>
            <textarea
              id="create-description"
              value={createFormData.description}
              onChange={(e) =>
                setCreateFormData({
                  ...createFormData,
                  description: e.target.value,
                })
              }
              placeholder="Optional description"
              rows={3}
            />
          </div>

          <div className="form-group">
            <label htmlFor="create-barcode">Barcode (optional)</label>
            <input
              id="create-barcode"
              type="text"
              value={createFormData.barcode}
              onChange={(e) =>
                setCreateFormData({ ...createFormData, barcode: e.target.value })
              }
              placeholder="For future barcode scanning"
            />
          </div>

          <div className="form-group">
            <label htmlFor="create-barcode-type">Barcode Type (optional)</label>
            <input
              id="create-barcode-type"
              type="text"
              value={createFormData.barcode_type}
              onChange={(e) =>
                setCreateFormData({
                  ...createFormData,
                  barcode_type: e.target.value,
                })
              }
              placeholder="e.g., UPC, EAN, QR"
            />
          </div>

          <div className="form-actions">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={createItem.isPending}
            >
              {createItem.isPending ? 'Creating...' : 'Create Item'}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={closeCreateModal}
            >
              Cancel
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={!!itemId && !!editingItem}
        onClose={closeEditModal}
        title="Edit Item"
      >
        <form onSubmit={handleEdit}>
          <div className="form-group">
            <label htmlFor="edit-name">Item Name *</label>
            <input
              id="edit-name"
              type="text"
              value={editFormData.name}
              onChange={(e) =>
                setEditFormData({ ...editFormData, name: e.target.value })
              }
              required
              placeholder="e.g., Laptop, Book, Tool"
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="edit-description">Description</label>
            <textarea
              id="edit-description"
              value={editFormData.description}
              onChange={(e) =>
                setEditFormData({
                  ...editFormData,
                  description: e.target.value,
                })
              }
              placeholder="Optional description"
              rows={3}
            />
          </div>

          <div className="form-group">
            <label htmlFor="edit-barcode">Barcode</label>
            <input
              id="edit-barcode"
              type="text"
              value={editFormData.barcode}
              onChange={(e) =>
                setEditFormData({ ...editFormData, barcode: e.target.value })
              }
              placeholder="For future barcode scanning"
            />
          </div>

          <div className="form-group">
            <label htmlFor="edit-barcode-type">Barcode Type</label>
            <input
              id="edit-barcode-type"
              type="text"
              value={editFormData.barcode_type}
              onChange={(e) =>
                setEditFormData({
                  ...editFormData,
                  barcode_type: e.target.value,
                })
              }
              placeholder="e.g., UPC, EAN, QR"
            />
          </div>

          {editingItem && (
            <div className="form-group">
              <PhotoGallery entityType="item" entityId={editingItem.id} />
              <PhotoUpload
                entityType="item"
                entityId={editingItem.id}
                onUploadComplete={() => {
                  // Photos will refresh automatically via React Query
                }}
              />
            </div>
          )}

          <div className="form-actions">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={updateItem.isPending}
            >
              {updateItem.isPending ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={closeEditModal}
            >
              Cancel
            </button>
          </div>
        </form>
      </Modal>

      {/* Move Modal */}
      <Modal
        isOpen={!!moveModalItem}
        onClose={() => {
          setMoveModalItem(null);
          setMoveTargetShelf('');
          setMoveTargetContainer('');
        }}
        title="Move Item"
      >
        {moveModalItem && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleMove(moveModalItem);
            }}
          >
            <div className="form-group">
              <label>Location Type</label>
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                <label>
                  <input
                    type="radio"
                    value="shelf"
                    checked={moveLocationType === 'shelf'}
                    onChange={() => {
                      setMoveLocationType('shelf');
                      setMoveTargetContainer('');
                    }}
                  />
                  {' '}On Shelf
                </label>
                <label>
                  <input
                    type="radio"
                    value="container"
                    checked={moveLocationType === 'container'}
                    onChange={() => {
                      setMoveLocationType('container');
                      setMoveTargetShelf('');
                    }}
                  />
                  {' '}In Container
                </label>
              </div>
            </div>

            {moveLocationType === 'shelf' && (
              <div className="form-group">
                <label htmlFor="move-target-shelf">Target Shelf *</label>
                <select
                  id="move-target-shelf"
                  value={moveTargetShelf}
                  onChange={(e) => setMoveTargetShelf(e.target.value)}
                  required
                >
                  <option value="">Select a shelf</option>
                  {allShelves
                    ?.filter((s) => s.id !== moveModalItem.shelf_id)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                </select>
              </div>
            )}

            {moveLocationType === 'container' && (
              <div className="form-group">
                <label htmlFor="move-target-container">Target Container *</label>
                <select
                  id="move-target-container"
                  value={moveTargetContainer}
                  onChange={(e) => setMoveTargetContainer(e.target.value)}
                  required
                >
                  <option value="">Select a container</option>
                  {allContainers
                    ?.filter((c) => c.id !== moveModalItem.container_id)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </div>
            )}

            <div className="form-actions">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={moveItem.isPending}
              >
                {moveItem.isPending ? 'Moving...' : 'Move Item'}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setMoveModalItem(null);
                  setMoveTargetShelf('');
                  setMoveTargetContainer('');
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Items Grid */}
      <div className="rooms-grid">
        {items?.length === 0 ? (
          <p className="empty-state">
            {shelfId || containerId
              ? 'No items yet. Click "Add Item" to create your first item.'
              : 'No items found.'}
          </p>
        ) : (
          items?.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              onEdit={() => openEditModal(item.id)}
              onDelete={() => handleDelete(item.id, item.name)}
              onMove={() => setMoveModalItem(item)}
              updateItemPending={updateItem.isPending}
              deleteItemPending={deleteItem.isPending}
              moveItemPending={moveItem.isPending}
            />
          ))
        )}
      </div>
    </div>
  );
}
