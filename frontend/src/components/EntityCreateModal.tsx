import { useState, useEffect } from 'react';
import Modal from './Modal';
import EntityField from './EntityField';
import type { EntityType } from './EntitySelector';

interface FormField {
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'number';
  required?: boolean;
  placeholder?: string;
  rows?: number;
}

interface EntityCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  parentEntityType?: EntityType;
  parentEntityLabel?: string;
  parentEntityId?: string; // Pre-selected parent (e.g., when creating from a specific parent page)
  fields: FormField[];
  onSubmit: (data: Record<string, any>) => Promise<void>;
  isPending?: boolean;
}

/**
 * Reusable modal for creating entities with optional parent selection
 * Handles the common pattern of: select parent + fill in fields + submit
 */
export default function EntityCreateModal({
  isOpen,
  onClose,
  title,
  parentEntityType,
  parentEntityLabel,
  parentEntityId,
  fields,
  onSubmit,
  isPending = false,
}: EntityCreateModalProps) {
  const [formData, setFormData] = useState<Record<string, any>>({});

  // Initialize parent entity if provided
  useEffect(() => {
    if (parentEntityId && parentEntityType) {
      setFormData((prev) => ({ ...prev, [`${parentEntityType}_id`]: parentEntityId }));
    }
  }, [parentEntityId, parentEntityType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate parent entity if required
    if (parentEntityType && !formData[`${parentEntityType}_id`]) {
      alert(`Please select a ${parentEntityLabel?.toLowerCase() || parentEntityType}`);
      return;
    }

    try {
      await onSubmit(formData);
      setFormData({});
      onClose();
    } catch (err) {
      console.error('Create failed:', err);
      alert('Failed to create. Please try again.');
    }
  };

  const handleClose = () => {
    setFormData({});
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={title}>
      <form onSubmit={handleSubmit}>
        {/* Parent Entity Selector (if applicable) */}
        {parentEntityType && (
          <EntityField
            label={parentEntityLabel || parentEntityType}
            entityType={parentEntityType}
            value={formData[`${parentEntityType}_id`]}
            onChange={(value) =>
              setFormData({ ...formData, [`${parentEntityType}_id`]: value })
            }
            required
            placeholder={`Select ${parentEntityLabel?.toLowerCase() || parentEntityType}`}
            helpText="Type to search or click the camera icon to scan a QR code"
          />
        )}

        {/* Dynamic Form Fields */}
        {fields.map((field) => (
          <div key={field.name} className="form-group">
            <label htmlFor={`create-${field.name}`}>
              {field.label}
              {field.required && ' *'}
            </label>
            {field.type === 'textarea' ? (
              <textarea
                id={`create-${field.name}`}
                value={formData[field.name] || ''}
                onChange={(e) =>
                  setFormData({ ...formData, [field.name]: e.target.value })
                }
                required={field.required}
                placeholder={field.placeholder}
                rows={field.rows || 3}
              />
            ) : (
              <input
                id={`create-${field.name}`}
                type={field.type}
                value={formData[field.name] || ''}
                onChange={(e) =>
                  setFormData({ ...formData, [field.name]: e.target.value })
                }
                required={field.required}
                placeholder={field.placeholder}
              />
            )}
          </div>
        ))}

        <div className="form-actions">
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isPending}
          >
            {isPending ? 'Creating...' : 'Create'}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleClose}
          >
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
}
