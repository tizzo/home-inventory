import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { UnitPositionMarker } from './UnitPositionMarker';
import {
  useFloorPlan,
  useAddPosition,
  useUpdatePosition,
  useRemovePosition,
  useSuggestPlacements,
} from '../hooks/useFloorPlans';
import type { PlacementSuggestion, PositionResponse } from '../types/generated';
import '../App.css';

interface FloorPlanViewerProps {
  floorPlanId: string;
  editMode?: boolean;
  searchQuery?: string;
}

interface UnplacedUnit {
  id: string;
  name: string;
  roomName: string;
}

export function FloorPlanViewer({
  floorPlanId,
  editMode = false,
  searchQuery = '',
}: FloorPlanViewerProps) {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, error } = useFloorPlan(floorPlanId);
  const addPosition = useAddPosition();
  const updatePosition = useUpdatePosition();
  const removePosition = useRemovePosition();
  const suggestPlacements = useSuggestPlacements();

  const [suggestions, setSuggestions] = useState<PlacementSuggestion[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [draggedUnit, setDraggedUnit] = useState<UnplacedUnit | null>(null);

  if (isLoading) {
    return <div className="loading">Loading floor plan...</div>;
  }

  if (error || !data) {
    return <div className="error">Failed to load floor plan</div>;
  }

  const { floor_plan, positions, linked_rooms } = data;

  // Get unplaced units from linked rooms
  const placedUnitIds = new Set(positions.map((p) => p.shelving_unit_id));

  // Filter positions based on search
  const highlightedPositions = searchQuery
    ? positions.filter(
        (p) =>
          p.shelving_unit_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.room_name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  const handlePositionDragEnd = async (
    position: PositionResponse,
    x: number,
    y: number
  ) => {
    try {
      await updatePosition.mutateAsync({
        floorPlanId,
        positionId: position.id,
        data: { x_percent: x, y_percent: y },
      });
    } catch (err) {
      console.error('Failed to update position:', err);
    }
  };

  const handlePositionClick = (position: PositionResponse) => {
    // Navigate to shelving unit details
    navigate(`/units/${position.shelving_unit_id}`);
  };

  const handleFloorPlanClick = (e: React.MouseEvent) => {
    if (!editMode || !draggedUnit || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    addPosition.mutate({
      floorPlanId,
      data: {
        shelving_unit_id: draggedUnit.id,
        x_percent: x,
        y_percent: y,
      },
    });

    setDraggedUnit(null);
  };

  const handleAISuggest = async () => {
    setIsLoadingSuggestions(true);
    try {
      const result = await suggestPlacements.mutateAsync(floorPlanId);
      setSuggestions(result.suggestions);
    } catch (err) {
      console.error('Failed to get suggestions:', err);
      alert('Failed to get AI suggestions. Make sure the AI service is configured.');
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  const handleAcceptSuggestion = async (suggestion: PlacementSuggestion) => {
    try {
      await addPosition.mutateAsync({
        floorPlanId,
        data: {
          shelving_unit_id: suggestion.shelving_unit_id,
          x_percent: suggestion.x_percent,
          y_percent: suggestion.y_percent,
        },
      });
      setSuggestions((prev) =>
        prev.filter((s) => s.shelving_unit_id !== suggestion.shelving_unit_id)
      );
    } catch (err) {
      console.error('Failed to accept suggestion:', err);
    }
  };

  const handleRejectSuggestion = (suggestion: PlacementSuggestion) => {
    setSuggestions((prev) =>
      prev.filter((s) => s.shelving_unit_id !== suggestion.shelving_unit_id)
    );
  };

  const handleAcceptAll = async () => {
    for (const suggestion of suggestions) {
      try {
        await addPosition.mutateAsync({
          floorPlanId,
          data: {
            shelving_unit_id: suggestion.shelving_unit_id,
            x_percent: suggestion.x_percent,
            y_percent: suggestion.y_percent,
          },
        });
      } catch (err) {
        console.error('Failed to accept suggestion:', err);
      }
    }
    setSuggestions([]);
  };

  const handleRemovePosition = async (positionId: string) => {
    if (confirm('Remove this unit from the floor plan?')) {
      try {
        await removePosition.mutateAsync({ floorPlanId, positionId });
      } catch (err) {
        console.error('Failed to remove position:', err);
      }
    }
  };

  return (
    <div className="floor-plan-viewer">
      {/* Toolbar */}
      {editMode && (
        <div className="floor-plan-toolbar">
          <button
            onClick={handleAISuggest}
            disabled={isLoadingSuggestions}
            className="btn btn-primary"
          >
            {isLoadingSuggestions ? 'Analyzing...' : 'AI Suggest Placements'}
          </button>
          {suggestions.length > 0 && (
            <>
              <span style={{ margin: '0 12px', color: '#6b7280' }}>
                {suggestions.length} suggestions
              </span>
              <button onClick={handleAcceptAll} className="btn btn-success">
                Accept All
              </button>
              <button
                onClick={() => setSuggestions([])}
                className="btn btn-secondary"
              >
                Clear Suggestions
              </button>
            </>
          )}
        </div>
      )}

      <div className="floor-plan-content">
        {/* Floor plan image with markers */}
        <div
          ref={containerRef}
          className="floor-plan-image-container"
          onClick={handleFloorPlanClick}
          style={{
            cursor: draggedUnit ? 'crosshair' : 'default',
          }}
        >
          <img
            src={floor_plan.url}
            alt={floor_plan.name}
            className="floor-plan-image"
            draggable={false}
          />

          {/* Existing positions */}
          {positions.map((position) => (
            <UnitPositionMarker
              key={position.id}
              position={position}
              isEditing={editMode}
              isHighlighted={highlightedPositions.some(
                (p) => p.id === position.id
              )}
              onDragEnd={(x, y) => handlePositionDragEnd(position, x, y)}
              onClick={() =>
                editMode
                  ? handleRemovePosition(position.id)
                  : handlePositionClick(position)
              }
            />
          ))}

          {/* AI Suggestions */}
          {suggestions.map((suggestion) => (
            <UnitPositionMarker
              key={`suggestion-${suggestion.shelving_unit_id}`}
              position={suggestion}
              isSuggestion
              onAccept={() => handleAcceptSuggestion(suggestion)}
              onReject={() => handleRejectSuggestion(suggestion)}
            />
          ))}

          {/* Drop indicator when dragging */}
          {draggedUnit && (
            <div className="drop-indicator">
              Click to place "{draggedUnit.name}"
            </div>
          )}
        </div>

        {/* Sidebar with unplaced units (edit mode only) */}
        {editMode && (
          <div className="floor-plan-sidebar">
            <h3>Unplaced Units</h3>
            {linked_rooms.length === 0 ? (
              <p className="empty-state">
                No rooms linked to this floor plan. Go to Rooms and set the floor
                plan for each room.
              </p>
            ) : (
              linked_rooms.map((room) => (
                <div key={room.id} className="room-units-section">
                  <h4>{room.name}</h4>
                  <UnplacedUnitsList
                    roomId={room.id}
                    roomName={room.name}
                    placedUnitIds={placedUnitIds}
                    onSelectUnit={setDraggedUnit}
                    selectedUnit={draggedUnit}
                  />
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Subcomponent for loading unplaced units per room
function UnplacedUnitsList({
  roomId,
  roomName,
  placedUnitIds,
  onSelectUnit,
  selectedUnit,
}: {
  roomId: string;
  roomName: string;
  placedUnitIds: Set<string>;
  onSelectUnit: (unit: UnplacedUnit | null) => void;
  selectedUnit: UnplacedUnit | null;
}) {
  // We need to fetch shelving units for this room
  // Using inline fetch for simplicity
  const [units, setUnits] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch units on mount
    fetch(`/api/rooms/${roomId}/units`)
      .then((res) => res.json())
      .then((data) => {
        setUnits(data.items || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [roomId]);

  if (loading) {
    return <div className="loading-small">Loading...</div>;
  }

  const unplacedUnits = units.filter((u) => !placedUnitIds.has(u.id));

  if (unplacedUnits.length === 0) {
    return <p className="all-placed">All units placed</p>;
  }

  return (
    <ul className="unplaced-units-list">
      {unplacedUnits.map((unit) => (
        <li
          key={unit.id}
          className={`unplaced-unit ${selectedUnit?.id === unit.id ? 'selected' : ''}`}
          onClick={() =>
            onSelectUnit(
              selectedUnit?.id === unit.id
                ? null
                : { id: unit.id, name: unit.name, roomName }
            )
          }
        >
          {unit.name}
        </li>
      ))}
    </ul>
  );
}
