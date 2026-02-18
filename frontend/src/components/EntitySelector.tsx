import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { useRooms, useShelvingUnits, useShelves, useContainers, useItems } from '../hooks';
import { labelsApi } from '../api';
import type { RoomResponse, ShelvingUnitResponse, ShelfResponse, ContainerResponse, ItemResponse } from '../types/generated';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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
    <div ref={containerRef} className="relative">
      {label && (
        <Label htmlFor={`entity-selector-${entityType}`} className="mb-2 block">
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
      )}
      <div className="flex gap-2 items-stretch">
        <div className="flex-1 relative">
          <Input
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
            className={selectedEntity ? 'pr-8' : ''}
          />
          {selectedEntity && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 text-lg leading-none"
              aria-label="Clear selection"
            >
              &times;
            </button>
          )}

          {/* Dropdown */}
          {isOpen && !showScanner && (
            <div className="absolute top-full left-0 right-0 z-50 bg-background border border-border rounded-md mt-1 max-h-[200px] sm:max-h-[300px] overflow-y-auto shadow-lg">
              {filteredEntities.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">
                  {searchQuery ? 'No matches found' : 'No entities available'}
                </div>
              ) : (
                filteredEntities.map((entity) => (
                  <button
                    key={entity.id}
                    type="button"
                    onClick={() => handleSelect(entity)}
                    className={`w-full px-3 py-2 min-h-[44px] flex items-center text-left border-b border-border last:border-b-0 hover:bg-accent transition-colors ${
                      entity.id === value ? 'bg-primary/10' : ''
                    }`}
                  >
                    {entity.displayText}
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* QR Scanner Button */}
        <Button
          type="button"
          variant="secondary"
          onClick={handleScanClick}
          onMouseDown={(e) => {
            // Prevent blur event from firing when clicking the button
            e.preventDefault();
            e.stopPropagation();
          }}
          className="whitespace-nowrap h-10"
        >
          {scannerActive ? 'Stop' : 'Scan'}
        </Button>
      </div>

      {/* QR Scanner - Always render when isOpen, but only show when showScanner is true */}
      {isOpen && (
        <div
          className={`mt-4 p-4 bg-muted rounded-lg border-2 border-primary ${showScanner ? 'block' : 'hidden'}`}
        >
          <div className="font-semibold mb-2">
            Scan Label QR Code
          </div>
          <div
            id={`qr-scanner-${entityType}`}
            ref={scannerElementRef}
            className="w-full max-w-full sm:max-w-[400px] mx-auto"
          />
          <p className="text-sm text-muted-foreground mt-2">
            Point camera at label QR code
          </p>
        </div>
      )}
    </div>
  );
}
