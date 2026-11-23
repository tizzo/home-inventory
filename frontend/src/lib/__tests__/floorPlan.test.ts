import { describe, it, expect } from 'vitest';
import {
  MAX_FLOOR_PLAN_BYTES,
  canUploadAsIs,
  clampPercent,
  fitWithin,
  matchesSearch,
  movePosition,
  pointToPosition,
  withUnitPosition,
} from '../floorPlan';
import type { FloorPlanDetailResponse } from '../../types/generated';

describe('floor plan helpers', () => {
  it('clamps percentages to the image', () => {
    expect(clampPercent(-5)).toBe(0);
    expect(clampPercent(42.5)).toBe(42.5);
    expect(clampPercent(140)).toBe(100);
    expect(clampPercent(Number.NaN)).toBe(0);
  });

  it('converts a pointer location into a position', () => {
    const rect = { left: 100, top: 50, width: 400, height: 200 };
    expect(pointToPosition(200, 100, rect)).toEqual({ x_percent: 25, y_percent: 25 });
    // Outside the image is pinned to its edge
    expect(pointToPosition(0, 1000, rect)).toEqual({ x_percent: 0, y_percent: 100 });
    // An image that has not been laid out yet cannot be measured
    expect(pointToPosition(10, 10, { left: 0, top: 0, width: 0, height: 0 })).toEqual({
      x_percent: 0,
      y_percent: 0,
    });
  });

  it('moves a position by a pixel distance', () => {
    const start = { x_percent: 50, y_percent: 50 };
    const size = { width: 400, height: 200 };
    expect(movePosition(start, 40, -20, size)).toEqual({ x_percent: 60, y_percent: 40 });
    expect(movePosition(start, 4000, 0, size)).toEqual({ x_percent: 100, y_percent: 50 });
  });

  it('scales oversized images down and leaves others alone', () => {
    expect(fitWithin({ width: 8000, height: 4000 }, 4000)).toEqual({
      width: 4000,
      height: 2000,
    });
    expect(fitWithin({ width: 1200, height: 900 }, 4000)).toEqual({
      width: 1200,
      height: 900,
    });
  });

  it('only uploads accepted types and sizes untouched', () => {
    const size = { width: 2000, height: 1500 };
    expect(canUploadAsIs('image/png', 1000, size)).toBe(true);
    expect(canUploadAsIs('image/heic', 1000, size)).toBe(false);
    expect(canUploadAsIs('image/png', MAX_FLOOR_PLAN_BYTES + 1, size)).toBe(false);
    expect(canUploadAsIs('image/png', 1000, { width: 9000, height: 1500 })).toBe(false);
  });

  it('matches a search against unit and room names', () => {
    expect(matchesSearch('rack', 'Metal Rack', 'Garage')).toBe(true);
    expect(matchesSearch('GAR', 'Metal Rack', 'Garage')).toBe(true);
    expect(matchesSearch('attic', 'Metal Rack', 'Garage')).toBe(false);
    expect(matchesSearch('   ', 'Metal Rack', 'Garage')).toBe(false);
  });

  it('replaces and removes a unit position without touching other units', () => {
    const detail = {
      floor_plan: { id: 'fp' },
      rooms: [
        {
          id: 'r1',
          name: 'Garage',
          units: [
            { id: 'u1', name: 'Rack' },
            { id: 'u2', name: 'Bench', position: { x_percent: 1, y_percent: 2 } },
          ],
        },
      ],
    } as unknown as FloorPlanDetailResponse;

    const placed = withUnitPosition(detail, 'u1', { x_percent: 10, y_percent: 20 });
    expect(placed.rooms[0].units[0].position).toEqual({ x_percent: 10, y_percent: 20 });
    expect(placed.rooms[0].units[1].position).toEqual({ x_percent: 1, y_percent: 2 });
    expect(detail.rooms[0].units[0].position).toBeUndefined();

    const removed = withUnitPosition(placed, 'u2', undefined);
    expect(removed.rooms[0].units[1].position).toBeUndefined();
  });
});
