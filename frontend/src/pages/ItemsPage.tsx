import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
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
  useShelvingUnit,
  useRoom,
  usePhotos,
  useEntityTags,
} from '../hooks';
import { Modal, PhotoUpload, PhotoGallery, Pagination, MoveModal, EntityCreateModal } from '../components';
import type { EntityType } from '../components/EntitySelector';
import type {
  UpdateItemRequest,
  ItemResponse,
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
  const [pagination, setPagination] = useState({ limit: 50, offset: 0 });
  const { data: allItemsResponse, isLoading: isLoadingAll } = useItems(pagination);
  const { data: shelfItemsResponse, isLoading: isLoadingShelf } = useItemsByShelf(
    shelfId || '',
    pagination
  );
  const { data: containerItemsResponse, isLoading: isLoadingContainer } =
    useItemsByContainer(containerId || '', pagination);

  const allItems = allItemsResponse?.data || [];
  const shelfItems = shelfItemsResponse?.data || [];
  const containerItems = containerItemsResponse?.data || [];

  const items =
    context === 'shelf'
      ? shelfItems
      : context === 'container'
        ? containerItems
        : allItems;
  const itemsResponse =
    context === 'shelf'
      ? shelfItemsResponse
      : context === 'container'
        ? containerItemsResponse
        : allItemsResponse;
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

  const createItem = useCreateItem();
  const updateItem = useUpdateItem();
  const deleteItem = useDeleteItem();
  const moveItem = useMoveItem();
  const { showError, showSuccess } = useToast();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [moveModalItem, setMoveModalItem] = useState<ItemResponse | null>(null);
  const [editFormData, setEditFormData] = useState<UpdateItemRequest>({
    name: '',
    description: '',
    barcode: '',
    barcode_type: '',
  });

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

  const handleCreate = async (data: Record<string, any>) => {
    await createItem.mutateAsync({
      shelf_id: data.shelf_id,
      container_id: data.container_id,
      name: data.name,
      description: data.description || '',
      barcode: data.barcode || undefined,
      barcode_type: data.barcode_type || undefined,
    });
    showSuccess('Item created successfully');
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
      showSuccess('Item updated successfully');
      if (shelfId) {
        navigate(`/shelves/${shelfId}/items`);
      } else if (containerId) {
        navigate(`/containers/${containerId}/items`);
      } else {
        navigate('/items');
      }
    } catch (err) {
      console.error('Failed to update item:', err);
      showError('Failed to update item. Please try again.');
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
  };

  const handleMove = async (targetId: string, selectedType?: EntityType) => {
    if (!moveModalItem) return;

    await moveItem.mutateAsync({
      itemId: moveModalItem.id,
      data: {
        target_shelf_id: selectedType === 'shelf' ? targetId : undefined,
        target_container_id: selectedType === 'container' ? targetId : undefined,
      },
    });
    showSuccess(`Item "${moveModalItem.name}" moved successfully`);
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
    const { data: tags } = useEntityTags('item', item.id);
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
              className="btn btn-secondary btn-sm"
              onClick={onMove}
              disabled={moveItemPending}
            >
              Move
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
        {tags && tags.length > 0 && (
          <div className="tags-list">
            {tags.map((tag) => (
              <span key={tag.id} className="tag">
                {tag.name}
              </span>
            ))}
          </div>
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
              <Link to={`/containers/${container.id}`}>{container.name}</Link>
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
      <EntityCreateModal
        isOpen={showCreateModal}
        onClose={closeCreateModal}
        title="Create New Item"
        parentTypes={[
          {
            type: 'shelf',
            label: 'Shelf',
            displayName: 'On Shelf',
            preSelectedId: shelfId,
          },
          {
            type: 'container',
            label: 'Container',
            displayName: 'In Container',
            preSelectedId: containerId,
          },
        ]}
        fields={[
          {
            name: 'name',
            label: 'Item Name',
            type: 'text',
            required: true,
            placeholder: 'e.g., Laptop, Book, Tool',
          },
          {
            name: 'description',
            label: 'Description',
            type: 'textarea',
            placeholder: 'Optional description',
            rows: 3,
          },
          {
            name: 'barcode',
            label: 'Barcode',
            type: 'text',
            placeholder: 'For future barcode scanning',
          },
          {
            name: 'barcode_type',
            label: 'Barcode Type',
            type: 'text',
            placeholder: 'e.g., UPC, EAN, QR',
          },
        ]}
        onSubmit={handleCreate}
        isPending={createItem.isPending}
      />

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
      {moveModalItem && (
        <MoveModal
          isOpen={!!moveModalItem}
          onClose={() => setMoveModalItem(null)}
          title="Move Item"
          entityName={moveModalItem.name}
          locationTypes={[
            { type: 'shelf', label: 'Target Shelf', displayName: 'On Shelf' },
            { type: 'container', label: 'Target Container', displayName: 'In Container' },
          ]}
          onMove={handleMove}
          isPending={moveItem.isPending}
        />
      )}

      {/* Items Grid */}
      <div className="rooms-grid">
        {items.length === 0 ? (
          <p className="empty-state">
            {shelfId || containerId
              ? 'No items yet. Click "Add Item" to create your first item.'
              : 'No items found.'}
          </p>
        ) : (
          items.map((item) => (
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

      {/* Pagination */}
      {itemsResponse && itemsResponse.total > 0 && (
        <Pagination
          total={itemsResponse.total}
          limit={itemsResponse.limit}
          offset={itemsResponse.offset}
          onPageChange={(newOffset) => setPagination({ ...pagination, offset: newOffset })}
        />
      )}
    </div>
  );
}
