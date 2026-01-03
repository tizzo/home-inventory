import { useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useLabel, useAssignLabel } from '../hooks';
import { useToast } from '../context/ToastContext';
import type { AssignLabelRequest } from '../types/generated';

export default function LabelDetailPage() {
  const { labelId } = useParams<{ labelId: string }>();
  const { data: label, isLoading, error } = useLabel(labelId || '');
  const assignLabel = useAssignLabel();
  const navigate = useNavigate();
  const toast = useToast();

  // Auto-redirect if label is assigned
  useEffect(() => {
    if (label?.assigned_to_type && label?.assigned_to_id) {
      const link = getAssignedEntityLink(label.assigned_to_type, label.assigned_to_id);
      if (link) {
        navigate(link, { replace: true });
      }
    }
  }, [label, navigate]);

  const getAssignedEntityLink = (type: string, id: string): string | null => {
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
  };

  const handleAssign = async (entityType: string, entityId: string) => {
    if (!labelId) return;

    try {
      const payload: AssignLabelRequest = {
        assigned_to_type: entityType,
        assigned_to_id: entityId,
      };

      await assignLabel.mutateAsync({ id: labelId, data: payload });
      toast.showSuccess('Label assigned successfully!');
      
      // Navigate to the assigned entity
      const link = getAssignedEntityLink(entityType, entityId);
      if (link) {
        navigate(link);
      }
    } catch (err) {
      toast.showError('Failed to assign label. Please try again.');
      console.error('Failed to assign label:', err);
    }
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
        <h2 style={{ marginBottom: '1.5rem' }}>Assign Label</h2>
        <p style={{ marginBottom: '2rem', color: 'var(--text-secondary)' }}>
          This label is not yet assigned. Choose an entity to assign it to:
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
              Entity Type
            </label>
            <select
              id="entity-type"
              style={{ width: '100%', padding: '0.5rem', fontSize: '1rem' }}
              onChange={(e) => {
                const type = e.target.value;
                if (type) {
                  // For now, we'll need entity selection UI
                  // This is a simplified version - you might want a more sophisticated picker
                  const entityId = prompt(`Enter the ${type} ID to assign this label to:`);
                  if (entityId) {
                    handleAssign(type, entityId);
                  }
                }
              }}
            >
              <option value="">Select entity type...</option>
              <option value="room">Room</option>
              <option value="unit">Shelving Unit</option>
              <option value="shelf">Shelf</option>
              <option value="container">Container</option>
              <option value="item">Item</option>
            </select>
          </div>
        </div>

        <div style={{ marginTop: '2rem', padding: '1rem', background: 'var(--bg-color)', borderRadius: '0.5rem' }}>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0 }}>
            <strong>Note:</strong> After assignment, scanning this label will automatically navigate to the assigned entity.
          </p>
        </div>
      </div>
    </div>
  );
}
