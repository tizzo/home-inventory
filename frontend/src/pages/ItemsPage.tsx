import { useState, useEffect, useRef, useCallback } from 'react';
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
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
  const searchQueryFromUrl = searchParams.get('search') || '';
  const offsetFromUrl = parseInt(searchParams.get('offset') || '0', 10);

  // Local state for search input (separate from URL to avoid re-renders on every keystroke)
  const [searchInputValue, setSearchInputValue] = useState(searchQueryFromUrl);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Determine context and fetch appropriate data
  const context = shelfId ? 'shelf' : containerId ? 'container' : 'all';
  const [pagination, setPagination] = useState({
    limit: 50,
    offset: offsetFromUrl,
    search: searchQueryFromUrl || undefined
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

  // Sync pagination with URL search params (only when URL changes externally)
  useEffect(() => {
    const urlSearch = searchParams.get('search') || '';
    const urlOffset = parseInt(searchParams.get('offset') || '0', 10);
    setPagination({
      limit: 50,
      offset: urlOffset,
      search: urlSearch || undefined,
    });
    // Also sync the input value when URL changes (e.g., browser back/forward)
    setSearchInputValue(urlSearch);
  }, [searchParams]);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

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

  // Handle search input change with debouncing
  const updateSearchUrl = useCallback((value: string) => {
    const newSearchParams = new URLSearchParams(searchParams);
    if (value.trim()) {
      newSearchParams.set('search', value.trim());
    } else {
      newSearchParams.delete('search');
    }
    // Reset offset when search changes
    newSearchParams.delete('offset');
    setSearchParams(newSearchParams, { replace: true });
  }, [searchParams, setSearchParams]);

  const handleSearchChange = useCallback((value: string) => {
    // Update local state immediately for responsive input
    setSearchInputValue(value);

    // Debounce the URL update
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      updateSearchUrl(value);
    }, 300);
  }, [updateSearchUrl]);

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
      <Card
        className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
        onClick={handleCardClick}
      >
        <CardContent className="p-4">
          <div className="flex justify-between items-start gap-2 mb-3">
            <h3 className="font-semibold text-lg truncate flex-1">{item.name}</h3>
            <div className="flex gap-1 flex-shrink-0 flex-wrap justify-end" onClick={(e) => e.stopPropagation()}>
              <Button
                variant="outline"
                size="sm"
                onClick={onEdit}
                disabled={updateItemPending}
              >
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onMove}
                disabled={moveItemPending}
              >
                Move
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={onDelete}
                disabled={deleteItemPending}
              >
                Delete
              </Button>
            </div>
          </div>
          {firstPhoto && (
            <div className="relative aspect-video rounded-lg overflow-hidden mb-3 bg-muted hover:opacity-90 transition-opacity">
              <img
                src={firstPhoto.thumbnail_url || firstPhoto.url}
                alt={item.name}
                loading="lazy"
                className="w-full h-full object-cover"
              />
              {photos && photos.length > 1 && (
                <div className="absolute bottom-2 right-2 bg-black/70 text-white px-2 py-0.5 rounded text-xs font-semibold">
                  +{photos.length - 1}
                </div>
              )}
            </div>
          )}
          {item.barcode && (
            <div className="bg-muted rounded px-2 py-1 mb-3 text-sm">
              <strong>Barcode:</strong> {item.barcode}
              {item.barcode_type && ` (${item.barcode_type})`}
            </div>
          )}
          {item.description && (
            <p className="text-muted-foreground text-sm mb-3 line-clamp-2">{item.description}</p>
          )}
          {tags && tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {tags.map((tag) => (
                <span key={tag.id} className="bg-secondary text-secondary-foreground px-2 py-0.5 rounded text-xs">
                  {tag.name}
                </span>
              ))}
            </div>
          )}
          <div className="text-xs text-muted-foreground pt-3 border-t border-border">
            <span>Created: {new Date(item.created_at).toLocaleDateString()}</span>
            {item.updated_at !== item.created_at && (
              <span className="ml-2">
                Updated: {new Date(item.updated_at).toLocaleDateString()}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          {room && unit && shelf && (
            <nav className="text-sm text-muted-foreground mb-2">
              <Link to="/rooms" className="hover:text-foreground">Rooms</Link>
              {' → '}
              <Link to={`/rooms/${room.id}`} className="hover:text-foreground">{room.name}</Link>
              {' → '}
              <Link to={`/units/${unit.id}`} className="hover:text-foreground">{unit.name}</Link>
              {' → '}
              <Link to={`/units/${unit.id}/shelves`} className="hover:text-foreground">Shelves</Link>
              {' → '}
              <span>{shelf.name}</span>
              {' → Items'}
            </nav>
          )}
          {container && (
            <nav className="text-sm text-muted-foreground mb-2">
              <Link to="/containers" className="hover:text-foreground">Containers</Link>
              {' → '}
              <Link to={`/containers/${container.id}`} className="hover:text-foreground">{container.name}</Link>
              {' → Items'}
            </nav>
          )}
          <h1 className="text-2xl font-bold">
            {shelf
              ? `Items in ${shelf.name}`
              : container
                ? `Items in ${container.name}`
                : 'All Items'}
          </h1>
        </div>
        <Button onClick={openCreateModal}>
          Add Item
        </Button>
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <Input
          type="text"
          placeholder="Search items by name, description, or barcode..."
          value={searchInputValue}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="w-full"
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
        <form onSubmit={handleEdit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Item Name *</Label>
            <Input
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

          <div className="space-y-2">
            <Label htmlFor="edit-description">Description</Label>
            <Textarea
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

          <div className="space-y-2">
            <Label htmlFor="edit-barcode">Barcode</Label>
            <Input
              id="edit-barcode"
              type="text"
              value={editFormData.barcode}
              onChange={(e) =>
                setEditFormData({ ...editFormData, barcode: e.target.value })
              }
              placeholder="For future barcode scanning"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-barcode-type">Barcode Type</Label>
            <Input
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

          <div className="space-y-2">
            <Label htmlFor="edit-product-link">Product Link</Label>
            <Input
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

          <div className="space-y-2">
            <Label htmlFor="edit-acquired-date">Acquired Date</Label>
            <Input
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

          <div className="space-y-2">
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
            <div className="space-y-2">
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
            <div>
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

          <div className="flex gap-3 pt-4 border-t border-border">
            <Button
              type="submit"
              disabled={updateItem.isPending}
              className="flex-1"
            >
              {updateItem.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={closeEditModal}
              className="flex-1"
            >
              Cancel
            </Button>
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <p className="col-span-full text-center py-12 text-muted-foreground">
            Loading items...
          </p>
        ) : items.length === 0 ? (
          <p className="col-span-full text-center py-12 text-muted-foreground">
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
