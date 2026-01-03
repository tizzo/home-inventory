import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useRooms, useCreateRoom, useUpdateRoom, useDeleteRoom, usePhotos } from '../hooks';
import { Modal, PhotoUpload, PhotoGallery, Pagination } from '../components';
import type { CreateRoomRequest, UpdateRoomRequest, RoomResponse } from '../types/generated';

export default function RoomsPage() {
  const navigate = useNavigate();
  const { roomId } = useParams<{ roomId: string }>();
  const [pagination, setPagination] = useState({ limit: 50, offset: 0 });
  const { data: roomsResponse, isLoading, error } = useRooms(pagination);
  const rooms = roomsResponse?.data || [];
  const createRoom = useCreateRoom();
  const updateRoom = useUpdateRoom();
  const deleteRoom = useDeleteRoom();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createFormData, setCreateFormData] = useState<CreateRoomRequest>({
    name: '',
    description: '',
  });
  const [editFormData, setEditFormData] = useState<UpdateRoomRequest>({
    name: '',
    description: '',
  });

  // Get the room being edited from URL - need to fetch it separately if not in current page
  const editingRoom = rooms.find((r) => r.id === roomId);

  // Handle URL-based edit modal
  useEffect(() => {
    if (roomId && editingRoom) {
      setEditFormData({
        name: editingRoom.name,
        description: editingRoom.description || '',
      });
    }
  }, [roomId, editingRoom]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createRoom.mutateAsync(createFormData);
      setCreateFormData({ name: '', description: '' });
      setShowCreateModal(false);
    } catch (err) {
      console.error('Failed to create room:', err);
      alert('Failed to create room. Please try again.');
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomId) return;

    try {
      await updateRoom.mutateAsync({
        id: roomId,
        data: editFormData,
      });
      setEditFormData({ name: '', description: '' });
      navigate('/rooms'); // Close modal by navigating back
    } catch (err) {
      console.error('Failed to update room:', err);
      alert('Failed to update room. Please try again.');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete "${name}"?`)) {
      try {
        await deleteRoom.mutateAsync(id);
        // If we're viewing/editing this room, navigate back to list
        if (roomId === id) {
          navigate('/rooms');
        }
      } catch (err) {
        console.error('Failed to delete room:', err);
        alert('Failed to delete room. Please try again.');
      }
    }
  };

  const openEditModal = (id: string) => {
    navigate(`/rooms/${id}/edit`);
  };

  const closeEditModal = () => {
    navigate('/rooms');
    setEditFormData({ name: '', description: '' });
  };

  const openCreateModal = () => {
    setShowCreateModal(true);
  };

  const closeCreateModal = () => {
    setShowCreateModal(false);
    setCreateFormData({ name: '', description: '' });
  };

  if (isLoading) return <div className="loading">Loading rooms...</div>;
  if (error) return <div className="error">Error: {error.message}</div>;

  // Room card component with photos
  function RoomCard({
    room,
    onEdit,
    onDelete,
    updateRoomPending,
    deleteRoomPending,
  }: {
    room: RoomResponse;
    onEdit: () => void;
    onDelete: () => void;
    updateRoomPending: boolean;
    deleteRoomPending: boolean;
  }) {
    const { data: photos } = usePhotos('room', room.id);
    const firstPhoto = photos && photos.length > 0 ? photos[0] : null;

    return (
      <div className="room-card">
        <div className="card-header">
          <h3>{room.name}</h3>
          <div className="card-actions">
            <button
              className="btn btn-secondary btn-sm"
              onClick={onEdit}
              disabled={updateRoomPending}
            >
              Edit
            </button>
            <button
              className="btn btn-danger btn-sm"
              onClick={onDelete}
              disabled={deleteRoomPending}
            >
              Delete
            </button>
          </div>
        </div>
        {firstPhoto && (
          <div className="room-photo-preview">
            <img
              src={firstPhoto.thumbnail_url || firstPhoto.url}
              alt={room.name}
              onClick={() => window.open(firstPhoto.url, '_blank')}
              loading="lazy"
            />
            {photos && photos.length > 1 && (
              <div className="photo-count-badge">
                +{photos.length - 1}
              </div>
            )}
          </div>
        )}
        {room.description && (
          <p className="room-description">{room.description}</p>
        )}
        <div className="room-meta">
          <small>
            Created: {new Date(room.created_at).toLocaleDateString()}
          </small>
          {room.updated_at !== room.created_at && (
            <>
              {' • '}
              <small>
                Updated: {new Date(room.updated_at).toLocaleDateString()}
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
        <h1>Rooms</h1>
        <button className="btn btn-primary" onClick={openCreateModal}>
          Add Room
        </button>
      </div>

      {/* Create Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={closeCreateModal}
        title="Create New Room"
      >
        <form onSubmit={handleCreate}>
          <div className="form-group">
            <label htmlFor="create-name">Room Name *</label>
            <input
              id="create-name"
              type="text"
              value={createFormData.name}
              onChange={(e) =>
                setCreateFormData({ ...createFormData, name: e.target.value })
              }
              required
              placeholder="e.g., Garage, Kitchen, Office"
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
              disabled={createRoom.isPending}
            >
              {createRoom.isPending ? 'Creating...' : 'Create Room'}
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
        isOpen={!!roomId && !!editingRoom}
        onClose={closeEditModal}
        title="Edit Room"
      >
        <form onSubmit={handleEdit}>
          <div className="form-group">
            <label htmlFor="edit-name">Room Name *</label>
            <input
              id="edit-name"
              type="text"
              value={editFormData.name}
              onChange={(e) =>
                setEditFormData({ ...editFormData, name: e.target.value })
              }
              required
              placeholder="e.g., Garage, Kitchen, Office"
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

          {editingRoom && (
            <div className="form-group">
              <PhotoGallery entityType="room" entityId={editingRoom.id} />
              <PhotoUpload
                entityType="room"
                entityId={editingRoom.id}
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
              disabled={updateRoom.isPending}
            >
              {updateRoom.isPending ? 'Saving...' : 'Save Changes'}
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

      {/* Rooms Grid */}
      <div className="rooms-grid">
        {rooms?.length === 0 ? (
          <p className="empty-state">
            No rooms yet. Click "Add Room" to create your first room.
          </p>
        ) : (
          rooms?.map((room) => (
            <RoomCard
              key={room.id}
              room={room}
              onEdit={() => openEditModal(room.id)}
              onDelete={() => handleDelete(room.id, room.name)}
              updateRoomPending={updateRoom.isPending}
              deleteRoomPending={deleteRoom.isPending}
            />
          ))
        )}
      </div>

      {/* Pagination */}
      {roomsResponse && (
        <Pagination
          total={roomsResponse.total}
          limit={roomsResponse.limit}
          offset={roomsResponse.offset}
          onPageChange={(newOffset) => setPagination({ ...pagination, offset: newOffset })}
        />
      )}
    </div>
  );
}
