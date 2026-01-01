import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  useShelves,
  useShelvesByUnit,
  useCreateShelf,
  useUpdateShelf,
  useDeleteShelf,
  useMoveShelf,
  useShelvingUnit,
  useShelvingUnits,
  useRoom,
  usePhotos,
} from '../hooks';
import { Modal, PhotoUpload, PhotoGallery, Breadcrumb } from '../components';
import type {
  CreateShelfRequest,
  UpdateShelfRequest,
  ShelfResponse,
} from '../types/generated';

export default function ShelvesPage() {
  const navigate = useNavigate();
  const { unitId, shelfId } = useParams<{ unitId?: string; shelfId?: string }>();
  const { data: allShelves, isLoading: isLoadingAll } = useShelves();
  const { data: unitShelves, isLoading: isLoadingByUnit } = useShelvesByUnit(
    unitId || ''
  );
  const { data: unit } = useShelvingUnit(unitId || '');
  const { data: room } = useRoom(unit?.room_id || '');
  const { data: allUnits } = useShelvingUnits();
  const createShelf = useCreateShelf();
  const updateShelf = useUpdateShelf();
  const deleteShelf = useDeleteShelf();
  const moveShelf = useMoveShelf();

  const shelves = unitId ? unitShelves : allShelves;
  const isLoading = unitId ? isLoadingByUnit : isLoadingAll;

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createFormData, setCreateFormData] = useState<CreateShelfRequest>({
    shelving_unit_id: unitId || '',
    name: '',
    description: '',
    position: undefined,
  });
  const [editFormData, setEditFormData] = useState<UpdateShelfRequest>({
    name: '',
    description: '',
    position: undefined,
  });

  // Update create form when unitId changes
  useEffect(() => {
    if (unitId) {
      setCreateFormData((prev) => ({
        ...prev,
        shelving_unit_id: unitId,
      }));
    }
  }, [unitId]);

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

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createFormData.shelving_unit_id) {
      alert('Please select a shelving unit');
      return;
    }
    try {
      await createShelf.mutateAsync(createFormData);
      setCreateFormData({
        shelving_unit_id: unitId || '',
        name: '',
        description: '',
        position: undefined,
      });
      setShowCreateModal(false);
    } catch (err) {
      console.error('Failed to create shelf:', err);
      alert('Failed to create shelf. Please try again.');
    }
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
      navigate(unitId ? `/units/${unitId}/shelves` : '/shelves');
    } catch (err) {
      console.error('Failed to update shelf:', err);
      alert('Failed to update shelf. Please try again.');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete "${name}"?`)) {
      try {
        await deleteShelf.mutateAsync(id);
        if (shelfId === id) {
          navigate(unitId ? `/units/${unitId}/shelves` : '/shelves');
        }
      } catch (err) {
        console.error('Failed to delete shelf:', err);
        alert('Failed to delete shelf. Please try again.');
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
    setCreateFormData({
      shelving_unit_id: unitId || '',
      name: '',
      description: '',
      position: undefined,
    });
  };

  if (isLoading) return <div className="loading">Loading shelves...</div>;

  const [moveModalShelf, setMoveModalShelf] = useState<ShelfResponse | null>(null);
  const [moveTargetUnit, setMoveTargetUnit] = useState<string>('');

  const handleMove = async (shelf: ShelfResponse) => {
    if (!moveTargetUnit) {
      alert('Please select a target shelving unit');
      return;
    }
    try {
      await moveShelf.mutateAsync({
        shelfId: shelf.id,
        data: { target_unit_id: moveTargetUnit },
      });
      setMoveModalShelf(null);
      setMoveTargetUnit('');
      alert('Shelf moved successfully');
    } catch (err) {
      console.error('Failed to move shelf:', err);
      alert('Failed to move shelf. Please try again.');
    }
  };

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
      <Modal
        isOpen={showCreateModal}
        onClose={closeCreateModal}
        title="Create New Shelf"
      >
        <form onSubmit={handleCreate}>
          {!unitId && (
            <div className="form-group">
              <label htmlFor="create-unit">Shelving Unit *</label>
              <select
                id="create-unit"
                value={createFormData.shelving_unit_id || ''}
                onChange={(e) =>
                  setCreateFormData({
                    ...createFormData,
                    shelving_unit_id: e.target.value,
                  })
                }
                required
              >
                <option value="">Select a shelving unit</option>
                {allUnits?.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="form-group">
            <label htmlFor="create-name">Shelf Name *</label>
            <input
              id="create-name"
              type="text"
              value={createFormData.name}
              onChange={(e) =>
                setCreateFormData({ ...createFormData, name: e.target.value })
              }
              required
              placeholder="e.g., Top Shelf, Bottom Shelf"
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
            <label htmlFor="create-position">Position (optional)</label>
            <input
              id="create-position"
              type="number"
              value={createFormData.position || ''}
              onChange={(e) =>
                setCreateFormData({
                  ...createFormData,
                  position: e.target.value
                    ? parseInt(e.target.value, 10)
                    : undefined,
                })
              }
              placeholder="Auto-assigned if not provided"
              min="1"
            />
          </div>

          <div className="form-actions">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={createShelf.isPending}
            >
              {createShelf.isPending ? 'Creating...' : 'Create Shelf'}
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
      <Modal
        isOpen={!!moveModalShelf}
        onClose={() => {
          setMoveModalShelf(null);
          setMoveTargetUnit('');
        }}
        title="Move Shelf"
      >
        {moveModalShelf && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleMove(moveModalShelf);
            }}
          >
            <div className="form-group">
              <label htmlFor="move-current">Current Location</label>
              <input
                id="move-current"
                type="text"
                value={unit?.name || 'Unknown'}
                disabled
                style={{ background: 'var(--bg-color)' }}
              />
            </div>

            <div className="form-group">
              <label htmlFor="move-target">Target Shelving Unit *</label>
              <select
                id="move-target"
                value={moveTargetUnit}
                onChange={(e) => setMoveTargetUnit(e.target.value)}
                required
              >
                <option value="">Select a shelving unit</option>
                {allUnits
                  ?.filter((u) => u.id !== moveModalShelf.shelving_unit_id)
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
              </select>
            </div>

            <div className="form-actions">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={moveShelf.isPending}
              >
                {moveShelf.isPending ? 'Moving...' : 'Move Shelf'}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setMoveModalShelf(null);
                  setMoveTargetUnit('');
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Shelves Grid */}
      <div className="rooms-grid">
        {shelves?.length === 0 ? (
          <p className="empty-state">
            {unitId
              ? 'No shelves yet. Click "Add Shelf" to create your first shelf.'
              : 'No shelves found.'}
          </p>
        ) : (
          shelves?.map((shelf) => (
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
    </div>
  );
}
