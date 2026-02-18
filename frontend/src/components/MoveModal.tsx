import { useState } from 'react';
import Modal from './Modal';
import EntityField from './EntityField';
import type { EntityType } from './EntitySelector';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

interface LocationTypeOption {
  type: EntityType;
  label: string;
  displayName: string;
}

interface MoveModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  entityName: string;
  targetEntityType?: EntityType;
  targetLabel?: string;
  locationTypes?: LocationTypeOption[];
  onMove: (targetId: string, selectedType?: EntityType) => Promise<void>;
  isPending?: boolean;
}

/**
 * Reusable modal for moving entities between locations
 * Handles the common pattern of: select target location + confirm move
 *
 * Supports two modes:
 * 1. Single location type: Pass targetEntityType and targetLabel
 * 2. Multiple location types: Pass locationTypes array with options
 */
export default function MoveModal({
  isOpen,
  onClose,
  title,
  entityName,
  targetEntityType,
  targetLabel,
  locationTypes,
  onMove,
  isPending = false,
}: MoveModalProps) {
  const [targetId, setTargetId] = useState<string | undefined>();
  const [selectedLocationType, setSelectedLocationType] = useState<EntityType>(
    locationTypes ? locationTypes[0].type : targetEntityType!
  );

  const currentLocationType = locationTypes?.find(
    (lt) => lt.type === selectedLocationType
  );
  const effectiveTargetType = locationTypes ? selectedLocationType : targetEntityType!;
  const effectiveTargetLabel = locationTypes
    ? currentLocationType!.label
    : targetLabel!;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetId) {
      alert(`Please select a ${effectiveTargetLabel.toLowerCase()}`);
      return;
    }

    try {
      await onMove(targetId, locationTypes ? selectedLocationType : undefined);
      setTargetId(undefined);
      if (locationTypes) {
        setSelectedLocationType(locationTypes[0].type);
      }
      onClose();
    } catch (err) {
      console.error('Move failed:', err);
      alert('Failed to move. Please try again.');
    }
  };

  const handleClose = () => {
    setTargetId(undefined);
    if (locationTypes) {
      setSelectedLocationType(locationTypes[0].type);
    }
    onClose();
  };

  const handleLocationTypeChange = (type: EntityType) => {
    setSelectedLocationType(type);
    setTargetId(undefined); // Reset target when switching location type
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={title}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-muted-foreground">Move &ldquo;{entityName}&rdquo; to a different location:</p>

        {locationTypes && locationTypes.length > 1 && (
          <div className="space-y-2">
            <Label>Location Type</Label>
            <div className="flex flex-wrap gap-4">
              {locationTypes.map((locType) => (
                <label key={locType.type} className="flex items-center gap-2 cursor-pointer min-h-[44px] px-2">
                  <input
                    type="radio"
                    value={locType.type}
                    checked={selectedLocationType === locType.type}
                    onChange={() => handleLocationTypeChange(locType.type)}
                    className="h-4 w-4 text-primary"
                  />
                  <span className="text-sm">{locType.displayName}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <EntityField
          label={effectiveTargetLabel}
          entityType={effectiveTargetType}
          value={targetId}
          onChange={setTargetId}
          required
          placeholder={`Select ${effectiveTargetLabel.toLowerCase()}`}
          helpText="Type to search or click the camera icon to scan a QR code"
        />

        <div className="flex gap-3 pt-4 border-t border-border">
          <Button
            type="submit"
            disabled={isPending || !targetId}
            className="flex-1"
          >
            {isPending ? 'Moving...' : 'Move'}
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
