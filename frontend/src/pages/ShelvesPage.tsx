import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import {
  useShelves,
  useShelvesByUnit,
  useCreateShelf,
  useUpdateShelf,
  useDeleteShelf,
  useMoveShelf,
  useShelvingUnit,
  useRoom,
  usePhotos,
} from '../hooks';
import { Modal, PhotoUpload, PhotoGallery, Breadcrumb, Pagination, MoveModal, EntityCreateModal } from '../components';
import type {
  UpdateShelfRequest,
  ShelfResponse,
} from '../types/generated';

export default function ShelvesPage() {
  const navigate = useNavigate();
  const { unitId, shelfId } = useParams<{ unitId?: string; shelfId?: string }>();
  const [pagination, setPagination] = useState({ limit: 50, offset: 0 });
  const { data: allShelvesResponse, isLoading: isLoadingAll } = useShelves(pagination);
  const { data: unitShelvesResponse, isLoading: isLoadingByUnit } = useShelvesByUnit(
    unitId || '',
    pagination
  );
  const { data: unit } = useShelvingUnit(unitId || '');
  const { data: room } = useRoom(unit?.room_id || '');
  const allShelves = allShelvesResponse?.data || [];
  const unitShelves = unitShelvesResponse?.data || [];
  const createShelf = useCreateShelf();
  const updateShelf = useUpdateShelf();
  const deleteShelf = useDeleteShelf();
  const moveShelf = useMoveShelf();
  const { showError, showSuccess } = useToast();

  const shelves = unitId ? unitShelves : allShelves;
  const shelvesResponse = unitId ? unitShelvesResponse : allShelvesResponse;
  const isLoading = unitId ? isLoadingByUnit : isLoadingAll;

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editFormData, setEditFormData] = useState<UpdateShelfRequest>({
    name: '',
    description: '',
    position: undefined,
  });

  // Get the shelf being edited from URL
  const editingShelf = shelves?.find((s) => s.id === shelfId);

  // Handle URL-based edit modal
  useEffect(() => {
    if (shelfId && editingShelf) {
      setEditFormData({
        name: editingShelf.name,
        description: editingShelf.description || '',
        position: editingShelf.position || undefined,
      });
    }
  }, [shelfId, editingShelf]);

  const handleCreate = async (data: Record<string, string>) => {
    await createShelf.mutateAsync({
      shelving_unit_id: data.unit_id || unitId!,
      name: data.name,
      description: data.description || '',
      position: data.position ? parseInt(data.position) : undefined,
    });
    showSuccess('Shelf created successfully');
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shelfId) return;

    try {
      await updateShelf.mutateAsync({
        id: shelfId,
        data: editFormData,
      });
      setEditFormData({ name: '', description: '', position: undefined });
      showSuccess('Shelf updated successfully');
      navigate(unitId ? `/units/${unitId}/shelves` : '/shelves');
    } catch (err) {
      console.error('Failed to update shelf:', err);
      showError('Failed to update shelf. Please try again.');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete "${name}"?`)) {
      try {
        await deleteShelf.mutateAsync(id);
        if (shelfId === id) {
          navigate(unitId ? `/units/${unitId}/shelves` : '/shelves');
        }
        showSuccess('Shelf deleted successfully');
      } catch (err) {
        console.error('Failed to delete shelf:', err);
        showError('Failed to delete shelf. Please try again.');
      }
    }
  };

  const openEditModal = (id: string) => {
    if (unitId) {
      navigate(`/units/${unitId}/shelves/${id}/edit`);
    } else {
      navigate(`/shelves/${id}/edit`);
    }
  };

  const closeEditModal = () => {
    if (unitId) {
      navigate(`/units/${unitId}/shelves`);
    } else {
      navigate('/shelves');
    }
    setEditFormData({ name: '', description: '', position: undefined });
  };

  const openCreateModal = () => {
    setShowCreateModal(true);
  };

  const closeCreateModal = () => {
    setShowCreateModal(false);
  };

  const [moveModalShelf, setMoveModalShelf] = useState<ShelfResponse | null>(null);

  const handleMove = async (targetUnitId: string) => {
    if (!moveModalShelf) return;

    await moveShelf.mutateAsync({
      shelfId: moveModalShelf.id,
      data: {
        target_unit_id: targetUnitId,
      },
    });
    showSuccess(`Shelf "${moveModalShelf.name}" moved successfully`);
  };

  if (isLoading) return <div className="loading">Loading shelves...</div>;

  // Shelf card component with photos
  function ShelfCard({
    shelf,
    onEdit,
    onDelete,
    onMove,
    updateShelfPending,
    deleteShelfPending,
    moveShelfPending,
  }: {
    shelf: ShelfResponse;
    onEdit: () => void;
    onDelete: () => void;
    onMove: () => void;
    updateShelfPending: boolean;
    deleteShelfPending: boolean;
    moveShelfPending: boolean;
  }) {
    const { data: photos } = usePhotos('shelf', shelf.id);
    const firstPhoto = photos && photos.length > 0 ? photos[0] : null;

    return (
      <div className="room-card">
        <div className="card-header">
          <h3>
            {shelf.name}
            {shelf.position !== null && shelf.position !== undefined && (
              <span className="position-badge">#{shelf.position}</span>
            )}
          </h3>
          <div className="card-actions">
            <button
              className="btn btn-secondary btn-sm"
              onClick={onEdit}
              disabled={updateShelfPending}
            >
              Edit
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={onMove}
              disabled={moveShelfPending}
            >
              Move
            </button>
            <button
              className="btn btn-danger btn-sm"
              onClick={onDelete}
              disabled={deleteShelfPending}
            >
              Delete
            </button>
          </div>
        </div>
        {firstPhoto && (
          <div className="room-photo-preview">
            <img
              src={firstPhoto.thumbnail_url || firstPhoto.url}
              alt={shelf.name}
              onClick={() => window.open(firstPhoto.url, '_blank')}
              loading="lazy"
            />
            {photos && photos.length > 1 && (
              <div className="photo-count-badge">+{photos.length - 1}</div>
            )}
          </div>
        )}
        {shelf.description && (
          <p className="room-description">{shelf.description}</p>
        )}
        <div className="room-meta">
          <small>
            Created: {new Date(shelf.created_at).toLocaleDateString()}
          </small>
          {shelf.updated_at !== shelf.created_at && (
            <>
              {' • '}
              <small>
                Updated: {new Date(shelf.updated_at).toLocaleDateString()}
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
          {room && unit && (
            <Breadcrumb
              items={[
                { name: 'Rooms', url: '/rooms' },
                { name: room.name, url: `/rooms/${room.id}` },
                { name: unit.name, url: `/units/${unit.id}` },
                { name: 'Shelves' },
              ]}
            />
          )}
          <h1>
            {unit ? `Shelves in ${unit.name}` : 'All Shelves'}
          </h1>
        </div>
        <button className="btn btn-primary" onClick={openCreateModal}>
          Add Shelf
        </button>
      </div>

      {/* Create Modal */}
      <EntityCreateModal
        isOpen={showCreateModal}
        onClose={closeCreateModal}
        title="Create New Shelf"
        parentEntityType={unitId ? undefined : 'unit'}
        parentEntityLabel={unitId ? undefined : 'Shelving Unit'}
        parentEntityId={unitId}
        fields={[
          {
            name: 'name',
            label: 'Shelf Name',
            type: 'text',
            required: true,
            placeholder: 'e.g., Top Shelf, Bottom Shelf',
          },
          {
            name: 'description',
            label: 'Description',
            type: 'textarea',
            placeholder: 'Optional description',
            rows: 3,
          },
          {
            name: 'position',
            label: 'Position',
            type: 'number',
            placeholder: 'Auto-assigned if not provided',
          },
        ]}
        onSubmit={handleCreate}
        isPending={createShelf.isPending}
      />

      {/* Edit Modal */}
      <Modal
        isOpen={!!shelfId && !!editingShelf}
        onClose={closeEditModal}
        title="Edit Shelf"
      >
        <form onSubmit={handleEdit}>
          <div className="form-group">
            <label htmlFor="edit-name">Shelf Name *</label>
            <input
              id="edit-name"
              type="text"
              value={editFormData.name}
              onChange={(e) =>
                setEditFormData({ ...editFormData, name: e.target.value })
              }
              required
              placeholder="e.g., Top Shelf, Bottom Shelf"
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
            <label htmlFor="edit-position">Position</label>
            <input
              id="edit-position"
              type="number"
              value={editFormData.position || ''}
              onChange={(e) =>
                setEditFormData({
                  ...editFormData,
                  position: e.target.value
                    ? parseInt(e.target.value, 10)
                    : undefined,
                })
              }
              min="1"
            />
          </div>

          {editingShelf && (
            <div className="form-group">
              <PhotoGallery entityType="shelf" entityId={editingShelf.id} />
              <PhotoUpload
                entityType="shelf"
                entityId={editingShelf.id}
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
              disabled={updateShelf.isPending}
            >
              {updateShelf.isPending ? 'Saving...' : 'Save Changes'}
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
      {moveModalShelf && (
        <MoveModal
          isOpen={!!moveModalShelf}
          onClose={() => setMoveModalShelf(null)}
          title="Move Shelf"
          entityName={moveModalShelf.name}
          targetEntityType="unit"
          targetLabel="Target Shelving Unit"
          onMove={handleMove}
          isPending={moveShelf.isPending}
        />
      )}

      {/* Shelves Grid */}
      <div className="rooms-grid">
        {shelves.length === 0 ? (
          <p className="empty-state">
            {unitId
              ? 'No shelves yet. Click "Add Shelf" to create your first shelf.'
              : 'No shelves found.'}
          </p>
        ) : (
          shelves.map((shelf) => (
            <ShelfCard
              key={shelf.id}
              shelf={shelf}
              onEdit={() => openEditModal(shelf.id)}
              onDelete={() => handleDelete(shelf.id, shelf.name)}
              onMove={() => setMoveModalShelf(shelf)}
              updateShelfPending={updateShelf.isPending}
              deleteShelfPending={deleteShelf.isPending}
              moveShelfPending={moveShelf.isPending}
            />
          ))
        )}
      </div>

      {/* Pagination */}
      {shelvesResponse && shelvesResponse.total > 0 && (
        <Pagination
          total={shelvesResponse.total}
          limit={shelvesResponse.limit}
          offset={shelvesResponse.offset}
          onPageChange={(newOffset) => setPagination({ ...pagination, offset: newOffset })}
        />
      )}
    </div>
  );
}
