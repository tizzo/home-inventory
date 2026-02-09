import { useState, useRef, useEffect } from 'react';
import type { PositionResponse, PlacementSuggestion } from '../types/generated';

interface UnitPositionMarkerProps {
  position: PositionResponse | PlacementSuggestion;
  isEditing?: boolean;
  isHighlighted?: boolean;
  isSuggestion?: boolean;
  onDragEnd?: (x: number, y: number) => void;
  onClick?: () => void;
  onAccept?: () => void;
  onReject?: () => void;
}

export function UnitPositionMarker({
  position,
  isEditing = false,
  isHighlighted = false,
  isSuggestion = false,
  onDragEnd,
  onClick,
  onAccept,
  onReject,
}: UnitPositionMarkerProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const markerRef = useRef<HTMLDivElement>(null);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const markerStartPos = useRef({ x: 0, y: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isEditing || isSuggestion) return;
    e.preventDefault();
    setIsDragging(true);
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    markerStartPos.current = { x: position.x_percent, y: position.y_percent };
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!markerRef.current?.parentElement) return;

      const parent = markerRef.current.parentElement;
      const rect = parent.getBoundingClientRect();

      const deltaX = ((e.clientX - dragStartPos.current.x) / rect.width) * 100;
      const deltaY = ((e.clientY - dragStartPos.current.y) / rect.height) * 100;

      const newX = Math.max(0, Math.min(100, markerStartPos.current.x + deltaX));
      const newY = Math.max(0, Math.min(100, markerStartPos.current.y + deltaY));

      if (markerRef.current) {
        markerRef.current.style.left = `${newX}%`;
        markerRef.current.style.top = `${newY}%`;
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      setIsDragging(false);

      if (!markerRef.current?.parentElement) return;

      const parent = markerRef.current.parentElement;
      const rect = parent.getBoundingClientRect();

      const deltaX = ((e.clientX - dragStartPos.current.x) / rect.width) * 100;
      const deltaY = ((e.clientY - dragStartPos.current.y) / rect.height) * 100;

      const newX = Math.max(0, Math.min(100, markerStartPos.current.x + deltaX));
      const newY = Math.max(0, Math.min(100, markerStartPos.current.y + deltaY));

      onDragEnd?.(newX, newY);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, onDragEnd]);

  const markerStyle: React.CSSProperties = {
    position: 'absolute',
    left: `${position.x_percent}%`,
    top: `${position.y_percent}%`,
    transform: 'translate(-50%, -50%)',
    cursor: isEditing && !isSuggestion ? 'grab' : 'pointer',
    zIndex: isDragging ? 1000 : isHighlighted ? 100 : 10,
  };

  const pinStyle: React.CSSProperties = {
    width: '24px',
    height: '24px',
    borderRadius: '50% 50% 50% 0',
    transform: 'rotate(-45deg)',
    backgroundColor: isSuggestion
      ? 'rgba(59, 130, 246, 0.7)'
      : isHighlighted
        ? '#ef4444'
        : '#3b82f6',
    border: '2px solid white',
    boxShadow: isHighlighted
      ? '0 0 0 4px rgba(239, 68, 68, 0.3), 0 2px 8px rgba(0,0,0,0.3)'
      : '0 2px 8px rgba(0,0,0,0.3)',
    animation: isHighlighted ? 'pulse 1s infinite' : undefined,
    opacity: isSuggestion ? 0.8 : 1,
  };

  const isSuggestionType = 'confidence' in position;
  const roomName = 'room_name' in position ? position.room_name : '';

  return (
    <div
      ref={markerRef}
      style={markerStyle}
      onMouseDown={handleMouseDown}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onClick={(e) => {
        if (!isDragging) {
          e.stopPropagation();
          onClick?.();
        }
      }}
    >
      <div style={pinStyle} />

      {/* Tooltip */}
      {showTooltip && (
        <div
          style={{
            position: 'absolute',
            bottom: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            marginBottom: '8px',
            padding: '8px 12px',
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            color: 'white',
            borderRadius: '6px',
            fontSize: '12px',
            whiteSpace: 'nowrap',
            zIndex: 1001,
            minWidth: '120px',
          }}
        >
          <div style={{ fontWeight: 'bold' }}>{position.shelving_unit_name}</div>
          {roomName && (
            <div style={{ color: '#9ca3af', marginTop: '2px' }}>{roomName}</div>
          )}
          {isSuggestionType && (
            <>
              <div
                style={{
                  marginTop: '4px',
                  fontSize: '11px',
                  color:
                    (position as PlacementSuggestion).confidence === 'high'
                      ? '#10b981'
                      : (position as PlacementSuggestion).confidence === 'medium'
                        ? '#f59e0b'
                        : '#ef4444',
                }}
              >
                Confidence: {(position as PlacementSuggestion).confidence}
              </div>
              <div
                style={{
                  marginTop: '4px',
                  fontSize: '11px',
                  color: '#9ca3af',
                  maxWidth: '200px',
                  whiteSpace: 'normal',
                }}
              >
                {(position as PlacementSuggestion).reasoning}
              </div>
            </>
          )}

          {/* Suggestion actions */}
          {isSuggestion && (
            <div
              style={{
                marginTop: '8px',
                display: 'flex',
                gap: '8px',
              }}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onAccept?.();
                }}
                style={{
                  padding: '4px 8px',
                  fontSize: '11px',
                  backgroundColor: '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                Accept
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onReject?.();
                }}
                style={{
                  padding: '4px 8px',
                  fontSize: '11px',
                  backgroundColor: '#ef4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                Reject
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
