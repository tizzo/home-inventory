import { useState } from 'react';
import Modal from './Modal';
import EntityField from './EntityField';
import type { EntityType } from './EntitySelector';

interface MoveModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  entityName: string;
  targetEntityType: EntityType;
  targetLabel: string;
  onMove: (targetId: string) => Promise<void>;
  isPending?: boolean;
}

/**
 * Reusable modal for moving entities between locations
 * Handles the common pattern of: select target location + confirm move
 */
export default function MoveModal({
  isOpen,
  onClose,
  title,
  entityName,
  targetEntityType,
  targetLabel,
  onMove,
  isPending = false,
}: MoveModalProps) {
  const [targetId, setTargetId] = useState<string | undefined>();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetId) {
      alert(`Please select a ${targetLabel.toLowerCase()}`);
      return;
    }

    try {
      await onMove(targetId);
      setTargetId(undefined);
      onClose();
    } catch (err) {
      console.error('Move failed:', err);
      alert('Failed to move. Please try again.');
    }
  };

  const handleClose = () => {
    setTargetId(undefined);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={title}>
      <form onSubmit={handleSubmit}>
        <p>Move "{entityName}" to a different {targetLabel.toLowerCase()}:</p>

        <EntityField
          label={targetLabel}
          entityType={targetEntityType}
          value={targetId}
          onChange={setTargetId}
          required
          placeholder={`Select ${targetLabel.toLowerCase()}`}
          helpText="Type to search or click the camera icon to scan a QR code"
        />

        <div className="form-actions">
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isPending || !targetId}
          >
            {isPending ? 'Moving...' : 'Move'}
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
