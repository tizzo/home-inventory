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
import { Modal, PhotoUpload, PhotoGallery, Breadcrumb, Pagination, MoveModal, EntityCreateModal, MultiImageAnalyzer } from '../components';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
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
  const [showMultiImageAnalyzer, setShowMultiImageAnalyzer] = useState(false);
  const [analyzerShelfId, setAnalyzerShelfId] = useState<string>('');
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

  if (isLoading) return <div className="text-center py-12 text-muted-foreground">Loading shelves...</div>;

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
      <Card className="overflow-hidden hover:shadow-lg transition-shadow">
        <CardContent className="p-4">
          <div className="flex justify-between items-start gap-2 mb-3">
            <h3 className="font-semibold text-lg truncate flex-1">
              {shelf.name}
              {shelf.position !== null && shelf.position !== undefined && (
                <span className="ml-2 bg-secondary text-secondary-foreground px-2 py-0.5 rounded text-xs">
                  #{shelf.position}
                </span>
              )}
            </h3>
            <div className="flex gap-1 flex-shrink-0 flex-wrap justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={onEdit}
                disabled={updateShelfPending}
              >
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onMove}
                disabled={moveShelfPending}
              >
                Move
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={onDelete}
                disabled={deleteShelfPending}
              >
                Delete
              </Button>
            </div>
          </div>
          {firstPhoto && (
            <div className="relative aspect-video rounded-lg overflow-hidden mb-3 bg-muted cursor-pointer hover:opacity-90 transition-opacity">
              <img
                src={firstPhoto.thumbnail_url || firstPhoto.url}
                alt={shelf.name}
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
          {shelf.description && (
            <p className="text-muted-foreground text-sm mb-3 line-clamp-2">{shelf.description}</p>
          )}
          <div className="text-xs text-muted-foreground">
            <span>Created: {new Date(shelf.created_at).toLocaleDateString()}</span>
            {shelf.updated_at !== shelf.created_at && (
              <span className="ml-2">
                Updated: {new Date(shelf.updated_at).toLocaleDateString()}
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
          <h1 className="text-2xl font-bold">
            {unit ? `Shelves in ${unit.name}` : 'All Shelves'}
          </h1>
        </div>
        <Button onClick={openCreateModal}>
          Add Shelf
        </Button>
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
        <form onSubmit={handleEdit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Shelf Name *</Label>
            <Input
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
            <Label htmlFor="edit-position">Position</Label>
            <Input
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
              min={1}
            />
          </div>

          {editingShelf && (
            <div>
              <PhotoGallery entityType="shelf" entityId={editingShelf.id} />
              <PhotoUpload
                entityType="shelf"
                entityId={editingShelf.id}
                onUploadComplete={() => {
                  // Photos will refresh automatically via React Query
                }}
              />
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setAnalyzerShelfId(editingShelf.id);
                  setShowMultiImageAnalyzer(true);
                }}
                className="mt-4"
              >
                AI Import Items (Multiple Photos)
              </Button>
            </div>
          )}

          <div className="flex gap-3 pt-4 border-t border-border">
            <Button
              type="submit"
              disabled={updateShelf.isPending}
              className="flex-1"
            >
              {updateShelf.isPending ? 'Saving...' : 'Save Changes'}
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {shelves.length === 0 ? (
          <p className="col-span-full text-center py-12 text-muted-foreground">
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

      {/* Multi-Image AI Analyzer Modal */}
      <Modal
        isOpen={showMultiImageAnalyzer}
        onClose={() => setShowMultiImageAnalyzer(false)}
        title="AI Item Import (Multiple Photos)"
      >
        <MultiImageAnalyzer
          locationType="shelf"
          locationId={analyzerShelfId}
          onAnalysisComplete={(draftId) => {
            setShowMultiImageAnalyzer(false);
            navigate(`/drafts/${draftId}`);
          }}
          onCancel={() => setShowMultiImageAnalyzer(false)}
        />
      </Modal>
    </div>
  );
}
