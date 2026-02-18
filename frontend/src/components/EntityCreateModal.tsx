import { useState, useEffect } from 'react';
import Modal from './Modal';
import EntityField from './EntityField';
import type { EntityType } from './EntitySelector';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface FormField {
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'number';
  required?: boolean;
  placeholder?: string;
  rows?: number;
}

interface ParentTypeOption {
  type: EntityType;
  label: string;
  displayName: string;
  preSelectedId?: string; // Pre-selected parent for this type (from route params)
  disabled?: boolean; // Whether this option should be disabled
}

interface EntityCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  parentEntityType?: EntityType;
  parentEntityLabel?: string;
  parentEntityId?: string; // Pre-selected parent (e.g., when creating from a specific parent page)
  parentTypes?: ParentTypeOption[]; // For entities that can have multiple parent types
  fields: FormField[];
  onSubmit: (data: Record<string, string>) => Promise<void>;
  isPending?: boolean;
}

/**
 * Reusable modal for creating entities with optional parent selection
 * Handles the common pattern of: select parent + fill in fields + submit
 *
 * Supports two modes:
 * 1. Single parent type: Pass parentEntityType, parentEntityLabel, parentEntityId
 * 2. Multiple parent types: Pass parentTypes array with radio button options
 */
export default function EntityCreateModal({
  isOpen,
  onClose,
  title,
  parentEntityType,
  parentEntityLabel,
  parentEntityId,
  parentTypes,
  fields,
  onSubmit,
  isPending = false,
}: EntityCreateModalProps) {
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [selectedParentType, setSelectedParentType] = useState<EntityType | undefined>(
    parentTypes ? parentTypes[0].type : parentEntityType
  );

  // Initialize parent entity if provided
  useEffect(() => {
    if (parentEntityId && parentEntityType) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFormData((prev) => ({ ...prev, [`${parentEntityType}_id`]: parentEntityId }));
    } else if (parentTypes) {
      // Initialize with pre-selected parent IDs for each type
      const initialData: Record<string, string> = {};
      parentTypes.forEach((pt) => {
        if (pt.preSelectedId) {
          initialData[`${pt.type}_id`] = pt.preSelectedId;
        }
      });
      setFormData((prev) => ({ ...prev, ...initialData }));
    }
  }, [parentEntityId, parentEntityType, parentTypes]);

  const currentParentType = parentTypes?.find((pt) => pt.type === selectedParentType);
  const effectiveParentType = parentTypes ? selectedParentType : parentEntityType;
  const effectiveParentLabel = parentTypes
    ? currentParentType?.label
    : parentEntityLabel;
  const effectiveParentId = parentTypes
    ? currentParentType?.preSelectedId
    : parentEntityId;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate parent entity if required
    if (effectiveParentType && !formData[`${effectiveParentType}_id`]) {
      alert(`Please select a ${effectiveParentLabel?.toLowerCase() || effectiveParentType}`);
      return;
    }

    try {
      await onSubmit(formData);
      setFormData({});
      if (parentTypes) {
        setSelectedParentType(parentTypes[0].type);
      }
      onClose();
    } catch (err) {
      console.error('Create failed:', err);
      alert('Failed to create. Please try again.');
    }
  };

  const handleClose = () => {
    setFormData({});
    if (parentTypes) {
      setSelectedParentType(parentTypes[0].type);
    }
    onClose();
  };

  const handleParentTypeChange = (type: EntityType) => {
    setSelectedParentType(type);
    // Clear all parent IDs when switching types
    const clearedData = { ...formData };
    if (parentTypes) {
      parentTypes.forEach((pt) => {
        delete clearedData[`${pt.type}_id`];
      });
      // Set the pre-selected ID for the new type if it exists
      const newParentType = parentTypes.find((pt) => pt.type === type);
      if (newParentType?.preSelectedId) {
        clearedData[`${type}_id`] = newParentType.preSelectedId;
      }
    }
    setFormData(clearedData);
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={title}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Parent Type Selector (for multiple parent types) */}
        {parentTypes && parentTypes.length > 1 && (
          <div className="space-y-2">
            <Label>Location Type</Label>
            <div className="flex flex-wrap gap-4">
              {parentTypes.map((pt) => (
                <label key={pt.type} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    value={pt.type}
                    checked={selectedParentType === pt.type}
                    onChange={() => handleParentTypeChange(pt.type)}
                    className="h-4 w-4 text-primary"
                  />
                  <span className="text-sm">{pt.displayName}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Parent Entity Selector (if applicable) */}
        {effectiveParentType && (
          <EntityField
            label={effectiveParentLabel || effectiveParentType}
            entityType={effectiveParentType}
            value={formData[`${effectiveParentType}_id`] || effectiveParentId}
            onChange={(value) => {
              if (value) {
                setFormData({ ...formData, [`${effectiveParentType}_id`]: value });
              } else {
                const newData = { ...formData };
                delete newData[`${effectiveParentType}_id`];
                setFormData(newData);
              }
            }}
            required={!effectiveParentId}
            placeholder={`Select ${effectiveParentLabel?.toLowerCase() || effectiveParentType}`}
            helpText="Type to search or click the camera icon to scan a QR code"
          />
        )}

        {/* Dynamic Form Fields */}
        {fields.map((field) => (
          <div key={field.name} className="space-y-2">
            <Label htmlFor={`create-${field.name}`}>
              {field.label}
              {field.required && <span className="text-destructive ml-1">*</span>}
            </Label>
            {field.type === 'textarea' ? (
              <Textarea
                id={`create-${field.name}`}
                value={formData[field.name] || ''}
                onChange={(e) =>
                  setFormData({ ...formData, [field.name]: e.target.value })
                }
                required={field.required}
                placeholder={field.placeholder}
                rows={field.rows || 3}
                className="min-h-[80px]"
              />
            ) : (
              <Input
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

        <div className="flex gap-3 pt-4 border-t border-border">
          <Button
            type="submit"
            disabled={isPending}
            className="flex-1"
          >
            {isPending ? 'Creating...' : 'Create'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            className="flex-1"
          >
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  );
}
