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
import { Modal, PhotoUpload, PhotoGallery, Pagination, MoveModal, EntityCreateModal } from '../components';
import type {
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
  const [editFormData, setEditFormData] = useState<UpdateShelvingUnitRequest>({
    name: '',
    description: '',
  });
  const [moveModalUnit, setMoveModalUnit] = useState<ShelvingUnitResponse | null>(null);

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

  const handleCreate = async (data: Record<string, any>) => {
    await createUnit.mutateAsync({
      room_id: data.room_id || roomId!,
      name: data.name,
      description: data.description || '',
    });
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
  };

  const handleMove = async (targetRoomId: string) => {
    if (!moveModalUnit) return;

    await moveUnit.mutateAsync({
      unitId: moveModalUnit.id,
      data: {
        target_room_id: targetRoomId,
      },
    });
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
      <EntityCreateModal
        isOpen={showCreateModal}
        onClose={closeCreateModal}
        title="Create New Shelving Unit"
        parentEntityType={roomId ? undefined : 'room'}
        parentEntityLabel={roomId ? undefined : 'Room'}
        parentEntityId={roomId}
        fields={[
          {
            name: 'name',
            label: 'Shelving Unit Name',
            type: 'text',
            required: true,
            placeholder: 'e.g., Bookcase, Storage Rack',
          },
          {
            name: 'description',
            label: 'Description',
            type: 'textarea',
            placeholder: 'Optional description',
            rows: 3,
          },
        ]}
        onSubmit={handleCreate}
        isPending={createUnit.isPending}
      />

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
      {moveModalUnit && (
        <MoveModal
          isOpen={!!moveModalUnit}
          onClose={() => setMoveModalUnit(null)}
          title="Move Shelving Unit"
          entityName={moveModalUnit.name}
          targetEntityType="room"
          targetLabel="Target Room"
          onMove={handleMove}
          isPending={moveUnit.isPending}
        />
      )}

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
