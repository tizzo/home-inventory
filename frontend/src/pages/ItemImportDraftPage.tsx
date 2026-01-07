import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import {
  useItemImportDraft,
  useUpdateItemImportDraft,
  useCommitItemImportDraft,
  useContainer,
} from '../hooks';
import type { ItemImportDraftItem } from '../types/generated';

export default function ItemImportDraftPage() {
  const navigate = useNavigate();
  const { draftId } = useParams<{ draftId: string }>();
  const { showError, showSuccess } = useToast();

  const { data: draft, isLoading, error } = useItemImportDraft(draftId || '');
  const { data: container } = useContainer(draft?.container_id || '');
  const updateDraft = useUpdateItemImportDraft();
  const commitDraft = useCommitItemImportDraft();

  const [editedItems, setEditedItems] = useState<ItemImportDraftItem[] | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  const displayItems = editedItems ?? draft?.items ?? [];

  const handleItemChange = (
    index: number,
    field: keyof ItemImportDraftItem,
    value: string
  ) => {
    const currentItems = editedItems ?? draft?.items ?? [];
    const updated = [...currentItems];
    updated[index] = { ...updated[index], [field]: value || undefined };
    setEditedItems(updated);
    setHasChanges(true);
  };

  const handleAddItem = () => {
    const currentItems = editedItems ?? draft?.items ?? [];
    setEditedItems([...currentItems, { name: '' }]);
    setHasChanges(true);
  };

  const handleRemoveItem = (index: number) => {
    const currentItems = editedItems ?? draft?.items ?? [];
    setEditedItems(currentItems.filter((_, i) => i !== index));
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!draftId) return;

    try {
      await updateDraft.mutateAsync({
        id: draftId,
        data: { items: displayItems },
      });
      setHasChanges(false);
      showSuccess('Draft saved');
    } catch {
      showError('Failed to save draft');
    }
  };

  const handleCommit = async () => {
    if (!draftId) return;

    if (hasChanges) {
      showError('Please save changes before committing');
      return;
    }

    try {
      const result = await commitDraft.mutateAsync(draftId);
      showSuccess(`Created ${result.created_items.length} items`);
      if (draft?.container_id) {
        navigate(`/containers/${draft.container_id}/items`);
      } else {
        navigate('/items');
      }
    } catch {
      showError('Failed to commit draft');
    }
  };

  const handleCancel = () => {
    if (draft?.container_id) {
      navigate(`/containers/${draft.container_id}/items`);
    } else {
      navigate('/items');
    }
  };

  if (isLoading) {
    return (
      <div className="page-container">
        <div className="loading">Loading draft...</div>
      </div>
    );
  }

  if (error || !draft) {
    return (
      <div className="page-container">
        <div className="error">
          {error?.message || 'Draft not found'}
        </div>
      </div>
    );
  }

  const isCommitted = draft.status === 'committed';

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Item Import Draft</h1>
        <div className="header-meta">
          <span className={`status-badge status-${draft.status}`}>
            {draft.status}
          </span>
          {container && (
            <span className="context-info">
              Container: {container.name}
            </span>
          )}
        </div>
      </div>

      <div className="draft-items-section">
        <div className="section-header">
          <h2>Proposed Items ({displayItems.length})</h2>
          {!isCommitted && (
            <button
              className="btn btn-secondary"
              onClick={handleAddItem}
            >
              + Add Item
            </button>
          )}
        </div>

        <div className="draft-items-list">
          {displayItems.map((item, index) => (
            <div key={index} className="draft-item-card">
              <div className="draft-item-fields">
                <div className="form-group">
                  <label>Name *</label>
                  <input
                    type="text"
                    value={item.name}
                    onChange={(e) =>
                      handleItemChange(index, 'name', e.target.value)
                    }
                    disabled={isCommitted}
                    placeholder="Item name"
                  />
                </div>

                <div className="form-group">
                  <label>Description</label>
                  <input
                    type="text"
                    value={item.description || ''}
                    onChange={(e) =>
                      handleItemChange(index, 'description', e.target.value)
                    }
                    disabled={isCommitted}
                    placeholder="Description (optional)"
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Barcode</label>
                    <input
                      type="text"
                      value={item.barcode || ''}
                      onChange={(e) =>
                        handleItemChange(index, 'barcode', e.target.value)
                      }
                      disabled={isCommitted}
                      placeholder="Barcode (optional)"
                    />
                  </div>

                  <div className="form-group">
                    <label>Barcode Type</label>
                    <input
                      type="text"
                      value={item.barcode_type || ''}
                      onChange={(e) =>
                        handleItemChange(index, 'barcode_type', e.target.value)
                      }
                      disabled={isCommitted}
                      placeholder="e.g., UPC, EAN"
                    />
                  </div>
                </div>
              </div>

              {!isCommitted && (
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => handleRemoveItem(index)}
                  title="Remove item"
                >
                  ✕
                </button>
              )}
            </div>
          ))}

          {displayItems.length === 0 && (
            <div className="empty-state">
              No items in this draft. Click "Add Item" to add one.
            </div>
          )}
        </div>
      </div>

      <div className="page-actions">
        <button className="btn btn-secondary" onClick={handleCancel}>
          {isCommitted ? 'Back' : 'Cancel'}
        </button>

        {!isCommitted && (
          <>
            <button
              className="btn btn-primary"
              onClick={handleSave}
              disabled={!hasChanges || updateDraft.isPending}
            >
              {updateDraft.isPending ? 'Saving...' : 'Save Changes'}
            </button>

            <button
              className="btn btn-success"
              onClick={handleCommit}
              disabled={
                hasChanges ||
                commitDraft.isPending ||
                displayItems.length === 0 ||
                displayItems.some((item) => !item.name.trim())
              }
            >
              {commitDraft.isPending ? 'Committing...' : 'Commit & Create Items'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
