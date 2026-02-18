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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
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

  const handleCreate = async (data: Record<string, string>) => {
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

  if (isLoading) return <div className="text-center py-12 text-muted-foreground">Loading shelving units...</div>;

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
      <Card className="overflow-hidden hover:shadow-lg transition-shadow">
        <CardContent className="p-4">
          <div className="flex justify-between items-start gap-2 mb-3">
            <h3 className="font-semibold text-lg truncate flex-1">{unit.name}</h3>
            <div className="flex gap-1 flex-shrink-0 flex-wrap justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={onEdit}
                disabled={updateUnitPending}
              >
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onMove}
                disabled={moveUnitPending}
              >
                Move
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={onDelete}
                disabled={deleteUnitPending}
              >
                Delete
              </Button>
            </div>
          </div>
          {firstPhoto && (
            <div className="relative aspect-video rounded-lg overflow-hidden mb-3 bg-muted cursor-pointer hover:opacity-90 transition-opacity">
              <img
                src={firstPhoto.thumbnail_url || firstPhoto.url}
                alt={unit.name}
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
          {room && (
            <div className="text-sm text-muted-foreground mb-2">
              <strong>Room:</strong>{' '}
              <Link to={`/rooms/${room.id}`} className="hover:text-foreground">{room.name}</Link>
            </div>
          )}
          {unit.description && (
            <p className="text-muted-foreground text-sm mb-3 line-clamp-2">{unit.description}</p>
          )}
          <div className="text-xs text-muted-foreground mb-3">
            <span>Created: {new Date(unit.created_at).toLocaleDateString()}</span>
            {unit.updated_at !== unit.created_at && (
              <span className="ml-2">
                Updated: {new Date(unit.updated_at).toLocaleDateString()}
              </span>
            )}
          </div>
          <div className="pt-3 border-t border-border">
            <Button
              variant="secondary"
              size="sm"
              asChild
            >
              <Link to={`/units/${unit.id}/shelves`}>
                View Shelves
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold">{roomId ? 'Shelving Units' : 'All Shelving Units'}</h1>
        <Button onClick={openCreateModal}>
          Add Shelving Unit
        </Button>
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
        <form onSubmit={handleEdit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Shelving Unit Name *</Label>
            <Input
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

          {editingUnit && (
            <div>
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

          <div className="flex gap-3 pt-4 border-t border-border">
            <Button
              type="submit"
              disabled={updateUnit.isPending}
              className="flex-1"
            >
              {updateUnit.isPending ? 'Saving...' : 'Save Changes'}
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {units.length === 0 ? (
          <p className="col-span-full text-center py-12 text-muted-foreground">
            No shelving units yet. Click "Add Shelving Unit" to create your first one.
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
