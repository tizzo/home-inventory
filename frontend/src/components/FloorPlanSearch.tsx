import { useState, useEffect, useRef, useMemo } from 'react';
import type { PositionResponse } from '../types/generated';
import '../App.css';

interface FloorPlanSearchProps {
  positions: PositionResponse[];
  onSearchChange: (query: string) => void;
  onSelectPosition?: (position: PositionResponse) => void;
}

export function FloorPlanSearch({
  positions,
  onSearchChange,
  onSelectPosition,
}: FloorPlanSearchProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Compute filtered results directly from query and positions
  const results = useMemo(() => {
    if (!query.trim()) {
      return [];
    }
    const lowerQuery = query.toLowerCase();
    return positions.filter(
      (p) =>
        p.shelving_unit_name.toLowerCase().includes(lowerQuery) ||
        p.room_name.toLowerCase().includes(lowerQuery)
    );
  }, [query, positions]);

  // Notify parent of search changes
  useEffect(() => {
    onSearchChange(query);
  }, [query, onSearchChange]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (position: PositionResponse) => {
    setIsOpen(false);
    onSelectPosition?.(position);
  };

  return (
    <div ref={containerRef} className="floor-plan-search">
      <div className="search-input-container">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsOpen(true)}
          placeholder="Search shelving units..."
          className="search-input"
        />
        {query && (
          <button
            className="search-clear"
            onClick={() => {
              setQuery('');
              inputRef.current?.focus();
            }}
          >
            x
          </button>
        )}
      </div>

      {isOpen && results.length > 0 && (
        <div className="search-results">
          {results.map((position) => (
            <div
              key={position.id}
              className="search-result-item"
              onClick={() => handleSelect(position)}
            >
              <div className="result-name">{position.shelving_unit_name}</div>
              <div className="result-room">{position.room_name}</div>
            </div>
          ))}
        </div>
      )}

      {isOpen && query && results.length === 0 && (
        <div className="search-results">
          <div className="no-results">No matching units found</div>
        </div>
      )}
    </div>
  );
}
