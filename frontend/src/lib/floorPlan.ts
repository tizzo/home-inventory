import type { FloorPlanDetailResponse, UnitPosition } from '../types/generated';

/** Largest image the backend accepts, so it always fits the AI request. */
export const MAX_FLOOR_PLAN_BYTES = 7 * 1024 * 1024;

/** Largest width or height the backend accepts. */
export const MAX_FLOOR_PLAN_DIMENSION = 8000;

/** Long edge used when an oversized image has to be re-encoded. */
export const RESIZED_FLOOR_PLAN_EDGE = 4000;

export const FLOOR_PLAN_CONTENT_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

export interface Size {
  width: number;
  height: number;
}

export function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

/** Convert a pointer location into a position on the plan. */
export function pointToPosition(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number }
): UnitPosition {
  if (rect.width <= 0 || rect.height <= 0) {
    return { x_percent: 0, y_percent: 0 };
  }
  return {
    x_percent: clampPercent(((clientX - rect.left) / rect.width) * 100),
    y_percent: clampPercent(((clientY - rect.top) / rect.height) * 100),
  };
}

/** Move a position by a pointer distance measured in pixels. */
export function movePosition(
  start: UnitPosition,
  deltaX: number,
  deltaY: number,
  size: Size
): UnitPosition {
  if (size.width <= 0 || size.height <= 0) return start;
  return {
    x_percent: clampPercent(start.x_percent + (deltaX / size.width) * 100),
    y_percent: clampPercent(start.y_percent + (deltaY / size.height) * 100),
  };
}

/** Scale a size down, keeping its shape, so neither edge exceeds maxEdge. */
export function fitWithin(size: Size, maxEdge: number): Size {
  const longest = Math.max(size.width, size.height);
  if (longest <= maxEdge) return size;
  const scale = maxEdge / longest;
  return {
    width: Math.max(1, Math.round(size.width * scale)),
    height: Math.max(1, Math.round(size.height * scale)),
  };
}

/** Whether a file can be uploaded as it is, without re-encoding. */
export function canUploadAsIs(type: string, bytes: number, size: Size): boolean {
  return (
    FLOOR_PLAN_CONTENT_TYPES.includes(type) &&
    bytes <= MAX_FLOOR_PLAN_BYTES &&
    size.width <= MAX_FLOOR_PLAN_DIMENSION &&
    size.height <= MAX_FLOOR_PLAN_DIMENSION
  );
}

/** Case-insensitive match of a search against a unit and its room. */
export function matchesSearch(query: string, unitName: string, roomName: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return false;
  return (
    unitName.toLowerCase().includes(needle) || roomName.toLowerCase().includes(needle)
  );
}

/** Copy of a floor plan with one unit's position replaced (or removed). */
export function withUnitPosition(
  detail: FloorPlanDetailResponse,
  unitId: string,
  position: UnitPosition | undefined
): FloorPlanDetailResponse {
  return {
    ...detail,
    rooms: detail.rooms.map((room) => ({
      ...room,
      units: room.units.map((unit) =>
        unit.id === unitId ? { ...unit, position } : unit
      ),
    })),
  };
}

export interface PreparedFloorPlan extends Size {
  blob: Blob;
  contentType: string;
}

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('This file could not be read as an image.'));
    };
    image.src = url;
  });
}

/**
 * Get a chosen file ready for upload. Images that are already an accepted
 * type and size go up untouched; anything else the browser can decode is
 * redrawn as a smaller JPEG.
 */
export async function prepareFloorPlanImage(file: File): Promise<PreparedFloorPlan> {
  const image = await loadImage(file);
  const original = { width: image.naturalWidth, height: image.naturalHeight };

  if (canUploadAsIs(file.type, file.size, original)) {
    return { blob: file, contentType: file.type, ...original };
  }

  const target = fitWithin(original, RESIZED_FLOOR_PLAN_EDGE);
  const canvas = document.createElement('canvas');
  canvas.width = target.width;
  canvas.height = target.height;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('This browser cannot resize the image. Try a smaller file.');
  }
  // JPEG has no transparency, so give transparent drawings a white background
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, target.width, target.height);
  context.drawImage(image, 0, 0, target.width, target.height);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', 0.9)
  );
  if (!blob || blob.size > MAX_FLOOR_PLAN_BYTES) {
    throw new Error('This image is too large even after resizing. Try a smaller file.');
  }

  return { blob, contentType: 'image/jpeg', ...target };
}
