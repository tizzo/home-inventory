import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { useRooms, useShelvingUnits, useShelves, useContainers, useItems } from '../hooks';
import { labelsApi } from '../api';
import type { RoomResponse, ShelvingUnitResponse, ShelfResponse, ContainerResponse, ItemResponse } from '../types/generated';

export type EntityType = 'room' | 'unit' | 'shelf' | 'container' | 'item';

interface EntitySelectorProps {
  entityType: EntityType;
  value?: string;
  onChange: (entityId: string | undefined) => void;
  required?: boolean;
  placeholder?: string;
  label?: string;
}

interface Entity {
  id: string;
  name: string;
  displayText: string;
}

// Simple fuzzy match function
const fuzzyMatch = (text: string, query: string): boolean => {
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  
  // Exact match
  if (lowerText.includes(lowerQuery)) return true;
  
  // Fuzzy match: check if all query characters appear in order
  let queryIndex = 0;
  for (let i = 0; i < lowerText.length && queryIndex < lowerQuery.length; i++) {
    if (lowerText[i] === lowerQuery[queryIndex]) {
      queryIndex++;
    }
  }
  return queryIndex === lowerQuery.length;
};

export default function EntitySelector({
  entityType,
  value,
  onChange,
  required = false,
  placeholder,
  label,
}: EntitySelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [scannerActive, setScannerActive] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerElementRef = useRef<HTMLDivElement>(null);
  const scanButtonClickedRef = useRef(false);

  // Fetch entities based on type
  const { data: roomsResponse } = useRooms({ limit: 1000 });
  const { data: unitsResponse } = useShelvingUnits({ limit: 1000 });
  const { data: shelvesResponse } = useShelves({ limit: 1000 });
  const { data: containersResponse } = useContainers({ limit: 1000 });
  const { data: itemsResponse } = useItems({ limit: 1000 });

  // Get entities based on type
  const allEntities = useMemo(() => {
    switch (entityType) {
      case 'room':
        return (roomsResponse?.data || []).map((r: RoomResponse) => ({
          id: r.id,
          name: r.name,
          displayText: r.name,
        }));
      case 'unit':
        return (unitsResponse?.data || []).map((u: ShelvingUnitResponse) => ({
          id: u.id,
          name: u.name,
          displayText: u.name,
        }));
      case 'shelf':
        return (shelvesResponse?.data || []).map((s: ShelfResponse) => ({
          id: s.id,
          name: s.name,
          displayText: s.name,
        }));
      case 'container':
        return (containersResponse?.data || []).map((c: ContainerResponse) => ({
          id: c.id,
          name: c.name,
          displayText: c.name,
        }));
      case 'item':
        return (itemsResponse?.data || []).map((i: ItemResponse) => ({
          id: i.id,
          name: i.name,
          displayText: i.name,
        }));
      default:
        return [];
    }
  }, [entityType, roomsResponse, unitsResponse, shelvesResponse, containersResponse, itemsResponse]);

  // Get selected entity
  const selectedEntity = useMemo(() => {
    return allEntities.find((e) => e.id === value);
  }, [allEntities, value]);

  // Filter entities based on search query
  const filteredEntities = useMemo(() => {
    if (!searchQuery.trim()) {
      return allEntities;
    }
    return allEntities.filter((entity) => fuzzyMatch(entity.displayText, searchQuery));
  }, [allEntities, searchQuery]);

  // Stop scanner function
  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch (err) {
        console.error('Error stopping scanner:', err);
      }
      scannerRef.current = null;
    }
    setScannerActive(false);
    setShowScanner(false);
  }, []);

  // Handle QR code scan result
  const handleQrScan = useCallback(async (qrData: string) => {
    try {
      // Extract label ID from URL format: /l/{label_id} or http://.../l/{label_id}
      const match = qrData.match(/\/l\/([a-f0-9-]+)/i);
      if (!match) {
        alert('Invalid QR code format. Expected label URL.');
        return;
      }

      const labelId = match[1];
      
      // Fetch label via API
      const label = await labelsApi.getById(labelId);
      
      // Map label entity type to selector entity type
      const typeMap: Record<string, EntityType> = {
        room: 'room',
        unit: 'unit',
        shelf: 'shelf',
        container: 'container',
        item: 'item',
      };
      
      if (!label.assigned_to_id) {
        alert('This label is not assigned to any entity.');
        return;
      }

      const labelEntityType = label.assigned_to_type ? typeMap[label.assigned_to_type] : undefined;
      if (!labelEntityType || labelEntityType !== entityType) {
        alert(`This label is assigned to a ${label.assigned_to_type || 'unknown'}, not a ${entityType}.`);
        return;
      }

      // Set the selected entity
      onChange(label.assigned_to_id);
      setIsOpen(false);
      await stopScanner();
    } catch (err) {
      console.error('Error processing QR scan:', err);
      alert('Failed to process QR code. Please try again.');
    }
  }, [entityType, onChange, stopScanner]);

  // Start scanner function
  const startScanner = useCallback(async () => {
    if (scannerActive) {
      console.log('EntitySelector: Scanner already active, skipping');
      return;
    }

    console.log('EntitySelector: Starting scanner, setting showScanner=true');
    // First, show the scanner UI
    setShowScanner(true);
    setScannerActive(true);
    
    // Wait for DOM to update and element to be available
    // Use requestAnimationFrame to ensure DOM is ready
    requestAnimationFrame(() => {
      setTimeout(async () => {
        // Check if element exists - it should be rendered now
        const elementId = `qr-scanner-${entityType}`;
        const element = document.getElementById(elementId);
        console.log('EntitySelector: Looking for scanner element:', elementId, element ? 'found' : 'not found');
        
        if (!element) {
          console.warn('EntitySelector: Scanner element not found in DOM after render');
          setScannerActive(false);
          setShowScanner(false);
          return;
        }

        try {
          console.log('EntitySelector: Creating Html5Qrcode instance');
          const html5QrCode = new Html5Qrcode(element.id);
          scannerRef.current = html5QrCode;

          console.log('EntitySelector: Starting camera...');
          await html5QrCode.start(
            { facingMode: 'environment' },
            {
              fps: 10,
              qrbox: { width: 250, height: 250 },
            },
            (decodedText) => {
              console.log('EntitySelector: QR code scanned:', decodedText);
              // Handle scanned QR code
              handleQrScan(decodedText).catch(console.error);
            },
            () => {
              // Ignore scanning errors (they're frequent during scanning)
            }
          );
          console.log('EntitySelector: Camera started successfully');
        } catch (err) {
          console.error('EntitySelector: Error starting scanner:', err);
          // Don't show alert - just silently fail (user can still type)
          setScannerActive(false);
          setShowScanner(false);
        }
      }, 200); // Increased delay to ensure DOM is ready
    });
  }, [scannerActive, handleQrScan, entityType]);

  // Stop scanner when dropdown closes
  useEffect(() => {
    if (!isOpen && scannerActive) {
      console.log('EntitySelector: Dropdown closed, stopping scanner...');

      // eslint-disable-next-line react-hooks/set-state-in-effect
      stopScanner().catch((err) => {
        console.error('EntitySelector: Failed to stop scanner:', err);
      });
    }
  }, [isOpen, scannerActive, stopScanner]);

  // Close dropdown when clicking outside (but not when scanner is active)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        // Don't close if scanner is active - user might be interacting with camera
        if (!scannerActive) {
          setIsOpen(false);
        }
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, scannerActive]);

  // Handle manual scan button toggle
  const handleScanClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    scanButtonClickedRef.current = true;
    
    if (scannerActive) {
      console.log('EntitySelector: Scan button clicked, stopping scanner');
      await stopScanner();
      // Also close dropdown when stopping
      setIsOpen(false);
    } else {
      console.log('EntitySelector: Scan button clicked, starting scanner');
      // Ensure dropdown is open when manually starting scanner
      if (!isOpen) {
        setIsOpen(true);
      }
      // Wait a bit for dropdown to open, then start scanner
      setTimeout(() => {
        startScanner().catch(console.error);
      }, 100);
    }
    
    // Reset flag after a short delay
    setTimeout(() => {
      scanButtonClickedRef.current = false;
    }, 300);
  };

  // Cleanup scanner on unmount
  useEffect(() => {
    return () => {
      stopScanner().catch(console.error);
    };
  }, [stopScanner]);

  const handleSelect = (entity: Entity) => {
    onChange(entity.id);
    setSearchQuery('');
    setIsOpen(false);
  };

  const handleClear = () => {
    onChange(undefined);
    setSearchQuery('');
  };

  return (
    <div className="form-group" ref={containerRef} style={{ position: 'relative' }}>
      {label && (
        <label htmlFor={`entity-selector-${entityType}`}>
          {label}
          {required && <span style={{ color: 'var(--error-color)' }}> *</span>}
        </label>
      )}
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'stretch' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <input
            id={`entity-selector-${entityType}`}
            type="text"
            value={selectedEntity ? selectedEntity.displayText : searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setIsOpen(true);
              if (selectedEntity) {
                onChange(undefined);
              }
            }}
            onFocus={() => {
              console.log('EntitySelector: Input focused, setting isOpen=true');
              setIsOpen(true);
            }}
            onBlur={() => {
              // Only close if we're not clicking on the scan button or scanner area
              // Use setTimeout to allow click events to fire first
              setTimeout(() => {
                // Don't close if scan button was just clicked
                if (scanButtonClickedRef.current) {
                  console.log('EntitySelector: Ignoring blur - scan button was clicked');
                  return;
                }
                
                const activeElement = document.activeElement;
                const container = containerRef.current;
                // Don't close if focus moved to something inside the container (like scan button)
                if (container && !container.contains(activeElement)) {
                  console.log('EntitySelector: Input blurred, closing dropdown and stopping scanner');
                  if (scannerActive) {
                    stopScanner().catch(console.error);
                  }
                  setIsOpen(false);
                }
              }, 150);
            }}
            placeholder={placeholder || `Search ${entityType}...`}
            required={required}
            style={{ width: '100%' }}
          />
          {selectedEntity && (
            <button
              type="button"
              onClick={handleClear}
              style={{
                position: 'absolute',
                right: '0.5rem',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '1.2rem',
                color: 'var(--text-secondary)',
                padding: '0.25rem',
              }}
              aria-label="Clear selection"
            >
              ×
            </button>
          )}

          {/* Dropdown */}
          {isOpen && !showScanner && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                zIndex: 1000,
                background: 'var(--surface-color)',
                border: '1px solid var(--border-color)',
                borderRadius: '0.5rem',
                marginTop: '0.25rem',
                maxHeight: '300px',
                overflowY: 'auto',
                boxShadow: 'var(--shadow-lg)',
              }}
            >
              {filteredEntities.length === 0 ? (
                <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  {searchQuery ? 'No matches found' : 'No entities available'}
                </div>
              ) : (
                filteredEntities.map((entity) => (
                  <button
                    key={entity.id}
                    type="button"
                    onClick={() => handleSelect(entity)}
                    style={{
                      width: '100%',
                      padding: '0.75rem 1rem',
                      textAlign: 'left',
                      background: entity.id === value ? 'rgba(var(--primary-color-rgb), 0.1)' : 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      borderBottom: '1px solid var(--border-color)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--bg-color)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background =
                        entity.id === value ? 'rgba(var(--primary-color-rgb), 0.1)' : 'transparent';
                    }}
                  >
                    {entity.displayText}
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* QR Scanner Button */}
        <button
          type="button"
          onClick={handleScanClick}
          onMouseDown={(e) => {
            // Prevent blur event from firing when clicking the button
            e.preventDefault();
            e.stopPropagation();
          }}
          className="btn btn-secondary"
          style={{ whiteSpace: 'nowrap' }}
        >
          {scannerActive ? '📷 Stop' : '📷 Scan'}
        </button>
      </div>

      {/* QR Scanner - Always render when isOpen, but only show when showScanner is true */}
      {isOpen && (
        <div
          style={{
            marginTop: '1rem',
            padding: '1rem',
            background: 'var(--bg-color)',
            borderRadius: '0.5rem',
            border: '2px solid var(--primary-color)',
            display: showScanner ? 'block' : 'none',
          }}
        >
          <div style={{ marginBottom: '0.5rem', fontWeight: 600 }}>
            Scan Label QR Code
          </div>
          <div
            id={`qr-scanner-${entityType}`}
            ref={scannerElementRef}
            style={{
              width: '100%',
              maxWidth: '400px',
              margin: '0 auto',
            }}
          />
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.5rem', marginBottom: 0 }}>
            Point camera at label QR code
          </p>
        </div>
      )}
    </div>
  );
}
