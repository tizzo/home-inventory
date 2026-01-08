import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import {
  useContainers,
  useContainersByShelf,
  useContainersByParent,
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
} from '../hooks';
import { Modal, PhotoUpload, PhotoGallery, Pagination, MoveModal, EntityCreateModal, ImportItemsFromPhoto } from '../components';
import type { EntityType } from '../components/EntitySelector';
import type {
  UpdateContainerRequest,
  ContainerResponse,
} from '../types/generated';

export default function ContainersPage() {
  const navigate = useNavigate();
  const { shelfId, containerId, parentId } = useParams<{
    shelfId?: string;
    containerId?: string;
    parentId?: string;
  }>();

  // Determine context and fetch appropriate data
  const context = shelfId ? 'shelf' : parentId ? 'parent' : 'all';
  const [pagination, setPagination] = useState({ limit: 50, offset: 0 });
  const { data: allContainersResponse, isLoading: isLoadingAll } = useContainers(pagination);
  const { data: shelfContainersResponse, isLoading: isLoadingShelf } =
    useContainersByShelf(shelfId || '', pagination);
  const { data: parentContainersResponse, isLoading: isLoadingParent } =
    useContainersByParent(parentId || '', pagination);

  const allContainers = allContainersResponse?.data || [];
  const shelfContainers = shelfContainersResponse?.data || [];
  const parentContainers = parentContainersResponse?.data || [];

  const containers =
    context === 'shelf'
      ? shelfContainers
      : context === 'parent'
        ? parentContainers
        : allContainers;
  const containersResponse =
    context === 'shelf'
      ? shelfContainersResponse
      : context === 'parent'
        ? parentContainersResponse
        : allContainersResponse;
  const isLoading =
    context === 'shelf'
      ? isLoadingShelf
      : context === 'parent'
        ? isLoadingParent
        : isLoadingAll;

  // Fetch context data for breadcrumbs
  const { data: shelf } = useShelf(shelfId || '');
  const { data: parentContainer } = useContainer(parentId || '');
  const { data: unit } = useShelvingUnit(shelf?.shelving_unit_id || '');
  const { data: room } = useRoom(unit?.room_id || '');

  const createContainer = useCreateContainer();
  const updateContainer = useUpdateContainer();
  const deleteContainer = useDeleteContainer();
  const moveContainer = useMoveContainer();
  const { showSuccess } = useToast();

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

  const handleCreate = async (data: Record<string, any>) => {
    await createContainer.mutateAsync({
      shelf_id: data.shelf_id,
      parent_container_id: data.container_id,
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
    } else {
      navigate(`/containers/${id}/edit`);
    }
  };

  const closeEditModal = () => {
    if (shelfId) {
      navigate(`/shelves/${shelfId}/containers`);
    } else if (parentId) {
      navigate(`/containers/${parentId}/children`);
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

  if (isLoading) return <div className="loading">Loading containers...</div>;

  const handleMove = async (targetId: string, selectedType?: EntityType) => {
    if (!moveModalContainer) return;

    await moveContainer.mutateAsync({
      containerId: moveModalContainer.id,
      data: {
        target_shelf_id: selectedType === 'shelf' ? targetId : undefined,
        target_parent_id: selectedType === 'container' ? targetId : undefined,
      },
    });
    showSuccess(`Container "${moveModalContainer.name}" moved successfully`);
  };

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
  ) {
    const { data: photos } = usePhotos('container', container.id);
    const { data: itemsData } = useItemsByContainer(container.id, { limit: 5, offset: 0 });
    const { data: childContainers } = useContainersByParent(container.id, { limit: 5, offset: 0 });
    const firstPhoto = photos && photos.length > 0 ? photos[0] : null;
    const itemCount = itemsData?.total || 0;
    const containerCount = childContainers?.total || 0;

    return (
      <div className="room-card">
        <div className="card-header">
          <h3>{container.name}</h3>
          <div className="card-actions">
            <button
              className="btn btn-secondary btn-sm"
              onClick={onEdit}
              disabled={updateContainerPending}
            >
              Edit
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={onMove}
              disabled={moveContainerPending}
            >
              Move
            </button>
            <button
              className="btn btn-danger btn-sm"
              onClick={onDelete}
              disabled={deleteContainerPending}
            >
              Delete
            </button>
          </div>
        </div>
        {firstPhoto && (
          <div className="room-photo-preview">
            <img
              src={firstPhoto.thumbnail_url || firstPhoto.url}
              alt={container.name}
              onClick={() => window.open(firstPhoto.url, '_blank')}
              loading="lazy"
            />
            {photos && photos.length > 1 && (
              <div className="photo-count-badge">+{photos.length - 1}</div>
            )}
          </div>
        )}
        {container.description && (
          <p className="room-description">{container.description}</p>
        )}
        <div className="room-meta">
          <small>
            Created: {new Date(container.created_at).toLocaleDateString()}
          </small>
          {container.updated_at !== container.created_at && (
            <>
              {' • '}
              <small>
                Updated: {new Date(container.updated_at).toLocaleDateString()}
              </small>
            </>
          )}
        </div>
        <div className="content-summary" style={{ marginTop: '0.5rem', marginBottom: '0.5rem' }}>
          <small style={{ color: '#666' }}>
            {itemCount > 0 && containerCount > 0 && (
              <>{itemCount} items • {containerCount} containers</>
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
          </small>
        </div>
        <div className="card-actions" style={{ marginTop: '0.5rem', gap: '0.5rem' }}>
          <Link
            to={`/containers/${container.id}/children`}
            className="btn btn-secondary btn-sm"
          >
            View Contents
          </Link>
          <ImportItemsFromPhoto containerId={container.id} />
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          {room && unit && shelf && (
            <nav className="breadcrumb">
              <Link to="/rooms">Rooms</Link>
              {' → '}
              <Link to={`/rooms/${room.id}`}>{room.name}</Link>
              {' → '}
              <Link to={`/units/${unit.id}`}>{unit.name}</Link>
              {' → '}
              <Link to={`/units/${unit.id}/shelves`}>Shelves</Link>
              {' → '}
              <span>{shelf.name}</span>
              {' → Containers'}
            </nav>
          )}
          {parentContainer && (
            <nav className="breadcrumb">
              <Link to="/containers">Containers</Link>
              {' → '}
              <span>{parentContainer.name}</span>
              {' → Containers'}
            </nav>
          )}
          <h1>
            {shelf
              ? `Containers in ${shelf.name}`
              : parentContainer
                ? `Containers in ${parentContainer.name}`
                : 'All Containers'}
          </h1>
        </div>
        <button className="btn btn-primary" onClick={openCreateModal}>
          Add Container
        </button>
      </div>

      {/* Create Modal */}
      <EntityCreateModal
        isOpen={showCreateModal}
        onClose={closeCreateModal}
        title="Create New Container"
        parentTypes={[
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
        <form onSubmit={handleEdit}>
          <div className="form-group">
            <label htmlFor="edit-name">Container Name *</label>
            <input
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

          {editingContainer && (
            <div className="form-group">
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

          <div className="form-actions">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={updateContainer.isPending}
            >
              {updateContainer.isPending ? 'Saving...' : 'Save Changes'}
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
      {moveModalContainer && (
        <MoveModal
          isOpen={!!moveModalContainer}
          onClose={() => setMoveModalContainer(null)}
          title="Move Container"
          entityName={moveModalContainer.name}
          locationTypes={[
            { type: 'shelf', label: 'Target Shelf', displayName: 'On Shelf' },
            { type: 'container', label: 'Parent Container', displayName: 'Inside Container' },
          ]}
          onMove={handleMove}
          isPending={moveContainer.isPending}
        />
      )}

      {/* Containers Grid */}
      <div className="rooms-grid">
        {containers.length === 0 ? (
          <p className="empty-state">
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
