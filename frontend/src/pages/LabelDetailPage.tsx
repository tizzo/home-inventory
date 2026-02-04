import { useEffect, useCallback, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useLabel, useAssignLabel, useCreateRoom, useCreateShelvingUnit, useCreateShelf, useCreateContainer, useCreateItem } from '../hooks';
import { useToast } from '../context/ToastContext';
import { Modal, PhotoUpload, EntitySelector } from '../components';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
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
  const [createdEntityId, setCreatedEntityId] = useState<string | null>(null);

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
            room_id: formData.room_id as string,
          };
          const unit = await createUnit.mutateAsync(payload);
          createdEntityId = unit.id;
          break;
        }
        case 'shelf': {
          if (!formData.shelving_unit_id) {
            toast.showError('Shelving Unit ID is required for shelves');
            return;
          }
          const payload: CreateShelfRequest = {
            name: formData.name,
            description: formData.description || undefined,
            position: formData.position ? parseInt(formData.position, 10) : undefined,
            shelving_unit_id: formData.shelving_unit_id as string,
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

      // Store created entity ID and keep modal open for photo upload
      setCreatedEntityId(createdEntityId);
    } catch (err) {
      toast.showError(`Failed to create ${getEntityTypeDisplayName(selectedEntityType)}. Please try again.`);
      console.error('Failed to create entity:', err);
    }
  };

  const closeModal = () => {
    setSelectedEntityType(null);
    setFormData({ name: '', description: '' });
    setCreatedEntityId(null);

    // Navigate to created entity if it exists
    if (createdEntityId && selectedEntityType) {
      const link = getAssignedEntityLink(selectedEntityType, createdEntityId);
      if (link) {
        navigate(link);
      }
    }
  };

  if (isLoading) {
    return (
      <div className="text-center py-12 text-muted-foreground">Loading label...</div>
    );
  }

  if (error || !label) {
    return (
      <div className="text-center py-12">
        <div className="text-destructive mb-4">
          {error ? `Error: ${error.message}` : 'Label not found'}
        </div>
        <Button asChild>
          <Link to="/labels">Back to Labels</Link>
        </Button>
      </div>
    );
  }

  // If assigned, show redirecting message (should redirect via useEffect)
  if (label.assigned_to_type && label.assigned_to_id) {
    return (
      <div className="text-center py-12 text-muted-foreground">Redirecting to {label.assigned_to_type}...</div>
    );
  }

  // Unassigned label - show assignment interface
  return (
    <div>
      {/* Page Header */}
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <Button variant="outline" size="sm" asChild>
            <Link to="/labels">← Back</Link>
          </Button>
          <h1 className="text-2xl font-bold">Label #{label.number}</h1>
        </div>

        <div className="flex flex-wrap gap-6 mb-4">
          <div>
            <span className="text-sm text-muted-foreground">Label ID:</span>
            <br />
            <code className="text-sm bg-muted px-2 py-0.5 rounded">
              {label.id.substring(0, 8)}...
            </code>
          </div>
          <div>
            <span className="text-sm text-muted-foreground">Status:</span>
            <br />
            <span className="text-sm italic text-muted-foreground">
              Unassigned
            </span>
          </div>
          {label.batch_id && (
            <div>
              <span className="text-sm text-muted-foreground">Batch:</span>
              <br />
              <Link
                to={`/labels/batches/${label.batch_id}`}
                className="text-sm text-primary hover:underline"
              >
                View Batch
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Create and Assign Section */}
      <Card>
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold mb-4">Create and Assign Label</h2>
          <p className="text-muted-foreground mb-6">
            This label is not yet assigned. Create a new entity and assign this label to it:
          </p>

          <div className="flex flex-wrap gap-3 mb-6">
            <Button
              onClick={() => handleEntityTypeClick('room')}
              disabled={createRoom.isPending}
            >
              Create Room
            </Button>
            <Button
              onClick={() => handleEntityTypeClick('unit')}
              disabled={createUnit.isPending}
            >
              Create Shelving Unit
            </Button>
            <Button
              onClick={() => handleEntityTypeClick('shelf')}
              disabled={createShelf.isPending}
            >
              Create Shelf
            </Button>
            <Button
              onClick={() => handleEntityTypeClick('container')}
              disabled={createContainer.isPending}
            >
              Create Container
            </Button>
            <Button
              onClick={() => handleEntityTypeClick('item')}
              disabled={createItem.isPending}
            >
              Create Item
            </Button>
          </div>

          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">
              <strong>Note:</strong> After creating and assigning, scanning this label will automatically navigate to the created entity.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Create Entity Modal */}
      {selectedEntityType && (
        <Modal
          isOpen={true}
          onClose={closeModal}
          title={`Create ${getEntityTypeDisplayName(selectedEntityType)}`}
        >
          <form onSubmit={handleCreateAndAssign} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>

            {/* Additional fields based on entity type */}
            {selectedEntityType === 'unit' && (
              <EntitySelector
                entityType="room"
                value={formData.room_id}
                onChange={(id) => setFormData({ ...formData, room_id: id })}
                required
                label="Room"
                placeholder="Search for a room..."
              />
            )}

            {selectedEntityType === 'shelf' && (
              <>
                <EntitySelector
                  entityType="unit"
                  value={formData.shelving_unit_id}
                  onChange={(id) => setFormData({ ...formData, shelving_unit_id: id })}
                  required
                  label="Shelving Unit"
                  placeholder="Search for a shelving unit..."
                />
                <div className="space-y-2">
                  <Label htmlFor="position">Position (optional)</Label>
                  <Input
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
                <EntitySelector
                  entityType="shelf"
                  value={formData.shelf_id}
                  onChange={(id) => setFormData({ ...formData, shelf_id: id, parent_container_id: undefined })}
                  label="Shelf (optional)"
                  placeholder="Search for a shelf..."
                />
                <EntitySelector
                  entityType="container"
                  value={formData.parent_container_id}
                  onChange={(id) => setFormData({ ...formData, parent_container_id: id, shelf_id: undefined })}
                  label="Parent Container (optional)"
                  placeholder="Search for a parent container..."
                />
                <p className="text-sm text-muted-foreground">
                  Note: Provide either shelf OR parent container, not both
                </p>
              </>
            )}

            {selectedEntityType === 'item' && (
              <>
                <EntitySelector
                  entityType="shelf"
                  value={formData.shelf_id}
                  onChange={(id) => setFormData({ ...formData, shelf_id: id, container_id: undefined })}
                  label="Shelf (optional)"
                  placeholder="Search for a shelf..."
                />
                <EntitySelector
                  entityType="container"
                  value={formData.container_id}
                  onChange={(id) => setFormData({ ...formData, container_id: id, shelf_id: undefined })}
                  label="Container (optional)"
                  placeholder="Search for a container..."
                />
                <p className="text-sm text-muted-foreground">
                  Note: Provide either shelf OR container, not both
                </p>
                <div className="space-y-2">
                  <Label htmlFor="barcode">Barcode (optional)</Label>
                  <Input
                    id="barcode"
                    type="text"
                    value={formData.barcode || ''}
                    onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                    placeholder="Product barcode"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="barcode_type">Barcode Type (optional)</Label>
                  <Input
                    id="barcode_type"
                    type="text"
                    value={formData.barcode_type || ''}
                    onChange={(e) => setFormData({ ...formData, barcode_type: e.target.value })}
                    placeholder="e.g., UPC, EAN"
                  />
                </div>
              </>
            )}

            {!createdEntityId && (
              <div className="flex gap-3 pt-4 border-t border-border">
                <Button
                  type="submit"
                  disabled={
                    createRoom.isPending ||
                    createUnit.isPending ||
                    createShelf.isPending ||
                    createContainer.isPending ||
                    createItem.isPending ||
                    assignLabel.isPending
                  }
                  className="flex-1"
                >
                  {assignLabel.isPending || createRoom.isPending || createUnit.isPending || createShelf.isPending || createContainer.isPending || createItem.isPending
                    ? 'Creating...'
                    : `Create ${getEntityTypeDisplayName(selectedEntityType)}`}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={closeModal}
                  disabled={
                    createRoom.isPending ||
                    createUnit.isPending ||
                    createShelf.isPending ||
                    createContainer.isPending ||
                    createItem.isPending ||
                    assignLabel.isPending
                  }
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            )}

            {createdEntityId && (
              <>
                <div className="mt-6 p-4 bg-muted rounded-lg">
                  <h3 className="font-semibold mb-4">Upload Photo (Optional)</h3>
                  <PhotoUpload
                    entityType={selectedEntityType === 'unit' ? 'shelving_unit' : selectedEntityType}
                    entityId={createdEntityId}
                    onUploadComplete={() => {
                      toast.showSuccess('Photo uploaded successfully!');
                    }}
                    onError={(error) => {
                      toast.showError(`Failed to upload photo: ${error.message}`);
                    }}
                  />
                </div>
                <div className="flex gap-3 pt-4 border-t border-border">
                  <Button
                    type="button"
                    onClick={closeModal}
                    className="flex-1"
                  >
                    Done
                  </Button>
                </div>
              </>
            )}
          </form>
        </Modal>
      )}
    </div>
  );
}
