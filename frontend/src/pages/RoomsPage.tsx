import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useRooms, useCreateRoom, useUpdateRoom, useDeleteRoom, usePhotos } from '../hooks';
import { Modal, PhotoUpload, PhotoGallery, Pagination } from '../components';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
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

  if (isLoading) return <div className="text-center py-12 text-muted-foreground">Loading rooms...</div>;
  if (error) return <div className="text-center py-12 text-destructive">Error: {error.message}</div>;

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
      <Card className="overflow-hidden hover:shadow-lg transition-shadow">
        <CardContent className="p-4">
          <div className="flex justify-between items-start gap-2 mb-3">
            <h3 className="font-semibold text-lg truncate flex-1">{room.name}</h3>
            <div className="flex gap-1 flex-shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={onEdit}
                disabled={updateRoomPending}
              >
                Edit
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={onDelete}
                disabled={deleteRoomPending}
              >
                Delete
              </Button>
            </div>
          </div>
          {firstPhoto && (
            <div className="relative aspect-video rounded-lg overflow-hidden mb-3 bg-muted cursor-pointer hover:opacity-90 transition-opacity">
              <img
                src={firstPhoto.thumbnail_url || firstPhoto.url}
                alt={room.name}
                onClick={() => window.open(firstPhoto.url, '_blank')}
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
          {room.description && (
            <p className="text-muted-foreground text-sm mb-3 line-clamp-2">{room.description}</p>
          )}
          <div className="text-xs text-muted-foreground pt-3 border-t border-border">
            <span>Created: {new Date(room.created_at).toLocaleDateString()}</span>
            {room.updated_at !== room.created_at && (
              <span className="ml-2">
                Updated: {new Date(room.updated_at).toLocaleDateString()}
              </span>
            )}
          </div>
          <div className="flex gap-2 flex-wrap mt-3">
            <Link to={`/rooms/${room.id}/units`} className="text-xs px-2 py-1 rounded border border-border hover:bg-accent">
              Shelving Units
            </Link>
            <Link to={`/rooms/${room.id}/containers`} className="text-xs px-2 py-1 rounded border border-border hover:bg-accent">
              Containers
            </Link>
            <Link to={`/rooms/${room.id}/items`} className="text-xs px-2 py-1 rounded border border-border hover:bg-accent">
              Items
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold">Rooms</h1>
        <Button onClick={openCreateModal}>
          Add Room
        </Button>
      </div>

      {/* Create Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={closeCreateModal}
        title="Create New Room"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="create-name">Room Name *</Label>
            <Input
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

          <div className="space-y-2">
            <Label htmlFor="create-description">Description</Label>
            <Textarea
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

          <div className="flex gap-3 pt-4 border-t border-border">
            <Button
              type="submit"
              disabled={createRoom.isPending}
              className="flex-1"
            >
              {createRoom.isPending ? 'Creating...' : 'Create Room'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={closeCreateModal}
              className="flex-1"
            >
              Cancel
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={!!roomId && !!editingRoom}
        onClose={closeEditModal}
        title="Edit Room"
      >
        <form onSubmit={handleEdit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Room Name *</Label>
            <Input
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

          {editingRoom && (
            <div>
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

          <div className="flex gap-3 pt-4 border-t border-border">
            <Button
              type="submit"
              disabled={updateRoom.isPending}
              className="flex-1"
            >
              {updateRoom.isPending ? 'Saving...' : 'Save Changes'}
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

      {/* Rooms Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {rooms?.length === 0 ? (
          <p className="col-span-full text-center py-12 text-muted-foreground">
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
      {roomsResponse && roomsResponse.total > 0 && (
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
