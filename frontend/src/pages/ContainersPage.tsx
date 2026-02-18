import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import {
  useContainers,
  useContainersByShelf,
  useContainersByParent,
  useContainersByRoom,
  useCreateContainer,
  useUpdateContainer,
  useDeleteContainer,
  useMoveContainer,
  useShelf,
  useContainer,
  useShelvingUnit,
  useRoom,
  usePhotos,
  useItemsByContainer,
  useEntityTags,
} from '../hooks';
import { useAuth } from '../hooks/useAuth';
import { Modal, PhotoUpload, PhotoGallery, Pagination, MoveModal, EntityCreateModal, ImportItemsFromPhoto } from '../components';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import type { EntityType } from '../components/EntitySelector';
import type {
  UpdateContainerRequest,
  ContainerResponse,
} from '../types/generated';

export default function ContainersPage() {
  const navigate = useNavigate();
  const { shelfId, containerId, parentId, roomId } = useParams<{
    shelfId?: string;
    containerId?: string;
    parentId?: string;
    roomId?: string;
  }>();

  // Determine context and fetch appropriate data
  const context = shelfId ? 'shelf' : parentId ? 'parent' : roomId ? 'room' : 'all';
  const [pagination, setPagination] = useState({ limit: 50, offset: 0 });
  const { data: allContainersResponse, isLoading: isLoadingAll } = useContainers(pagination);
  const { data: shelfContainersResponse, isLoading: isLoadingShelf } =
    useContainersByShelf(shelfId || '', pagination);
  const { data: parentContainersResponse, isLoading: isLoadingParent } =
    useContainersByParent(parentId || '', pagination);
  const { data: roomContainersResponse, isLoading: isLoadingRoom } =
    useContainersByRoom(roomId || '', pagination);

  const allContainers = allContainersResponse?.data || [];
  const shelfContainers = shelfContainersResponse?.data || [];
  const parentContainers = parentContainersResponse?.data || [];
  const roomContainers = roomContainersResponse?.data || [];

  const containers =
    context === 'shelf'
      ? shelfContainers
      : context === 'parent'
        ? parentContainers
        : context === 'room'
          ? roomContainers
          : allContainers;
  const containersResponse =
    context === 'shelf'
      ? shelfContainersResponse
      : context === 'parent'
        ? parentContainersResponse
        : context === 'room'
          ? roomContainersResponse
          : allContainersResponse;
  const isLoading =
    context === 'shelf'
      ? isLoadingShelf
      : context === 'parent'
        ? isLoadingParent
        : context === 'room'
          ? isLoadingRoom
          : isLoadingAll;

  // Fetch context data for breadcrumbs
  const { data: shelf } = useShelf(shelfId || '');
  const { data: parentContainer } = useContainer(parentId || '');
  const { data: unit } = useShelvingUnit(shelf?.shelving_unit_id || '');
  const { data: shelfRoom } = useRoom(unit?.room_id || '');
  const { data: directRoom } = useRoom(roomId || '');
  const room = directRoom || shelfRoom;

  const createContainer = useCreateContainer();
  const updateContainer = useUpdateContainer();
  const deleteContainer = useDeleteContainer();
  const moveContainer = useMoveContainer();
  const { showSuccess } = useToast();
  const { user } = useAuth();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [moveModalContainer, setMoveModalContainer] = useState<ContainerResponse | null>(null);
  const [editFormData, setEditFormData] = useState<UpdateContainerRequest>({
    name: '',
    description: '',
  });

  // Get the container being edited from URL
  const editingContainer = containers?.find((c) => c.id === containerId);

  // Handle URL-based edit modal
  useEffect(() => {
    if (containerId && editingContainer) {
      setEditFormData({
        name: editingContainer.name,
        description: editingContainer.description || '',
      });
    }
  }, [containerId, editingContainer]);

  const handleCreate = async (data: Record<string, string>) => {
    await createContainer.mutateAsync({
      shelf_id: data.shelf_id,
      parent_container_id: data.container_id,
      room_id: data.room_id,
      name: data.name,
      description: data.description || '',
    });
    showSuccess('Container created successfully');
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!containerId) return;

    try {
      await updateContainer.mutateAsync({
        id: containerId,
        data: editFormData,
      });
      setEditFormData({ name: '', description: '' });
      if (shelfId) {
        navigate(`/shelves/${shelfId}/containers`);
      } else if (parentId) {
        navigate(`/containers/${parentId}/children`);
      } else if (roomId) {
        navigate(`/rooms/${roomId}/containers`);
      } else {
        navigate('/containers');
      }
    } catch (err) {
      console.error('Failed to update container:', err);
      alert('Failed to update container. Please try again.');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (
      window.confirm(
        `Are you sure you want to delete "${name}"? This will fail if the container has nested containers or items.`
      )
    ) {
      try {
        await deleteContainer.mutateAsync(id);
        if (containerId === id) {
          if (shelfId) {
            navigate(`/shelves/${shelfId}/containers`);
          } else if (parentId) {
            navigate(`/containers/${parentId}/children`);
          } else if (roomId) {
            navigate(`/rooms/${roomId}/containers`);
          } else {
            navigate('/containers');
          }
        }
      } catch (err) {
        console.error('Failed to delete container:', err);
        alert(
          'Failed to delete container. It may have nested containers or items.'
        );
      }
    }
  };

  const openEditModal = (id: string) => {
    if (shelfId) {
      navigate(`/shelves/${shelfId}/containers/${id}/edit`);
    } else if (parentId) {
      navigate(`/containers/${parentId}/children/${id}/edit`);
    } else if (roomId) {
      navigate(`/rooms/${roomId}/containers/${id}/edit`);
    } else {
      navigate(`/containers/${id}/edit`);
    }
  };

  const closeEditModal = () => {
    if (shelfId) {
      navigate(`/shelves/${shelfId}/containers`);
    } else if (parentId) {
      navigate(`/containers/${parentId}/children`);
    } else if (roomId) {
      navigate(`/rooms/${roomId}/containers`);
    } else {
      navigate('/containers');
    }
    setEditFormData({ name: '', description: '' });
  };

  const openCreateModal = () => {
    setShowCreateModal(true);
  };

  const closeCreateModal = () => {
    setShowCreateModal(false);
  };

  const handleMove = async (targetId: string, selectedType?: EntityType) => {
    if (!moveModalContainer) return;

    await moveContainer.mutateAsync({
      containerId: moveModalContainer.id,
      data: {
        target_shelf_id: selectedType === 'shelf' ? targetId : undefined,
        target_parent_id: selectedType === 'container' ? targetId : undefined,
        target_room_id: selectedType === 'room' ? targetId : undefined,
      },
    });
    showSuccess(`Container "${moveModalContainer.name}" moved successfully`);
  };

  if (isLoading) return <div className="text-center py-12 text-muted-foreground">Loading containers...</div>;

  // Container card component with photos
  function ContainerCard({
    container,
    onEdit,
    onDelete,
    onMove,
    updateContainerPending,
    deleteContainerPending,
    moveContainerPending,
  }: {
    container: ContainerResponse;
    onEdit: () => void;
    onDelete: () => void;
    onMove: () => void;
    updateContainerPending: boolean;
    deleteContainerPending: boolean;
    moveContainerPending: boolean;
  }) {
    const { data: photos } = usePhotos('container', container.id);
    const { data: tags } = useEntityTags('container', container.id);
    const { data: itemsData } = useItemsByContainer(container.id, { limit: 5, offset: 0 });
    const { data: childContainers } = useContainersByParent(container.id, { limit: 5, offset: 0 });
    const firstPhoto = photos && photos.length > 0 ? photos[0] : null;
    const itemCount = itemsData?.total || 0;
    const containerCount = childContainers?.total || 0;

    return (
      <Card className="overflow-hidden hover:shadow-lg transition-shadow">
        <CardContent className="p-4">
          <div className="flex justify-between items-start gap-2 mb-3">
            <h3 className="font-semibold text-lg truncate flex-1">{container.name}</h3>
            <div className="flex gap-1 flex-shrink-0 flex-wrap justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={onEdit}
                disabled={updateContainerPending}
              >
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onMove}
                disabled={moveContainerPending}
              >
                Move
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={onDelete}
                disabled={deleteContainerPending}
              >
                Delete
              </Button>
            </div>
          </div>
          {firstPhoto && (
            <div className="relative aspect-video rounded-lg overflow-hidden mb-3 bg-muted cursor-pointer hover:opacity-90 transition-opacity">
              <img
                src={firstPhoto.thumbnail_url || firstPhoto.url}
                alt={container.name}
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
          {container.description && (
            <p className="text-muted-foreground text-sm mb-3 line-clamp-2">{container.description}</p>
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
          <div className="text-xs text-muted-foreground mb-3">
            <span>Created: {new Date(container.created_at).toLocaleDateString()}</span>
            {container.updated_at !== container.created_at && (
              <span className="ml-2">
                Updated: {new Date(container.updated_at).toLocaleDateString()}
              </span>
            )}
          </div>
          <div className="text-sm text-muted-foreground mb-3">
            {itemCount > 0 && containerCount > 0 && (
              <>{itemCount} items &bull; {containerCount} containers</>
            )}
            {itemCount > 0 && containerCount === 0 && (
              <>{itemCount} item{itemCount !== 1 ? 's' : ''}</>
            )}
            {itemCount === 0 && containerCount > 0 && (
              <>{containerCount} container{containerCount !== 1 ? 's' : ''}</>
            )}
            {itemCount === 0 && containerCount === 0 && (
              <>Empty</>
            )}
          </div>
          <div className="flex gap-2 pt-3 border-t border-border">
            <Button
              variant="secondary"
              size="sm"
              asChild
            >
              <Link to={`/containers/${container.id}/children`}>
                View Contents
              </Link>
            </Button>
            {user && <ImportItemsFromPhoto containerId={container.id} />}
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
              {' → Containers'}
            </nav>
          )}
          {parentContainer && (
            <nav className="text-sm text-muted-foreground mb-2">
              <Link to="/containers" className="hover:text-foreground">Containers</Link>
              {' → '}
              <span>{parentContainer.name}</span>
              {' → Containers'}
            </nav>
          )}
          {roomId && directRoom && !shelf && (
            <nav className="text-sm text-muted-foreground mb-2">
              <Link to="/rooms" className="hover:text-foreground">Rooms</Link>
              {' → '}
              <Link to={`/rooms/${directRoom.id}`} className="hover:text-foreground">{directRoom.name}</Link>
              {' → Containers'}
            </nav>
          )}
          <h1 className="text-2xl font-bold">
            {shelf
              ? `Containers in ${shelf.name}`
              : parentContainer
                ? `Containers in ${parentContainer.name}`
                : roomId && directRoom
                  ? `Containers in ${directRoom.name}`
                  : 'All Containers'}
          </h1>
        </div>
        <Button onClick={openCreateModal}>
          Add Container
        </Button>
      </div>

      {/* Create Modal */}
      <EntityCreateModal
        isOpen={showCreateModal}
        onClose={closeCreateModal}
        title="Create New Container"
        parentTypes={[
          {
            type: 'room',
            label: 'Room',
            displayName: 'In Room',
            preSelectedId: roomId,
          },
          {
            type: 'shelf',
            label: 'Shelf',
            displayName: 'On Shelf',
            preSelectedId: shelfId,
          },
          {
            type: 'container',
            label: 'Parent Container',
            displayName: 'Inside Container',
            preSelectedId: parentId,
          },
        ]}
        fields={[
          {
            name: 'name',
            label: 'Container Name',
            type: 'text',
            required: true,
            placeholder: 'e.g., Box A, Drawer 1',
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
        isPending={createContainer.isPending}
      />

      {/* Edit Modal */}
      <Modal
        isOpen={!!containerId && !!editingContainer}
        onClose={closeEditModal}
        title="Edit Container"
      >
        <form onSubmit={handleEdit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Container Name *</Label>
            <Input
              id="edit-name"
              type="text"
              value={editFormData.name}
              onChange={(e) =>
                setEditFormData({ ...editFormData, name: e.target.value })
              }
              required
              placeholder="e.g., Box A, Drawer 1"
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

          {editingContainer && (
            <div>
              <PhotoGallery
                entityType="container"
                entityId={editingContainer.id}
              />
              <PhotoUpload
                entityType="container"
                entityId={editingContainer.id}
                onUploadComplete={() => {
                  // Photos will refresh automatically via React Query
                }}
              />
            </div>
          )}

          <div className="flex gap-3 pt-4 border-t border-border">
            <Button
              type="submit"
              disabled={updateContainer.isPending}
              className="flex-1"
            >
              {updateContainer.isPending ? 'Saving...' : 'Save Changes'}
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
      {moveModalContainer && (
        <MoveModal
          isOpen={!!moveModalContainer}
          onClose={() => setMoveModalContainer(null)}
          title="Move Container"
          entityName={moveModalContainer.name}
          locationTypes={[
            { type: 'room', label: 'Target Room', displayName: 'In Room' },
            { type: 'shelf', label: 'Target Shelf', displayName: 'On Shelf' },
            { type: 'container', label: 'Parent Container', displayName: 'Inside Container' },
          ]}
          onMove={handleMove}
          isPending={moveContainer.isPending}
        />
      )}

      {/* Containers Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {containers.length === 0 ? (
          <p className="col-span-full text-center py-12 text-muted-foreground">
            {shelfId || parentId
              ? 'No containers yet. Click "Add Container" to create your first container.'
              : 'No containers found.'}
          </p>
        ) : (
          containers.map((container) => (
            <ContainerCard
              key={container.id}
              container={container}
              onEdit={() => openEditModal(container.id)}
              onDelete={() => handleDelete(container.id, container.name)}
              onMove={() => setMoveModalContainer(container)}
              updateContainerPending={updateContainer.isPending}
              deleteContainerPending={deleteContainer.isPending}
              moveContainerPending={moveContainer.isPending}
            />
          ))
        )}
      </div>

      {/* Pagination */}
      {containersResponse && containersResponse.total > 0 && (
        <Pagination
          total={containersResponse.total}
          limit={containersResponse.limit}
          offset={containersResponse.offset}
          onPageChange={(newOffset) => setPagination({ ...pagination, offset: newOffset })}
        />
      )}
    </div>
  );
}
