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
import { EntityCreateModal, MoveModal, MultiImageAnalyzer, Modal } from '../components';
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
      } catch (err) {
        alert('Failed to delete container. It may have nested containers or items.');
      }
    }
  };
  
  const handleDeleteItem = async (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete item "${name}"?`)) {
      try {
        await deleteItem.mutateAsync(id);
      } catch (err) {
        alert('Failed to delete item.');
      }
    }
  };
  
  const handleCreateItem = async (data: Record<string, any>) => {
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
  
  if (isLoading) return <div className="loading">Loading contents...</div>;
  
  if (!parentContainer) {
    return (
      <div className="page">
        <div className="error">Container not found</div>
      </div>
    );
  }
  
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <nav className="breadcrumb">
            <Link to="/containers">Containers</Link>
            {' → '}
            <Link to={`/containers/${parentContainer.id}`}>{parentContainer.name}</Link>
            {' → '}
            <span>Contents</span>
          </nav>
          <h1>Contents of {parentContainer.name}</h1>
          {parentContainer.description && (
            <p className="description">{parentContainer.description}</p>
          )}
        </div>
        <div className="header-actions" style={{ display: 'flex', gap: '1rem' }}>
          <button
            className="btn btn-primary"
            onClick={() => setShowCreateContainerModal(true)}
          >
            Add Container
          </button>
          <button
            className="btn btn-primary"
            onClick={() => setShowCreateItemModal(true)}
          >
            Add Item
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => setShowMultiImageAnalyzer(true)}
          >
            🤖 AI Import (Multiple Photos)
          </button>
        </div>
      </div>
      
      {/* Child Containers Section */}
      {childContainers.length > 0 && (
        <div className="section">
          <h2>Containers ({childContainersResponse?.total || 0})</h2>
          <div className="grid-container">
            {childContainers.map((container) => (
              <div key={container.id} className="entity-card">
                <div className="card-header">
                  <h3>
                    <Link to={`/containers/${container.id}/children`}>
                      {container.name}
                    </Link>
                  </h3>
                  <div className="card-actions">
                    <Link 
                      to={`/containers/${parentContainer.id}/children/${container.id}/edit`}
                      className="btn btn-secondary btn-sm"
                    >
                      Edit
                    </Link>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => setMoveModalContainer(container)}
                    >
                      Move
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleDeleteContainer(container.id, container.name)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
                {container.description && (
                  <p className="description">{container.description}</p>
                )}
              </div>
            ))}
          </div>
          
          {childContainersResponse && childContainersResponse.total > childContainers.length && (
            <div className="load-more">
              <button
                className="btn btn-secondary"
                onClick={() => setContainerPagination(prev => ({
                  ...prev,
                  offset: prev.offset + prev.limit
                }))}
              >
                Load More Containers
              </button>
            </div>
          )}
        </div>
      )}
      
      {/* Items Section */}
      {items.length > 0 && (
        <div className="section">
          <h2>Items ({itemsResponse?.total || 0})</h2>
          <div className="grid-container">
            {items.map((item) => (
              <div key={item.id} className="entity-card">
                <div className="card-header">
                  <h3>
                    <Link to={`/items/${item.id}`}>
                      {item.name}
                    </Link>
                  </h3>
                  <div className="card-actions">
                    <Link 
                      to={`/containers/${parentContainer.id}/items/${item.id}/edit`}
                      className="btn btn-secondary btn-sm"
                    >
                      Edit
                    </Link>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => setMoveModalItem(item)}
                    >
                      Move
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleDeleteItem(item.id, item.name)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
                {item.description && (
                  <p className="description">{item.description}</p>
                )}
                {item.barcode && (
                  <div className="item-meta">
                    <small>Barcode: {item.barcode}</small>
                  </div>
                )}
              </div>
            ))}
          </div>
          
          {itemsResponse && itemsResponse.total > items.length && (
            <div className="load-more">
              <button
                className="btn btn-secondary"
                onClick={() => setItemPagination(prev => ({
                  ...prev,
                  offset: prev.offset + prev.limit
                }))}
              >
                Load More Items
              </button>
            </div>
          )}
        </div>
      )}
      
      {/* Empty state */}
      {childContainers.length === 0 && items.length === 0 && (
        <div className="empty-state">
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
