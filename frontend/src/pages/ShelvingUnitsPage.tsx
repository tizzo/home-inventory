import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  useShelvingUnits,
  useShelvingUnitsByRoom,
  useCreateShelvingUnit,
  useUpdateShelvingUnit,
  useDeleteShelvingUnit,
  useMoveShelvingUnit,
  useRooms,
  usePhotos,
} from '../hooks';
import { Modal, PhotoUpload, PhotoGallery, Pagination } from '../components';
import type {
  CreateShelvingUnitRequest,
  UpdateShelvingUnitRequest,
  ShelvingUnitResponse,
} from '../types/generated';

export default function ShelvingUnitsPage() {
  const navigate = useNavigate();
  const { roomId, unitId } = useParams<{ roomId?: string; unitId?: string }>();
  const [pagination, setPagination] = useState({ limit: 50, offset: 0 });
  const { data: allUnitsResponse, isLoading: isLoadingAll } = useShelvingUnits(pagination);
  const { data: roomUnitsResponse, isLoading: isLoadingByRoom } =
    useShelvingUnitsByRoom(roomId || '', pagination);
  const { data: roomsResponse } = useRooms();
  const allUnits = allUnitsResponse?.data || [];
  const roomUnits = roomUnitsResponse?.data || [];
  const rooms = roomsResponse?.data || [];
  const createUnit = useCreateShelvingUnit();
  const updateUnit = useUpdateShelvingUnit();
  const deleteUnit = useDeleteShelvingUnit();
  const moveUnit = useMoveShelvingUnit();

  const units = roomId ? roomUnits : allUnits;
  const unitsResponse = roomId ? roomUnitsResponse : allUnitsResponse;
  const isLoading = roomId ? isLoadingByRoom : isLoadingAll;

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createFormData, setCreateFormData] = useState<CreateShelvingUnitRequest>({
    room_id: roomId || '',
    name: '',
    description: '',
  });
  const [editFormData, setEditFormData] = useState<UpdateShelvingUnitRequest>({
    name: '',
    description: '',
  });
  const [moveModalUnit, setMoveModalUnit] = useState<ShelvingUnitResponse | null>(null);
  const [moveTargetRoom, setMoveTargetRoom] = useState<string>('');

  // Update create form when roomId changes
  useEffect(() => {
    if (roomId) {
      setCreateFormData((prev) => ({
        ...prev,
        room_id: roomId,
      }));
    }
  }, [roomId]);

  // Get the unit being edited from URL
  const editingUnit = units?.find((u) => u.id === unitId);

  // Handle URL-based edit modal
  useEffect(() => {
    if (unitId && editingUnit) {
      setEditFormData({
        name: editingUnit.name,
        description: editingUnit.description || '',
      });
    }
  }, [unitId, editingUnit]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createFormData.room_id) {
      alert('Please select a room');
      return;
    }
    try {
      await createUnit.mutateAsync(createFormData);
      setCreateFormData({ room_id: roomId || '', name: '', description: '' });
      setShowCreateModal(false);
    } catch (err) {
      console.error('Failed to create shelving unit:', err);
      alert('Failed to create shelving unit. Please try again.');
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unitId) return;

    try {
      await updateUnit.mutateAsync({
        id: unitId,
        data: editFormData,
      });
      setEditFormData({ name: '', description: '' });
      navigate(roomId ? `/rooms/${roomId}/units` : '/units');
    } catch (err) {
      console.error('Failed to update shelving unit:', err);
      alert('Failed to update shelving unit. Please try again.');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete "${name}"?`)) {
      try {
        await deleteUnit.mutateAsync(id);
        if (unitId === id) {
          navigate(roomId ? `/rooms/${roomId}/units` : '/units');
        }
      } catch (err) {
        console.error('Failed to delete shelving unit:', err);
        alert('Failed to delete shelving unit. Please try again.');
      }
    }
  };

  const openEditModal = (id: string) => {
    if (roomId) {
      navigate(`/rooms/${roomId}/units/${id}/edit`);
    } else {
      navigate(`/units/${id}/edit`);
    }
  };

  const closeEditModal = () => {
    if (roomId) {
      navigate(`/rooms/${roomId}/units`);
    } else {
      navigate('/units');
    }
    setEditFormData({ name: '', description: '' });
  };

  const openCreateModal = () => {
    setShowCreateModal(true);
  };

  const closeCreateModal = () => {
    setShowCreateModal(false);
    setCreateFormData({ room_id: roomId || '', name: '', description: '' });
  };

  const handleMove = async (unit: ShelvingUnitResponse) => {
    if (!moveTargetRoom) {
      alert('Please select a target room');
      return;
    }
    try {
      await moveUnit.mutateAsync({
        unitId: unit.id,
        data: {
          target_room_id: moveTargetRoom,
        },
      });
      setMoveModalUnit(null);
      setMoveTargetRoom('');
    } catch (err) {
      console.error('Failed to move shelving unit:', err);
      alert('Failed to move shelving unit. Please try again.');
    }
  };

  if (isLoading) return <div className="loading">Loading shelving units...</div>;

  // Unit card component with photos
  function UnitCard({
    unit,
    onEdit,
    onDelete,
    onMove,
    updateUnitPending,
    deleteUnitPending,
    moveUnitPending,
  }: {
    unit: ShelvingUnitResponse;
    onEdit: () => void;
    onDelete: () => void;
    onMove: () => void;
    updateUnitPending: boolean;
    deleteUnitPending: boolean;
    moveUnitPending: boolean;
  }) {
    const { data: photos } = usePhotos('shelving_unit', unit.id);
    const firstPhoto = photos && photos.length > 0 ? photos[0] : null;
    const room = rooms.find((r) => r.id === unit.room_id);

    return (
      <div className="room-card">
        <div className="card-header">
          <h3>{unit.name}</h3>
          <div className="card-actions">
            <button
              className="btn btn-secondary btn-sm"
              onClick={onEdit}
              disabled={updateUnitPending}
            >
              Edit
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={onMove}
              disabled={moveUnitPending}
            >
              Move
            </button>
            <button
              className="btn btn-danger btn-sm"
              onClick={onDelete}
              disabled={deleteUnitPending}
            >
              Delete
            </button>
          </div>
        </div>
        {firstPhoto && (
          <div className="room-photo-preview">
            <img
              src={firstPhoto.thumbnail_url || firstPhoto.url}
              alt={unit.name}
              onClick={() => window.open(firstPhoto.url, '_blank')}
              loading="lazy"
            />
            {photos && photos.length > 1 && (
              <div className="photo-count-badge">+{photos.length - 1}</div>
            )}
          </div>
        )}
        {room && (
          <div className="room-meta">
            <small>
              <strong>Room:</strong>{' '}
              <Link to={`/rooms/${room.id}`}>{room.name}</Link>
            </small>
          </div>
        )}
        {unit.description && (
          <p className="room-description">{unit.description}</p>
        )}
        <div className="room-meta">
          <small>
            Created: {new Date(unit.created_at).toLocaleDateString()}
          </small>
          {unit.updated_at !== unit.created_at && (
            <>
              {' • '}
              <small>
                Updated: {new Date(unit.updated_at).toLocaleDateString()}
              </small>
            </>
          )}
        </div>
        <div className="card-actions" style={{ marginTop: '0.5rem' }}>
          <Link
            to={`/units/${unit.id}/shelves`}
            className="btn btn-secondary btn-sm"
          >
            View Shelves
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>{roomId ? 'Shelving Units' : 'All Shelving Units'}</h1>
        </div>
        <button className="btn btn-primary" onClick={openCreateModal}>
          Add Shelving Unit
        </button>
      </div>

      {/* Create Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={closeCreateModal}
        title="Create New Shelving Unit"
      >
        <form onSubmit={handleCreate}>
          <div className="form-group">
            <label htmlFor="create-room">Room *</label>
            <select
              id="create-room"
              value={createFormData.room_id}
              onChange={(e) =>
                setCreateFormData({ ...createFormData, room_id: e.target.value })
              }
              required
              disabled={!!roomId}
            >
              <option value="">Select a room</option>
              {rooms?.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="create-name">Shelving Unit Name *</label>
            <input
              id="create-name"
              type="text"
              value={createFormData.name}
              onChange={(e) =>
                setCreateFormData({ ...createFormData, name: e.target.value })
              }
              required
              placeholder="e.g., Bookcase, Storage Rack"
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

          <div className="form-actions">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={createUnit.isPending}
            >
              {createUnit.isPending ? 'Creating...' : 'Create Shelving Unit'}
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
        isOpen={!!unitId && !!editingUnit}
        onClose={closeEditModal}
        title="Edit Shelving Unit"
      >
        <form onSubmit={handleEdit}>
          <div className="form-group">
            <label htmlFor="edit-name">Shelving Unit Name *</label>
            <input
              id="edit-name"
              type="text"
              value={editFormData.name}
              onChange={(e) =>
                setEditFormData({ ...editFormData, name: e.target.value })
              }
              required
              placeholder="e.g., Bookcase, Storage Rack"
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

          {editingUnit && (
            <div className="form-group">
              <PhotoGallery
                entityType="shelving_unit"
                entityId={editingUnit.id}
              />
              <PhotoUpload
                entityType="shelving_unit"
                entityId={editingUnit.id}
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
              disabled={updateUnit.isPending}
            >
              {updateUnit.isPending ? 'Saving...' : 'Save Changes'}
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
        isOpen={!!moveModalUnit}
        onClose={() => {
          setMoveModalUnit(null);
          setMoveTargetRoom('');
        }}
        title="Move Shelving Unit"
      >
        {moveModalUnit && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleMove(moveModalUnit);
            }}
          >
            <p>Move "{moveModalUnit.name}" to a different room:</p>

            <div className="form-group">
              <label htmlFor="move-target-room">Target Room *</label>
              <select
                id="move-target-room"
                value={moveTargetRoom}
                onChange={(e) => setMoveTargetRoom(e.target.value)}
                required
              >
                <option value="">Select a room</option>
                {rooms
                  ?.filter((r) => r.id !== moveModalUnit.room_id)
                  .map((room) => (
                    <option key={room.id} value={room.id}>
                      {room.name}
                    </option>
                  ))}
              </select>
            </div>

            <div className="form-actions">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={moveUnit.isPending}
              >
                {moveUnit.isPending ? 'Moving...' : 'Move Unit'}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setMoveModalUnit(null);
                  setMoveTargetRoom('');
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Units Grid */}
      <div className="rooms-grid">
        {units.length === 0 ? (
          <p className="empty-state">
            No shelving units yet. Click "Add Shelving Unit" to create your first
            one.
          </p>
        ) : (
          units.map((unit) => (
            <UnitCard
              key={unit.id}
              unit={unit}
              onEdit={() => openEditModal(unit.id)}
              onDelete={() => handleDelete(unit.id, unit.name)}
              onMove={() => setMoveModalUnit(unit)}
              updateUnitPending={updateUnit.isPending}
              deleteUnitPending={deleteUnit.isPending}
              moveUnitPending={moveUnit.isPending}
            />
          ))
        )}
      </div>

      {/* Pagination */}
      {unitsResponse && unitsResponse.total > 0 && (
        <Pagination
          total={unitsResponse.total}
          limit={unitsResponse.limit}
          offset={unitsResponse.offset}
          onPageChange={(newOffset) => setPagination({ ...pagination, offset: newOffset })}
        />
      )}
    </div>
  );
}
