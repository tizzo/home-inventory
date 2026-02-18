import { useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  useContainer,
  useContainersByParent,
  useItemsByContainer,
  useDeleteContainer,
  useDeleteItem,
  useCreateItem,
  useMoveContainer,
  useMoveItem,
} from '../hooks';
import { EntityCreateModal, MoveModal, MultiImageAnalyzer, Modal, Breadcrumb } from '../components';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { EntityType } from '../components/EntitySelector';
import type {
  ItemResponse,
  ContainerResponse,
} from '../types/generated';

export default function ContainerContentsPage() {
  const navigate = useNavigate();
  const { containerId } = useParams<{ containerId: string }>();

  // Pagination states
  const [containerPagination, setContainerPagination] = useState({ limit: 20, offset: 0 });
  const [itemPagination, setItemPagination] = useState({ limit: 20, offset: 0 });

  // Fetch data
  const { data: parentContainer, isLoading: isLoadingContainer } = useContainer(containerId || '');
  const { data: childContainersResponse, isLoading: isLoadingChildContainers } =
    useContainersByParent(containerId || '', containerPagination);
  const { data: itemsResponse, isLoading: isLoadingItems } =
    useItemsByContainer(containerId || '', itemPagination);

  const childContainers = childContainersResponse?.data || [];
  const items = itemsResponse?.data || [];

  // Mutations
  const deleteContainer = useDeleteContainer();
  const deleteItem = useDeleteItem();
  const createItem = useCreateItem();
  const moveContainer = useMoveContainer();
  const moveItem = useMoveItem();

  // Modal states
  const [showCreateItemModal, setShowCreateItemModal] = useState(false);
  const [showCreateContainerModal, setShowCreateContainerModal] = useState(false);
  const [showMultiImageAnalyzer, setShowMultiImageAnalyzer] = useState(false);
  const [moveModalContainer, setMoveModalContainer] = useState<ContainerResponse | null>(null);
  const [moveModalItem, setMoveModalItem] = useState<ItemResponse | null>(null);

  const isLoading = isLoadingContainer || isLoadingChildContainers || isLoadingItems;

  const handleDeleteContainer = async (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete container "${name}"?`)) {
      try {
        await deleteContainer.mutateAsync(id);
      } catch {
        alert('Failed to delete container. It may have nested containers or items.');
      }
    }
  };

  const handleDeleteItem = async (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete item "${name}"?`)) {
      try {
        await deleteItem.mutateAsync(id);
      } catch {
        alert('Failed to delete item.');
      }
    }
  };

  const handleCreateItem = async (data: Record<string, string>) => {
    await createItem.mutateAsync({
      shelf_id: data.shelf_id,
      container_id: data.container_id || containerId,
      name: data.name,
      description: data.description || '',
      barcode: data.barcode || '',
    });
    setShowCreateItemModal(false);
  };

  const handleMoveContainer = async (targetId: string, selectedType?: EntityType) => {
    if (!moveModalContainer) return;

    await moveContainer.mutateAsync({
      containerId: moveModalContainer.id,
      data: {
        target_shelf_id: selectedType === 'shelf' ? targetId : undefined,
        target_parent_id: selectedType === 'container' ? targetId : undefined,
      },
    });
    setMoveModalContainer(null);
  };

  const handleMoveItem = async (targetId: string, selectedType?: EntityType) => {
    if (!moveModalItem) return;

    await moveItem.mutateAsync({
      itemId: moveModalItem.id,
      data: {
        target_shelf_id: selectedType === 'shelf' ? targetId : undefined,
        target_container_id: selectedType === 'container' ? targetId : undefined,
      },
    });
    setMoveModalItem(null);
  };

  if (isLoading) return <div className="text-center py-12 text-muted-foreground">Loading contents...</div>;

  if (!parentContainer) {
    return (
      <div className="text-center py-12 text-destructive">Container not found</div>
    );
  }

  return (
    <div>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <Breadcrumb
            items={[
              { name: 'Containers', url: '/containers' },
              { name: parentContainer.name, url: `/containers/${parentContainer.id}` },
              { name: 'Contents' },
            ]}
          />
          <h1 className="text-2xl font-bold">Contents of {parentContainer.name}</h1>
          {parentContainer.description && (
            <p className="text-muted-foreground mt-1">{parentContainer.description}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setShowCreateContainerModal(true)}>
            Add Container
          </Button>
          <Button onClick={() => setShowCreateItemModal(true)}>
            Add Item
          </Button>
          <Button variant="secondary" onClick={() => setShowMultiImageAnalyzer(true)}>
            AI Import (Multiple Photos)
          </Button>
        </div>
      </div>

      {/* Child Containers Section */}
      {childContainers.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4">Containers ({childContainersResponse?.total || 0})</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {childContainers.map((container) => (
              <Card key={container.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start gap-2 mb-3">
                    <h3 className="font-semibold text-lg truncate flex-1">
                      <Link to={`/containers/${container.id}/children`} className="hover:text-primary">
                        {container.name}
                      </Link>
                    </h3>
                    <div className="flex gap-1 flex-shrink-0 flex-wrap justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                      >
                        <Link to={`/containers/${parentContainer.id}/children/${container.id}/edit`}>
                          Edit
                        </Link>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setMoveModalContainer(container)}
                      >
                        Move
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteContainer(container.id, container.name)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                  {container.description && (
                    <p className="text-muted-foreground text-sm line-clamp-2">{container.description}</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {childContainersResponse && childContainersResponse.total > childContainers.length && (
            <div className="mt-4 text-center">
              <Button
                variant="outline"
                onClick={() => setContainerPagination(prev => ({
                  ...prev,
                  offset: prev.offset + prev.limit
                }))}
              >
                Load More Containers
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Items Section */}
      {items.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4">Items ({itemsResponse?.total || 0})</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((item) => (
              <Card key={item.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start gap-2 mb-3">
                    <h3 className="font-semibold text-lg truncate flex-1">
                      <Link to={`/items/${item.id}`} className="hover:text-primary">
                        {item.name}
                      </Link>
                    </h3>
                    <div className="flex gap-1 flex-shrink-0 flex-wrap justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                      >
                        <Link to={`/containers/${parentContainer.id}/items/${item.id}/edit`}>
                          Edit
                        </Link>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setMoveModalItem(item)}
                      >
                        Move
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteItem(item.id, item.name)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                  {item.description && (
                    <p className="text-muted-foreground text-sm mb-2 line-clamp-2">{item.description}</p>
                  )}
                  {item.barcode && (
                    <div className="text-xs text-muted-foreground">
                      Barcode: {item.barcode}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {itemsResponse && itemsResponse.total > items.length && (
            <div className="mt-4 text-center">
              <Button
                variant="outline"
                onClick={() => setItemPagination(prev => ({
                  ...prev,
                  offset: prev.offset + prev.limit
                }))}
              >
                Load More Items
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {childContainers.length === 0 && items.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p>This container is empty.</p>
          <p>Add containers or items to organize your inventory.</p>
        </div>
      )}

      {/* Create Container Modal */}
      <EntityCreateModal
        isOpen={showCreateContainerModal}
        onClose={() => setShowCreateContainerModal(false)}
        title="Create New Container"
        parentTypes={[
          {
            type: 'container',
            label: 'Parent Container',
            displayName: 'Inside Container',
            preSelectedId: containerId,
            disabled: true,
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
        onSubmit={async () => {
          // Handle via containers page logic
          navigate(`/containers/${containerId}/children`);
        }}
        isPending={false}
      />

      {/* Create Item Modal */}
      <EntityCreateModal
        isOpen={showCreateItemModal}
        onClose={() => setShowCreateItemModal(false)}
        title="Create New Item"
        parentTypes={[
          {
            type: 'container',
            label: 'Container',
            displayName: 'In Container',
            preSelectedId: containerId,
            disabled: true,
          },
        ]}
        fields={[
          {
            name: 'name',
            label: 'Item Name',
            type: 'text',
            required: true,
            placeholder: 'e.g., Screwdriver Set',
          },
          {
            name: 'description',
            label: 'Description',
            type: 'textarea',
            placeholder: 'Optional description',
            rows: 3,
          },
          {
            name: 'barcode',
            label: 'Barcode',
            type: 'text',
            placeholder: 'Optional barcode',
          },
          {
            name: 'sku',
            label: 'SKU',
            type: 'text',
            placeholder: 'Optional SKU',
          },
        ]}
        onSubmit={handleCreateItem}
        isPending={createItem.isPending}
      />

      {/* Move Container Modal */}
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
          onMove={handleMoveContainer}
          isPending={moveContainer.isPending}
        />
      )}

      {/* Move Item Modal */}
      {moveModalItem && (
        <MoveModal
          isOpen={!!moveModalItem}
          onClose={() => setMoveModalItem(null)}
          title="Move Item"
          entityName={moveModalItem.name}
          locationTypes={[
            { type: 'shelf', label: 'Target Shelf', displayName: 'On Shelf' },
            { type: 'container', label: 'Target Container', displayName: 'In Container' },
          ]}
          onMove={handleMoveItem}
          isPending={moveItem.isPending}
        />
      )}

      {/* Multi-Image AI Analyzer Modal */}
      <Modal
        isOpen={showMultiImageAnalyzer}
        onClose={() => setShowMultiImageAnalyzer(false)}
        title="AI Item Import (Multiple Photos)"
      >
        <MultiImageAnalyzer
          locationType="container"
          locationId={containerId || ''}
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
