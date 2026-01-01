import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  useContainers,
  useContainersByShelf,
  useContainersByParent,
  useCreateContainer,
  useUpdateContainer,
  useDeleteContainer,
  useShelf,
  useContainer,
  useShelvingUnit,
  useRoom,
  usePhotos,
} from '../hooks';
import { Modal, PhotoUpload, PhotoGallery } from '../components';
import type {
  CreateContainerRequest,
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
  const { data: allContainers, isLoading: isLoadingAll } = useContainers();
  const { data: shelfContainers, isLoading: isLoadingShelf } =
    useContainersByShelf(shelfId || '');
  const { data: parentContainers, isLoading: isLoadingParent } =
    useContainersByParent(parentId || '');

  const containers =
    context === 'shelf'
      ? shelfContainers
      : context === 'parent'
        ? parentContainers
        : allContainers;
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

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [locationType, setLocationType] = useState<'shelf' | 'container'>(
    shelfId ? 'shelf' : 'container'
  );
  const [createFormData, setCreateFormData] = useState<CreateContainerRequest>({
    shelf_id: shelfId,
    parent_container_id: undefined,
    name: '',
    description: '',
  });
  const [editFormData, setEditFormData] = useState<UpdateContainerRequest>({
    name: '',
    description: '',
  });

  // Update create form when context changes
  useEffect(() => {
    if (shelfId) {
      setLocationType('shelf');
      setCreateFormData((prev) => ({
        ...prev,
        shelf_id: shelfId,
        parent_container_id: undefined,
      }));
    } else if (parentId) {
      setLocationType('container');
      setCreateFormData((prev) => ({
        ...prev,
        shelf_id: undefined,
        parent_container_id: parentId,
      }));
    }
  }, [shelfId, parentId]);

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

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    // Validate location constraint
    if (
      (!createFormData.shelf_id && !createFormData.parent_container_id) ||
      (createFormData.shelf_id && createFormData.parent_container_id)
    ) {
      alert('Please select either a shelf or a parent container (not both)');
      return;
    }
    try {
      await createContainer.mutateAsync(createFormData);
      setCreateFormData({
        shelf_id: shelfId,
        parent_container_id: parentId,
        name: '',
        description: '',
      });
      setShowCreateModal(false);
    } catch (err) {
      console.error('Failed to create container:', err);
      alert('Failed to create container. Please try again.');
    }
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
    setCreateFormData({
      shelf_id: shelfId,
      parent_container_id: parentId,
      name: '',
      description: '',
    });
  };

  if (isLoading) return <div className="loading">Loading containers...</div>;

  // Container card component with photos
  function ContainerCard({
    container,
    onEdit,
    onDelete,
    updateContainerPending,
    deleteContainerPending,
  }: {
    container: ContainerResponse;
    onEdit: () => void;
    onDelete: () => void;
    updateContainerPending: boolean;
    deleteContainerPending: boolean;
  }) {
    const { data: photos } = usePhotos('container', container.id);
    const firstPhoto = photos && photos.length > 0 ? photos[0] : null;

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
        <div className="card-actions" style={{ marginTop: '0.5rem' }}>
          <Link
            to={`/containers/${container.id}/children`}
            className="btn btn-secondary btn-sm"
          >
            View Contents
          </Link>
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
        {(shelfId || parentId) && (
          <button className="btn btn-primary" onClick={openCreateModal}>
            Add Container
          </button>
        )}
      </div>

      {/* Create Modal */}
      {(shelfId || parentId) && (
        <Modal
          isOpen={showCreateModal}
          onClose={closeCreateModal}
          title="Create New Container"
        >
          <form onSubmit={handleCreate}>
            <div className="form-group">
              <label>Location Type</label>
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                <label>
                  <input
                    type="radio"
                    value="shelf"
                    checked={locationType === 'shelf'}
                    onChange={(e) => {
                      setLocationType('shelf');
                      setCreateFormData({
                        ...createFormData,
                        shelf_id: shelfId,
                        parent_container_id: undefined,
                      });
                    }}
                    disabled={!shelfId}
                  />
                  {' '}On Shelf
                </label>
                <label>
                  <input
                    type="radio"
                    value="container"
                    checked={locationType === 'container'}
                    onChange={(e) => {
                      setLocationType('container');
                      setCreateFormData({
                        ...createFormData,
                        shelf_id: undefined,
                        parent_container_id: parentId,
                      });
                    }}
                    disabled={!parentId}
                  />
                  {' '}Inside Container
                </label>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="create-name">Container Name *</label>
              <input
                id="create-name"
                type="text"
                value={createFormData.name}
                onChange={(e) =>
                  setCreateFormData({ ...createFormData, name: e.target.value })
                }
                required
                placeholder="e.g., Box A, Drawer 1"
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
                disabled={createContainer.isPending}
              >
                {createContainer.isPending ? 'Creating...' : 'Create Container'}
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
      )}

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

      {/* Containers Grid */}
      <div className="rooms-grid">
        {containers?.length === 0 ? (
          <p className="empty-state">
            {shelfId || parentId
              ? 'No containers yet. Click "Add Container" to create your first container.'
              : 'No containers found.'}
          </p>
        ) : (
          containers?.map((container) => (
            <ContainerCard
              key={container.id}
              container={container}
              onEdit={() => openEditModal(container.id)}
              onDelete={() => handleDelete(container.id, container.name)}
              updateContainerPending={updateContainer.isPending}
              deleteContainerPending={deleteContainer.isPending}
            />
          ))
        )}
      </div>
    </div>
  );
}
