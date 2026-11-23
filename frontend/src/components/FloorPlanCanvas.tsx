import { useRef, useState } from 'react';
import { movePosition, pointToPosition } from '../lib/floorPlan';
import type { UnitPosition } from '../types/generated';

export interface CanvasMarker {
  id: string;
  name: string;
  roomName: string;
  position: UnitPosition;
}

interface FloorPlanCanvasProps {
  imageUrl: string;
  alt: string;
  width: number;
  height: number;
  markers: CanvasMarker[];
  /** Proposed positions, drawn differently and not draggable */
  suggestions?: CanvasMarker[];
  highlightedIds?: ReadonlySet<string>;
  selectedId?: string | null;
  /** Allow markers to be dragged */
  editable?: boolean;
  /** Name of the unit waiting to be placed; while set, tapping the plan places it */
  placingName?: string | null;
  onPlace?: (position: UnitPosition) => void;
  onMove?: (id: string, position: UnitPosition) => void;
  onSelect?: (id: string) => void;
}

/** Pointer travel, in pixels, before a press counts as a drag instead of a tap */
const DRAG_THRESHOLD = 5;

export default function FloorPlanCanvas({
  imageUrl,
  alt,
  width,
  height,
  markers,
  suggestions = [],
  highlightedIds,
  selectedId,
  editable = false,
  placingName,
  onPlace,
  onMove,
  onSelect,
}: FloorPlanCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Every refetch returns a freshly signed URL for the same image. Keep the
  // first one so the picture does not reload after each change, and only take
  // a new one if the current URL stops working (for example, once it expires).
  const [src, setSrc] = useState(imageUrl);

  const handlePlanClick = (e: React.MouseEvent) => {
    if (!placingName || !onPlace || !containerRef.current) return;
    onPlace(
      pointToPosition(e.clientX, e.clientY, containerRef.current.getBoundingClientRect())
    );
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full select-none rounded-lg border border-border bg-muted ${
        placingName ? 'cursor-crosshair' : ''
      }`}
      onClick={handlePlanClick}
    >
      <img
        src={src}
        alt={alt}
        width={width}
        height={height}
        draggable={false}
        onError={() => {
          if (src !== imageUrl) setSrc(imageUrl);
        }}
        className="block h-auto w-full rounded-lg"
      />

      {markers.map((marker) => (
        <Marker
          key={marker.id}
          marker={marker}
          containerRef={containerRef}
          draggable={editable}
          highlighted={highlightedIds?.has(marker.id) ?? false}
          selected={selectedId === marker.id}
          onMove={onMove}
          onSelect={onSelect}
        />
      ))}

      {suggestions.map((marker) => (
        <Marker
          key={`suggestion-${marker.id}`}
          marker={marker}
          containerRef={containerRef}
          suggestion
          highlighted={false}
          selected={selectedId === marker.id}
          onSelect={onSelect}
        />
      ))}

      {placingName && (
        <div className="pointer-events-none absolute left-1/2 top-2 max-w-[90%] -translate-x-1/2 truncate rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground shadow">
          Tap the plan to place “{placingName}”
        </div>
      )}
    </div>
  );
}

interface MarkerProps {
  marker: CanvasMarker;
  containerRef: React.RefObject<HTMLDivElement | null>;
  draggable?: boolean;
  suggestion?: boolean;
  highlighted: boolean;
  selected: boolean;
  onMove?: (id: string, position: UnitPosition) => void;
  onSelect?: (id: string) => void;
}

function Marker({
  marker,
  containerRef,
  draggable = false,
  suggestion = false,
  highlighted,
  selected,
  onMove,
  onSelect,
}: MarkerProps) {
  // Position shown while dragging, and after a drop until the saved position
  // catches up, so the marker never jumps back to where it started.
  const [dragPosition, setDragPosition] = useState<UnitPosition | null>(null);
  const press = useRef<{
    x: number;
    y: number;
    start: UnitPosition;
    /** Latest position while dragging; unset until the press becomes a drag */
    latest: UnitPosition | null;
  } | null>(null);
  // A drag ends with a click event on the same element; this swallows it
  const suppressClick = useRef(false);

  // Once the saved position changes (the drop was stored, or rolled back
  // after a failure) the saved position takes over again.
  const [savedPosition, setSavedPosition] = useState(marker.position);
  if (
    savedPosition.x_percent !== marker.position.x_percent ||
    savedPosition.y_percent !== marker.position.y_percent
  ) {
    setSavedPosition(marker.position);
    setDragPosition(null);
  }

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!draggable || e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    press.current = {
      x: e.clientX,
      y: e.clientY,
      start: marker.position,
      latest: null,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const current = press.current;
    const container = containerRef.current;
    if (!current || !container) return;

    const deltaX = e.clientX - current.x;
    const deltaY = e.clientY - current.y;
    if (!current.latest && Math.hypot(deltaX, deltaY) < DRAG_THRESHOLD) return;

    current.latest = movePosition(
      current.start,
      deltaX,
      deltaY,
      container.getBoundingClientRect()
    );
    setDragPosition(current.latest);
  };

  const handlePointerUp = () => {
    const current = press.current;
    press.current = null;
    if (!current?.latest) return;

    suppressClick.current = true;
    onMove?.(marker.id, current.latest);
  };

  const handlePointerCancel = () => {
    press.current = null;
    setDragPosition(null);
  };

  const handleClick = (e: React.MouseEvent) => {
    // Never let a marker tap fall through and place another unit underneath
    e.stopPropagation();
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    onSelect?.(marker.id);
  };

  const shown = dragPosition ?? marker.position;

  const dotClass = suggestion
    ? 'border-dashed border-amber-700 bg-amber-400'
    : highlighted
      ? 'border-white bg-destructive'
      : 'border-white bg-primary';

  return (
    <div
      className="absolute"
      style={{
        left: `${shown.x_percent}%`,
        top: `${shown.y_percent}%`,
        zIndex: dragPosition ? 30 : selected || highlighted ? 20 : 10,
      }}
    >
      <button
        type="button"
        aria-label={`${marker.name}, ${marker.roomName}${suggestion ? ' (suggested)' : ''}`}
        aria-pressed={selected}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onClick={handleClick}
        style={{ touchAction: draggable ? 'none' : undefined }}
        className={`absolute flex size-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring ${
          draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
        }`}
      >
        <span
          className={`size-4 rounded-full border-2 shadow-md ${dotClass} ${
            selected ? 'ring-4 ring-primary/40' : ''
          } ${highlighted && !selected ? 'animate-pulse ring-4 ring-destructive/40' : ''}`}
        />
      </button>
      <span
        className={`pointer-events-none absolute left-1/2 top-3 max-w-32 -translate-x-1/2 truncate rounded px-1.5 py-0.5 text-[11px] font-medium leading-tight shadow-sm ${
          selected || highlighted
            ? 'bg-foreground text-background'
            : 'bg-background/90 text-foreground'
        }`}
      >
        {marker.name}
      </span>
    </div>
  );
}
