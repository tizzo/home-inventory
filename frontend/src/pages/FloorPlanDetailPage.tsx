import { useState } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  useFloorPlan,
  useFloorPlans,
  useRemoveUnitPosition,
  useRooms,
  useSetUnitPosition,
  useSuggestPlacements,
  useUpdateFloorPlan,
  useUpdateRoom,
} from '../hooks';
import { useToast } from '../context/ToastContext';
import FloorPlanCanvas from '../components/FloorPlanCanvas';
import type { CanvasMarker } from '../components/FloorPlanCanvas';
import { matchesSearch } from '../lib/floorPlan';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import type {
  FloorPlanResponse,
  FloorPlanRoom,
  FloorPlanUnit,
  PlacementSuggestion,
  UnitPosition,
} from '../types/generated';

interface UnitOnPlan extends FloorPlanUnit {
  roomId: string;
  roomName: string;
}

function errorStatus(err: unknown): number | undefined {
  return (err as { response?: { status?: number } }).response?.status;
}

export default function FloorPlanDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const location = useLocation();
  const isEditing = location.pathname.endsWith('/edit');

  // Search text and the selected unit live in the URL so any view can be shared
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q') ?? '';
  const selectedUnitId = searchParams.get('unit');
  const setParam = (key: 'q' | 'unit', value: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next, { replace: true });
  };

  const { data, isLoading, error } = useFloorPlan(id);
  const setPosition = useSetUnitPosition(id);
  const removePosition = useRemoveUnitPosition(id);
  const suggestPlacements = useSuggestPlacements(id);
  const { showError, showInfo } = useToast();

  const [placingUnitId, setPlacingUnitId] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<PlacementSuggestion[]>([]);
  const [isAcceptingAll, setIsAcceptingAll] = useState(false);

  if (isLoading) {
    return <div className="text-center py-12 text-muted-foreground">Loading floor plan...</div>;
  }
  if (error || !data) {
    return (
      <div className="text-center py-12 space-y-4">
        <p className="text-destructive">This floor plan could not be loaded.</p>
        <Button variant="outline" className="text-foreground" asChild>
          <Link to="/floor-plans">Back to Floor Plans</Link>
        </Button>
      </div>
    );
  }

  const { floor_plan: floorPlan, rooms } = data;

  const units: UnitOnPlan[] = rooms.flatMap((room) =>
    room.units.map((unit) => ({ ...unit, roomId: room.id, roomName: room.name }))
  );
  const unitsById = new Map(units.map((unit) => [unit.id, unit]));
  const placedUnits = units.filter((unit) => unit.position);
  const selectedUnit = selectedUnitId ? unitsById.get(selectedUnitId) : undefined;
  const placingUnit = placingUnitId ? unitsById.get(placingUnitId) : undefined;

  const markers: CanvasMarker[] = placedUnits.flatMap((unit) =>
    unit.position
      ? [{ id: unit.id, name: unit.name, roomName: unit.roomName, position: unit.position }]
      : []
  );

  // Suggestions only make sense for units that are still unplaced
  const openSuggestions = suggestions.filter((s) => {
    const unit = unitsById.get(s.shelving_unit_id);
    return unit && !unit.position;
  });
  const suggestionMarkers: CanvasMarker[] = openSuggestions.flatMap((s) => {
    const unit = unitsById.get(s.shelving_unit_id);
    return unit
      ? [
          {
            id: unit.id,
            name: unit.name,
            roomName: unit.roomName,
            position: { x_percent: s.x_percent, y_percent: s.y_percent },
          },
        ]
      : [];
  });

  const matches = units.filter((unit) => matchesSearch(query, unit.name, unit.roomName));
  const highlightedIds = new Set(matches.map((unit) => unit.id));
  const unplacedMatches = matches.filter((unit) => !unit.position).length;

  const savePosition = (unitId: string, position: UnitPosition) => {
    setPosition.mutate(
      { unitId, position },
      { onError: () => showError('Could not save the position. Please try again.') }
    );
  };

  const handlePlace = (position: UnitPosition) => {
    if (!placingUnit) return;
    savePosition(placingUnit.id, position);
    setPlacingUnitId(null);
    setParam('unit', placingUnit.id);
  };

  const handleRemove = (unitId: string) => {
    removePosition.mutate(
      { unitId },
      { onError: () => showError('Could not remove the unit from the plan.') }
    );
    setParam('unit', null);
  };

  const handleSuggest = async () => {
    try {
      const result = await suggestPlacements.mutateAsync();
      setSuggestions(result.suggestions);
      if (result.suggestions.length === 0) {
        showInfo('The AI had no placements to suggest.');
      }
    } catch (err) {
      console.error('Failed to get placement suggestions:', err);
      const status = errorStatus(err);
      showError(
        status === 503
          ? 'AI suggestions are not set up on this server.'
          : 'The AI could not analyze this floor plan. Please try again.'
      );
    }
  };

  const dismissSuggestion = (unitId: string) => {
    setSuggestions((current) => current.filter((s) => s.shelving_unit_id !== unitId));
  };

  const handleAcceptAll = async () => {
    setIsAcceptingAll(true);
    let failed = 0;
    for (const suggestion of openSuggestions) {
      try {
        await setPosition.mutateAsync({
          unitId: suggestion.shelving_unit_id,
          position: { x_percent: suggestion.x_percent, y_percent: suggestion.y_percent },
        });
      } catch (err) {
        console.error('Failed to accept suggestion:', err);
        failed += 1;
      }
    }
    setIsAcceptingAll(false);
    if (failed > 0) {
      showError(`${failed} suggested placement${failed === 1 ? '' : 's'} could not be saved.`);
    }
  };

  const otherMode = {
    pathname: isEditing ? `/floor-plans/${id}` : `/floor-plans/${id}/edit`,
    search: location.search,
  };

  return (
    <div>
      <div className="text-sm text-muted-foreground mb-2">
        <Link to="/floor-plans" className="hover:underline">
          Floor Plans
        </Link>{' '}
        / {floorPlan.name}
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold truncate">{floorPlan.name}</h1>
          {floorPlan.description && (
            <p className="text-muted-foreground text-sm mt-1">{floorPlan.description}</p>
          )}
        </div>
        <Button
          variant={isEditing ? 'outline' : 'default'}
          className={isEditing ? 'text-foreground' : undefined}
          asChild
        >
          <Link to={otherMode}>{isEditing ? 'Done' : 'Place Units'}</Link>
        </Button>
      </div>

      <div className="mb-4 space-y-1">
        <Label htmlFor="floor-plan-search" className="sr-only">
          Search shelving units on this floor plan
        </Label>
        <Input
          id="floor-plan-search"
          type="search"
          value={query}
          onChange={(e) => setParam('q', e.target.value)}
          placeholder="Search shelving units or rooms..."
          className="max-w-sm text-foreground"
        />
        {query.trim() && (
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {matches.length === 0
              ? 'No shelving units match.'
              : `${matches.length - unplacedMatches} highlighted on the plan` +
                (unplacedMatches > 0 ? `, ${unplacedMatches} not placed yet` : '') +
                '.'}
          </p>
        )}
      </div>

      <div className={isEditing ? 'grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]' : ''}>
        <div className="space-y-4 min-w-0">
          <FloorPlanCanvas
            key={floorPlan.id}
            imageUrl={floorPlan.url}
            alt={`Floor plan: ${floorPlan.name}`}
            width={floorPlan.width}
            height={floorPlan.height}
            markers={markers}
            suggestions={isEditing ? suggestionMarkers : []}
            highlightedIds={highlightedIds}
            selectedId={selectedUnitId}
            editable={isEditing}
            placingName={isEditing ? placingUnit?.name : null}
            onPlace={handlePlace}
            onMove={savePosition}
            onSelect={(unitId) => {
              setPlacingUnitId(null);
              setParam('unit', unitId === selectedUnitId ? null : unitId);
            }}
          />

          {selectedUnit && (
            <Card>
              <CardContent className="p-4 flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold truncate">{selectedUnit.name}</div>
                  <div className="text-sm text-muted-foreground truncate">
                    {selectedUnit.roomName}
                    {!selectedUnit.position && ' · not placed on this plan yet'}
                  </div>
                </div>
                <Button variant="secondary" size="sm" asChild>
                  <Link to={`/units/${selectedUnit.id}/shelves`}>View Shelves</Link>
                </Button>
                {isEditing && selectedUnit.position && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleRemove(selectedUnit.id)}
                    disabled={removePosition.isPending}
                  >
                    Remove from Plan
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => setParam('unit', null)}>
                  Close
                </Button>
              </CardContent>
            </Card>
          )}

          {!isEditing && <RoomSummary rooms={rooms} editLink={otherMode} />}
        </div>

        {isEditing && (
          <div className="space-y-4">
            <Card>
              <CardContent className="p-4 space-y-3">
                <h2 className="font-semibold">Unplaced units</h2>
                <UnplacedUnits
                  rooms={rooms}
                  placingUnitId={placingUnit?.id ?? null}
                  onToggle={(unitId) =>
                    setPlacingUnitId((current) => (current === unitId ? null : unitId))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Tap a unit, then tap the plan to place it. Drag a marker to move it, or
                  tap it for the option to remove it.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 space-y-3">
                <h2 className="font-semibold">AI suggestions</h2>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleSuggest}
                  disabled={
                    suggestPlacements.isPending || units.length === placedUnits.length
                  }
                >
                  {suggestPlacements.isPending ? 'Analyzing plan...' : 'Suggest Placements'}
                </Button>
                {openSuggestions.length > 0 && (
                  <>
                    <ul className="space-y-3">
                      {openSuggestions.map((suggestion) => {
                        const unit = unitsById.get(suggestion.shelving_unit_id);
                        if (!unit) return null;
                        return (
                          <li
                            key={suggestion.shelving_unit_id}
                            className="rounded-md border border-border p-3 text-sm space-y-2"
                          >
                            <button
                              type="button"
                              className="text-left w-full"
                              onClick={() => setParam('unit', unit.id)}
                            >
                              <span className="font-medium">{unit.name}</span>
                              <span className="text-muted-foreground"> · {unit.roomName}</span>
                              <span className="block text-xs text-muted-foreground">
                                {suggestion.confidence} confidence
                                {suggestion.reasoning && ` — ${suggestion.reasoning}`}
                              </span>
                            </button>
                            <div className="flex gap-2">
                              <Button
                                size="xs"
                                disabled={isAcceptingAll}
                                onClick={() =>
                                  savePosition(unit.id, {
                                    x_percent: suggestion.x_percent,
                                    y_percent: suggestion.y_percent,
                                  })
                                }
                              >
                                Accept
                              </Button>
                              <Button
                                size="xs"
                                variant="outline"
                                disabled={isAcceptingAll}
                                onClick={() => dismissSuggestion(unit.id)}
                              >
                                Dismiss
                              </Button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleAcceptAll} disabled={isAcceptingAll}>
                        {isAcceptingAll ? 'Saving...' : 'Accept All'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSuggestions([])}
                        disabled={isAcceptingAll}
                      >
                        Dismiss All
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <LinkedRooms floorPlanId={id} rooms={rooms} />

            <DetailsForm key={String(floorPlan.updated_at)} floorPlan={floorPlan} />
          </div>
        )}
      </div>
    </div>
  );
}

/** Rooms on the plan with how many of their units are placed (view mode). */
function RoomSummary({
  rooms,
  editLink,
}: {
  rooms: FloorPlanRoom[];
  editLink: { pathname: string; search: string };
}) {
  if (rooms.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No rooms are linked to this floor plan yet.{' '}
        <Link to={editLink} className="underline">
          Link rooms and place units
        </Link>
        .
      </p>
    );
  }

  return (
    <div>
      <h2 className="font-semibold mb-2">Rooms on this plan</h2>
      <ul className="flex flex-wrap gap-2">
        {rooms.map((room) => {
          const placed = room.units.filter((unit) => unit.position).length;
          return (
            <li key={room.id}>
              <Link
                to={`/rooms/${room.id}/units`}
                className="block text-sm px-3 py-1.5 rounded border border-border hover:bg-accent"
              >
                {room.name}
                <span className="text-muted-foreground">
                  {' '}
                  · {placed}/{room.units.length} placed
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Units still to be placed, grouped by room. Tap one, then tap the plan. */
function UnplacedUnits({
  rooms,
  placingUnitId,
  onToggle,
}: {
  rooms: FloorPlanRoom[];
  placingUnitId: string | null;
  onToggle: (unitId: string) => void;
}) {
  if (rooms.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Link a room below to see its shelving units here.
      </p>
    );
  }

  const roomsWithUnplaced = rooms
    .map((room) => ({ ...room, units: room.units.filter((unit) => !unit.position) }))
    .filter((room) => room.units.length > 0);

  if (roomsWithUnplaced.length === 0) {
    return <p className="text-sm text-muted-foreground">Every shelving unit is placed.</p>;
  }

  return (
    <div className="space-y-3">
      {roomsWithUnplaced.map((room) => (
        <div key={room.id}>
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1.5">
            {room.name}
          </h3>
          <div className="flex flex-wrap gap-2">
            {room.units.map((unit) => (
              <Button
                key={unit.id}
                size="sm"
                variant={placingUnitId === unit.id ? 'default' : 'outline'}
                aria-pressed={placingUnitId === unit.id}
                onClick={() => onToggle(unit.id)}
              >
                {unit.name}
              </Button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Choose which rooms appear on this floor plan. */
function LinkedRooms({ floorPlanId, rooms }: { floorPlanId: string; rooms: FloorPlanRoom[] }) {
  const queryClient = useQueryClient();
  const { data: allRooms, isLoading } = useRooms({ limit: 1000 });
  const { data: floorPlans } = useFloorPlans();
  const updateRoom = useUpdateRoom();
  const { showError } = useToast();

  const placedCounts = new Map(
    rooms.map((room) => [room.id, room.units.filter((unit) => unit.position).length])
  );

  const handleToggle = async (roomId: string, roomName: string, currentPlanId?: string) => {
    const isLinked = currentPlanId === floorPlanId;
    const placed = placedCounts.get(roomId) ?? 0;

    if (isLinked && placed > 0) {
      const confirmed = window.confirm(
        `Remove "${roomName}" from this floor plan? The positions of its ${placed} placed unit${placed === 1 ? '' : 's'} will be cleared.`
      );
      if (!confirmed) return;
    }
    if (!isLinked && currentPlanId) {
      const otherName = floorPlans?.find((fp) => fp.id === currentPlanId)?.name ?? 'another plan';
      const confirmed = window.confirm(
        `"${roomName}" is on "${otherName}". Moving it here clears the positions of its units on that plan.`
      );
      if (!confirmed) return;
    }

    try {
      await updateRoom.mutateAsync({
        id: roomId,
        data: { floor_plan_id: isLinked ? '' : floorPlanId },
      });
      queryClient.invalidateQueries({ queryKey: ['floor-plans'] });
    } catch (err) {
      console.error('Failed to update room link:', err);
      showError('Could not update the room. Please try again.');
    }
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <h2 className="font-semibold">Rooms on this plan</h2>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading rooms...</p>
        ) : !allRooms || allRooms.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No rooms yet.{' '}
            <Link to="/rooms" className="underline">
              Create a room
            </Link>{' '}
            first.
          </p>
        ) : (
          <ul className="space-y-2">
            {allRooms.data.map((room) => {
              const isLinked = room.floor_plan_id === floorPlanId;
              const otherPlan =
                room.floor_plan_id && !isLinked
                  ? floorPlans?.find((fp) => fp.id === room.floor_plan_id)?.name
                  : undefined;
              return (
                <li key={room.id} className="flex items-center gap-2 text-sm">
                  <div className="min-w-0 flex-1">
                    <div className="truncate">{room.name}</div>
                    {otherPlan && (
                      <div className="text-xs text-muted-foreground truncate">
                        On {otherPlan}
                      </div>
                    )}
                  </div>
                  <Button
                    size="xs"
                    variant={isLinked ? 'outline' : 'secondary'}
                    disabled={updateRoom.isPending}
                    onClick={() => handleToggle(room.id, room.name, room.floor_plan_id)}
                  >
                    {isLinked ? 'Remove' : 'Add'}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/** Rename the floor plan or change its description. */
function DetailsForm({ floorPlan }: { floorPlan: FloorPlanResponse }) {
  const updateFloorPlan = useUpdateFloorPlan();
  const { showError, showSuccess } = useToast();
  const [name, setName] = useState(floorPlan.name);
  const [description, setDescription] = useState(floorPlan.description ?? '');

  const unchanged =
    name.trim() === floorPlan.name && description.trim() === (floorPlan.description ?? '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateFloorPlan.mutateAsync({
        id: floorPlan.id,
        // An empty description is sent as-is: the backend reads it as "clear"
        data: { name: name.trim(), description: description.trim() },
      });
      showSuccess('Floor plan updated');
    } catch (err) {
      console.error('Failed to update floor plan:', err);
      showError('Could not update the floor plan. Please try again.');
    }
  };

  return (
    <Card>
      <CardContent className="p-4">
        <form onSubmit={handleSubmit} className="space-y-3">
          <h2 className="font-semibold">Details</h2>
          <div className="space-y-2">
            <Label htmlFor="floor-plan-edit-name">Name *</Label>
            <Input
              id="floor-plan-edit-name"
              className="text-foreground"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={255}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="floor-plan-edit-description">Description</Label>
            <Textarea
              id="floor-plan-edit-description"
              className="text-foreground"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
          <Button
            type="submit"
            size="sm"
            disabled={updateFloorPlan.isPending || unchanged || !name.trim()}
          >
            {updateFloorPlan.isPending ? 'Saving...' : 'Save Details'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
