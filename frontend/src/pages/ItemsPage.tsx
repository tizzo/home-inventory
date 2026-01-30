import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
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
  useAssignTags,
  useCreateTag,
} from '../hooks';
import { Modal, PhotoUpload, PhotoGallery, Pagination, MoveModal, EntityCreateModal, TagSelector, FileUpload, UserSelector } from '../components';
import { usersApi, itemsApi } from '../api';
import type { EntityType } from '../components/EntitySelector';
import type {
  UpdateItemRequest,
  ItemResponse,
} from '../types/generated';

export default function ItemsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { shelfId, containerId, itemId } = useParams<{
    shelfId?: string;
    containerId?: string;
    itemId?: string;
  }>();

  // Get search query from URL
  const searchQuery = searchParams.get('search') || '';
  const offsetFromUrl = parseInt(searchParams.get('offset') || '0', 10);

  // Determine context and fetch appropriate data
  const context = shelfId ? 'shelf' : containerId ? 'container' : 'all';
  const [pagination, setPagination] = useState({ 
    limit: 50, 
    offset: offsetFromUrl,
    search: searchQuery || undefined 
  });
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
  const assignTags = useAssignTags();
  const createTag = useCreateTag();
  const { showError, showSuccess } = useToast();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [moveModalItem, setMoveModalItem] = useState<ItemResponse | null>(null);
  const [editFormData, setEditFormData] = useState<UpdateItemRequest>({
    name: '',
    description: '',
    barcode: '',
    barcode_type: '',
    product_manual_s3_key: undefined,
    receipt_s3_key: undefined,
    product_link: undefined,
    belongs_to_user_id: undefined,
    acquired_date: undefined,
  });
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  // Get the item being edited from URL
  const editingItem = items?.find((i) => i.id === itemId);

  // Load current tags when editing
  const { data: currentTags } = useEntityTags('item', editingItem?.id || '');

  // Fetch download URLs for files if they exist
  const { data: manualUrl } = useQuery({
    queryKey: ['file-download-url', editingItem?.product_manual_s3_key],
    queryFn: () => itemsApi.getFileDownloadUrl(editingItem!.product_manual_s3_key!),
    enabled: !!editingItem?.product_manual_s3_key,
  });

  const { data: receiptUrl } = useQuery({
    queryKey: ['file-download-url', editingItem?.receipt_s3_key],
    queryFn: () => itemsApi.getFileDownloadUrl(editingItem!.receipt_s3_key!),
    enabled: !!editingItem?.receipt_s3_key,
  });

  // Sync pagination with URL search params
  useEffect(() => {
    const urlSearch = searchParams.get('search') || '';
    const urlOffset = parseInt(searchParams.get('offset') || '0', 10);
    setPagination({
      limit: 50,
      offset: urlOffset,
      search: urlSearch || undefined,
    });
  }, [searchParams]);

  // Handle URL-based edit modal
  useEffect(() => {
    if (itemId && editingItem) {
      setEditFormData({
        name: editingItem.name,
        description: editingItem.description || '',
        barcode: editingItem.barcode || '',
        barcode_type: editingItem.barcode_type || '',
        product_manual_s3_key: editingItem.product_manual_s3_key,
        receipt_s3_key: editingItem.receipt_s3_key,
        product_link: editingItem.product_link,
        belongs_to_user_id: editingItem.belongs_to_user_id,
        acquired_date: editingItem.acquired_date,
      });
    }
  }, [itemId, editingItem]);

  // Initialize tags when opening edit modal
  useEffect(() => {
    if (itemId && editingItem && currentTags) {
      setSelectedTagIds(currentTags.map((tag) => tag.id));
    } else if (!itemId) {
      // Clear tags when closing modal
      setSelectedTagIds([]);
    }
  }, [itemId, editingItem, currentTags]);

  // Handle search input change
  const handleSearchChange = (value: string) => {
    const newSearchParams = new URLSearchParams(searchParams);
    if (value.trim()) {
      newSearchParams.set('search', value.trim());
    } else {
      newSearchParams.delete('search');
    }
    // Reset offset when search changes
    newSearchParams.delete('offset');
    setSearchParams(newSearchParams, { replace: true });
  };

  // Handle pagination change
  const handlePageChange = (newOffset: number) => {
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.set('offset', newOffset.toString());
    setSearchParams(newSearchParams, { replace: true });
  };

  const handleCreate = async (data: Record<string, string>) => {
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
    if (!itemId || !editingItem) return;

    try {
      // Update the item first
      await updateItem.mutateAsync({
        id: itemId,
        data: {
          ...editFormData,
          barcode: editFormData.barcode || undefined,
          barcode_type: editFormData.barcode_type || undefined,
        },
      });

      // Then assign tags
      await assignTags.mutateAsync({
        entity_type: 'item',
        entity_id: editingItem.id,
        tag_ids: selectedTagIds,
      });

      setEditFormData({ name: '', description: '', barcode: '', barcode_type: '' });
      setSelectedTagIds([]);
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
    setSelectedTagIds([]);
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

    const handleCardClick = () => {
      navigate(`/items/${item.id}/view`);
    };

    return (
      <div
        className="room-card"
        onClick={handleCardClick}
        style={{ cursor: 'pointer' }}
      >
        <div className="card-header">
          <h3>{item.name}</h3>
          <div className="card-actions" onClick={(e) => e.stopPropagation()}>
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
              loading="lazy"
              style={{ cursor: 'pointer' }}
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

      {/* Search Bar */}
      <div className="search-bar" style={{ marginBottom: '1rem' }}>
        <input
          type="text"
          placeholder="Search items by name, description, or barcode..."
          value={searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
          style={{
            width: '100%',
            padding: '0.75rem',
            fontSize: '1rem',
            border: '1px solid #ddd',
            borderRadius: '4px',
          }}
        />
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

          <div className="form-group">
            <label htmlFor="edit-product-link">Product Link</label>
            <input
              id="edit-product-link"
              type="url"
              value={editFormData.product_link || ''}
              onChange={(e) =>
                setEditFormData({
                  ...editFormData,
                  product_link: e.target.value || undefined,
                })
              }
              placeholder="https://..."
            />
          </div>

          <div className="form-group">
            <label htmlFor="edit-acquired-date">Acquired Date</label>
            <input
              id="edit-acquired-date"
              type="date"
              value={editFormData.acquired_date || ''}
              onChange={(e) =>
                setEditFormData({
                  ...editFormData,
                  acquired_date: e.target.value || undefined,
                })
              }
            />
          </div>

          <div className="form-group">
            <UserSelector
              label="Belongs To"
              value={editFormData.belongs_to_user_id}
              onChange={(userId) =>
                setEditFormData({
                  ...editFormData,
                  belongs_to_user_id: userId,
                })
              }
              placeholder="Select owner..."
              fetchUsers={(search) => usersApi.getAll(search)}
            />
          </div>

          {editingItem && (
            <>
              <FileUpload
                accept="application/pdf"
                label="Product Manual (PDF)"
                currentFileUrl={manualUrl}
                onUploadComplete={(s3Key) =>
                  setEditFormData({
                    ...editFormData,
                    product_manual_s3_key: s3Key,
                  })
                }
                onClear={() =>
                  setEditFormData({
                    ...editFormData,
                    product_manual_s3_key: undefined,
                  })
                }
                getUploadUrl={(contentType) =>
                  itemsApi.getFileUploadUrl('manual', contentType)
                }
              />

              <FileUpload
                accept="application/pdf,image/*"
                label="Receipt (PDF or Image)"
                currentFileUrl={receiptUrl}
                onUploadComplete={(s3Key) =>
                  setEditFormData({
                    ...editFormData,
                    receipt_s3_key: s3Key,
                  })
                }
                onClear={() =>
                  setEditFormData({
                    ...editFormData,
                    receipt_s3_key: undefined,
                  })
                }
                getUploadUrl={(contentType) =>
                  itemsApi.getFileUploadUrl('receipt', contentType)
                }
              />
            </>
          )}

          {editingItem && (
            <div className="form-group">
              <TagSelector
                label="Tags"
                value={selectedTagIds}
                onChange={setSelectedTagIds}
                placeholder="Select tags..."
                allowCreate={true}
                onCreateTag={async (name: string) => {
                  const newTag = await createTag.mutateAsync({ name });
                  return newTag;
                }}
              />
            </div>
          )}

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
          onPageChange={handlePageChange}
        />
      )}
    </div>
  );
}
