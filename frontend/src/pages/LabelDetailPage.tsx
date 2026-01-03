import { useEffect, useCallback, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useLabel, useAssignLabel, useCreateRoom, useCreateShelvingUnit, useCreateShelf, useCreateContainer, useCreateItem } from '../hooks';
import { useToast } from '../context/ToastContext';
import { Modal } from '../components';
import type { AssignLabelRequest, CreateRoomRequest, CreateShelvingUnitRequest, CreateShelfRequest, CreateContainerRequest, CreateItemRequest } from '../types/generated';

export default function LabelDetailPage() {
  const { labelId } = useParams<{ labelId: string }>();
  const { data: label, isLoading, error } = useLabel(labelId || '');
  const assignLabel = useAssignLabel();
  const navigate = useNavigate();
  const toast = useToast();
  
  const createRoom = useCreateRoom();
  const createUnit = useCreateShelvingUnit();
  const createShelf = useCreateShelf();
  const createContainer = useCreateContainer();
  const createItem = useCreateItem();
  
  const [selectedEntityType, setSelectedEntityType] = useState<string | null>(null);
  const [formData, setFormData] = useState<{
    name: string;
    description: string;
    [key: string]: string | undefined;
  }>({ name: '', description: '' });

  const getAssignedEntityLink = useCallback((type: string, id: string): string | null => {
    switch (type) {
      case 'room':
        return `/rooms/${id}/edit`;
      case 'unit':
        return `/units/${id}/edit`;
      case 'shelf':
        return `/shelves/${id}/edit`;
      case 'container':
        return `/containers/${id}/edit`;
      case 'item':
        return `/items/${id}/edit`;
      default:
        return null;
    }
  }, []);

  // Auto-redirect if label is assigned
  useEffect(() => {
    if (label?.assigned_to_type && label?.assigned_to_id) {
      const link = getAssignedEntityLink(label.assigned_to_type, label.assigned_to_id);
      if (link) {
        navigate(link, { replace: true });
      }
    }
  }, [label, navigate, getAssignedEntityLink]);

  const capitalize = (str: string): string => {
    return str.charAt(0).toUpperCase() + str.slice(1);
  };

  const getEntityTypeDisplayName = (type: string): string => {
    switch (type) {
      case 'room':
        return 'Room';
      case 'unit':
        return 'Shelving Unit';
      case 'shelf':
        return 'Shelf';
      case 'container':
        return 'Container';
      case 'item':
        return 'Item';
      default:
        return type;
    }
  };

  const handleEntityTypeClick = (entityType: string) => {
    if (!label) return;
    
    const displayName = getEntityTypeDisplayName(entityType);
    const prefillName = `${displayName} ${label.number}`;
    
    setSelectedEntityType(entityType);
    setFormData({
      name: prefillName,
      description: '',
    });
  };

  const handleCreateAndAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!labelId || !selectedEntityType || !label) return;

    try {
      let createdEntityId: string;

      // Create the entity based on type
      switch (selectedEntityType) {
        case 'room': {
          const payload: CreateRoomRequest = {
            name: formData.name,
            description: formData.description || undefined,
          };
          const room = await createRoom.mutateAsync(payload);
          createdEntityId = room.id;
          break;
        }
        case 'unit': {
          if (!formData.room_id) {
            toast.showError('Room ID is required for shelving units');
            return;
          }
          const payload: CreateShelvingUnitRequest = {
            name: formData.name,
            description: formData.description || undefined,
            room_id: formData.room_id,
          };
          const unit = await createUnit.mutateAsync(payload);
          createdEntityId = unit.id;
          break;
        }
        case 'shelf': {
          const payload: CreateShelfRequest = {
            name: formData.name,
            description: formData.description || undefined,
            position: formData.position ? parseInt(formData.position, 10) : undefined,
            shelving_unit_id: formData.shelving_unit_id,
          };
          const shelf = await createShelf.mutateAsync(payload);
          createdEntityId = shelf.id;
          break;
        }
        case 'container': {
          const payload: CreateContainerRequest = {
            name: formData.name,
            description: formData.description || undefined,
            shelf_id: formData.shelf_id,
            parent_container_id: formData.parent_container_id,
          };
          const container = await createContainer.mutateAsync(payload);
          createdEntityId = container.id;
          break;
        }
        case 'item': {
          const payload: CreateItemRequest = {
            name: formData.name,
            description: formData.description || undefined,
            barcode: formData.barcode,
            barcode_type: formData.barcode_type,
            shelf_id: formData.shelf_id,
            container_id: formData.container_id,
          };
          const item = await createItem.mutateAsync(payload);
          createdEntityId = item.id;
          break;
        }
        default:
          throw new Error(`Unknown entity type: ${selectedEntityType}`);
      }

      // Assign the label to the newly created entity
      const assignPayload: AssignLabelRequest = {
        assigned_to_type: selectedEntityType,
        assigned_to_id: createdEntityId,
      };

      await assignLabel.mutateAsync({ id: labelId, data: assignPayload });
      toast.showSuccess(`${getEntityTypeDisplayName(selectedEntityType)} created and label assigned!`);
      
      // Navigate to the assigned entity
      const link = getAssignedEntityLink(selectedEntityType, createdEntityId);
      if (link) {
        navigate(link);
      }
    } catch (err) {
      toast.showError(`Failed to create ${getEntityTypeDisplayName(selectedEntityType)}. Please try again.`);
      console.error('Failed to create entity:', err);
    }
  };

  const closeModal = () => {
    setSelectedEntityType(null);
    setFormData({ name: '', description: '' });
  };

  if (isLoading) {
    return (
      <div className="page">
        <div className="loading">Loading label...</div>
      </div>
    );
  }

  if (error || !label) {
    return (
      <div className="page">
        <div className="error">
          {error ? `Error: ${error.message}` : 'Label not found'}
        </div>
        <Link to="/labels" className="btn btn-primary" style={{ marginTop: '1rem' }}>
          Back to Labels
        </Link>
      </div>
    );
  }

  // If assigned, show redirecting message (should redirect via useEffect)
  if (label.assigned_to_type && label.assigned_to_id) {
    return (
      <div className="page">
        <div className="loading">Redirecting to {label.assigned_to_type}...</div>
      </div>
    );
  }

  // Unassigned label - show assignment interface
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
            <Link to="/labels" className="btn btn-secondary btn-sm">
              ← Back
            </Link>
            <h1 style={{ margin: 0 }}>Label #{label.number}</h1>
          </div>
          <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
            <div>
              <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Label ID:</span>
              <br />
              <code style={{ fontSize: '0.875rem', background: 'var(--bg-color)', padding: '0.25rem 0.5rem', borderRadius: '0.25rem' }}>
                {label.id.substring(0, 8)}...
              </code>
            </div>
            <div>
              <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Status:</span>
              <br />
              <span style={{ fontSize: '0.875rem', fontStyle: 'italic', color: 'var(--text-secondary)' }}>
                Unassigned
              </span>
            </div>
            {label.batch_id && (
              <div>
                <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Batch:</span>
                <br />
                <Link
                  to={`/labels/batches/${label.batch_id}`}
                  style={{ fontSize: '0.875rem', color: 'var(--primary-color)' }}
                >
                  View Batch
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="form">
        <h2 style={{ marginBottom: '1.5rem' }}>Create and Assign Label</h2>
        <p style={{ marginBottom: '2rem', color: 'var(--text-secondary)' }}>
          This label is not yet assigned. Create a new entity and assign this label to it:
        </p>

        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '2rem' }}>
          <button
            className="btn btn-primary"
            onClick={() => handleEntityTypeClick('room')}
            disabled={createRoom.isPending}
          >
            Create Room
          </button>
          <button
            className="btn btn-primary"
            onClick={() => handleEntityTypeClick('unit')}
            disabled={createUnit.isPending}
          >
            Create Shelving Unit
          </button>
          <button
            className="btn btn-primary"
            onClick={() => handleEntityTypeClick('shelf')}
            disabled={createShelf.isPending}
          >
            Create Shelf
          </button>
          <button
            className="btn btn-primary"
            onClick={() => handleEntityTypeClick('container')}
            disabled={createContainer.isPending}
          >
            Create Container
          </button>
          <button
            className="btn btn-primary"
            onClick={() => handleEntityTypeClick('item')}
            disabled={createItem.isPending}
          >
            Create Item
          </button>
        </div>

        <div style={{ marginTop: '2rem', padding: '1rem', background: 'var(--bg-color)', borderRadius: '0.5rem' }}>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0 }}>
            <strong>Note:</strong> After creating and assigning, scanning this label will automatically navigate to the created entity.
          </p>
        </div>
      </div>

      {/* Create Entity Modal */}
      {selectedEntityType && (
        <Modal
          isOpen={true}
          onClose={closeModal}
          title={`Create ${getEntityTypeDisplayName(selectedEntityType)}`}
        >
          <form onSubmit={handleCreateAndAssign} className="form">
            <div className="form-group">
              <label htmlFor="name">Name</label>
              <input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                autoFocus
              />
            </div>

            <div className="form-group">
              <label htmlFor="description">Description (optional)</label>
              <textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>

            {/* Additional fields based on entity type */}
            {selectedEntityType === 'unit' && (
              <div className="form-group">
                <label htmlFor="room_id">Room ID (required)</label>
                <input
                  id="room_id"
                  type="text"
                  value={formData.room_id || ''}
                  onChange={(e) => setFormData({ ...formData, room_id: e.target.value })}
                  placeholder="Enter room UUID"
                  required
                />
              </div>
            )}

            {selectedEntityType === 'shelf' && (
              <>
                <div className="form-group">
                  <label htmlFor="shelving_unit_id">Shelving Unit ID (required)</label>
                  <input
                    id="shelving_unit_id"
                    type="text"
                    value={formData.shelving_unit_id || ''}
                    onChange={(e) => setFormData({ ...formData, shelving_unit_id: e.target.value })}
                    placeholder="Enter shelving unit UUID"
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="position">Position (optional)</label>
                  <input
                    id="position"
                    type="number"
                    value={formData.position || ''}
                    onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                    placeholder="Shelf position"
                  />
                </div>
              </>
            )}

            {selectedEntityType === 'container' && (
              <>
                <div className="form-group">
                  <label htmlFor="shelf_id">Shelf ID (optional)</label>
                  <input
                    id="shelf_id"
                    type="text"
                    value={formData.shelf_id || ''}
                    onChange={(e) => setFormData({ ...formData, shelf_id: e.target.value })}
                    placeholder="Enter shelf UUID"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="parent_container_id">Parent Container ID (optional)</label>
                  <input
                    id="parent_container_id"
                    type="text"
                    value={formData.parent_container_id || ''}
                    onChange={(e) => setFormData({ ...formData, parent_container_id: e.target.value })}
                    placeholder="Enter parent container UUID"
                  />
                </div>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '-0.5rem', marginBottom: '1rem' }}>
                  Note: Provide either shelf_id OR parent_container_id, not both
                </p>
              </>
            )}

            {selectedEntityType === 'item' && (
              <>
                <div className="form-group">
                  <label htmlFor="shelf_id">Shelf ID (optional)</label>
                  <input
                    id="shelf_id"
                    type="text"
                    value={formData.shelf_id || ''}
                    onChange={(e) => setFormData({ ...formData, shelf_id: e.target.value })}
                    placeholder="Enter shelf UUID"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="container_id">Container ID (optional)</label>
                  <input
                    id="container_id"
                    type="text"
                    value={formData.container_id || ''}
                    onChange={(e) => setFormData({ ...formData, container_id: e.target.value })}
                    placeholder="Enter container UUID"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="barcode">Barcode (optional)</label>
                  <input
                    id="barcode"
                    type="text"
                    value={formData.barcode || ''}
                    onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                    placeholder="Product barcode"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="barcode_type">Barcode Type (optional)</label>
                  <input
                    id="barcode_type"
                    type="text"
                    value={formData.barcode_type || ''}
                    onChange={(e) => setFormData({ ...formData, barcode_type: e.target.value })}
                    placeholder="e.g., UPC, EAN"
                  />
                </div>
              </>
            )}

            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={
                  createRoom.isPending ||
                  createUnit.isPending ||
                  createShelf.isPending ||
                  createContainer.isPending ||
                  createItem.isPending ||
                  assignLabel.isPending
                }
              >
                {assignLabel.isPending ? 'Creating...' : `Create ${getEntityTypeDisplayName(selectedEntityType)}`}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={closeModal}
                disabled={
                  createRoom.isPending ||
                  createUnit.isPending ||
                  createShelf.isPending ||
                  createContainer.isPending ||
                  createItem.isPending ||
                  assignLabel.isPending
                }
              >
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
