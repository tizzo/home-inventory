import { useState } from 'react';
import { useRooms, useCreateRoom, useDeleteRoom } from '../hooks';
import type { CreateRoomRequest } from '../types/generated';

export default function RoomsPage() {
  const { data: rooms, isLoading, error } = useRooms();
  const createRoom = useCreateRoom();
  const deleteRoom = useDeleteRoom();

  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<CreateRoomRequest>({
    name: '',
    description: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createRoom.mutateAsync(formData);
      setFormData({ name: '', description: '' });
      setShowForm(false);
    } catch (err) {
      console.error('Failed to create room:', err);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete "${name}"?`)) {
      try {
        await deleteRoom.mutateAsync(id);
      } catch (err) {
        console.error('Failed to delete room:', err);
      }
    }
  };

  if (isLoading) return <div className="loading">Loading rooms...</div>;
  if (error) return <div className="error">Error: {error.message}</div>;

  return (
    <div className="page">
      <div className="page-header">
        <h1>Rooms</h1>
        <button
          className="btn btn-primary"
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? 'Cancel' : 'Add Room'}
        </button>
      </div>

      {showForm && (
        <form className="form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="name">Room Name *</label>
            <input
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              required
              placeholder="e.g., Garage, Kitchen, Office"
            />
          </div>

          <div className="form-group">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="Optional description"
              rows={3}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={createRoom.isPending}
          >
            {createRoom.isPending ? 'Creating...' : 'Create Room'}
          </button>
        </form>
      )}

      <div className="rooms-grid">
        {rooms?.length === 0 ? (
          <p className="empty-state">
            No rooms yet. Click "Add Room" to create your first room.
          </p>
        ) : (
          rooms?.map((room) => (
            <div key={room.id} className="room-card">
              <div className="card-header">
                <h3>{room.name}</h3>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => handleDelete(room.id, room.name)}
                  disabled={deleteRoom.isPending}
                >
                  Delete
                </button>
              </div>
              {room.description && (
                <p className="room-description">{room.description}</p>
              )}
              <div className="room-meta">
                <small>Created: {new Date(room.created_at).toLocaleDateString()}</small>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
