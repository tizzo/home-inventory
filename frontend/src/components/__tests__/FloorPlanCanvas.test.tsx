import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent } from '@testing-library/react';
import { render, screen } from '../../test/utils';
import FloorPlanCanvas from '../FloorPlanCanvas';
import type { CanvasMarker } from '../FloorPlanCanvas';

const rack: CanvasMarker = {
  id: 'u1',
  name: 'Metal Rack',
  roomName: 'Garage',
  position: { x_percent: 50, y_percent: 50 },
};

const baseProps = {
  imageUrl: 'https://example.test/plan.png',
  alt: 'Floor plan',
  width: 400,
  height: 200,
  markers: [rack],
};

describe('FloorPlanCanvas', () => {
  beforeEach(() => {
    // jsdom does no layout, so give the plan a 400x200 box at the page origin
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      right: 400,
      bottom: 200,
      width: 400,
      height: 200,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    // jsdom has no pointer events; mouse events carry the same coordinates
    HTMLElement.prototype.setPointerCapture = vi.fn();
    vi.stubGlobal('PointerEvent', MouseEvent);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('selects a marker when it is tapped', () => {
    const onSelect = vi.fn();
    const onMove = vi.fn();
    render(<FloorPlanCanvas {...baseProps} editable onSelect={onSelect} onMove={onMove} />);

    const marker = screen.getByRole('button', { name: 'Metal Rack, Garage' });
    fireEvent.pointerDown(marker, { button: 0, clientX: 200, clientY: 100 });
    fireEvent.pointerUp(marker, { clientX: 200, clientY: 100 });
    fireEvent.click(marker);

    expect(onSelect).toHaveBeenCalledWith('u1');
    expect(onMove).not.toHaveBeenCalled();
  });

  it('moves a marker when it is dragged, without selecting it', () => {
    const onSelect = vi.fn();
    const onMove = vi.fn();
    render(<FloorPlanCanvas {...baseProps} editable onSelect={onSelect} onMove={onMove} />);

    const marker = screen.getByRole('button', { name: 'Metal Rack, Garage' });
    fireEvent.pointerDown(marker, { button: 0, clientX: 200, clientY: 100 });
    fireEvent.pointerMove(marker, { clientX: 240, clientY: 80 });
    fireEvent.pointerUp(marker, { clientX: 240, clientY: 80 });
    // Browsers send a click after the pointer is released
    fireEvent.click(marker);

    expect(onMove).toHaveBeenCalledTimes(1);
    expect(onMove).toHaveBeenCalledWith('u1', { x_percent: 60, y_percent: 40 });
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('does not move markers when the plan is not editable', () => {
    const onMove = vi.fn();
    render(<FloorPlanCanvas {...baseProps} onMove={onMove} />);

    const marker = screen.getByRole('button', { name: 'Metal Rack, Garage' });
    fireEvent.pointerDown(marker, { button: 0, clientX: 200, clientY: 100 });
    fireEvent.pointerMove(marker, { clientX: 300, clientY: 150 });
    fireEvent.pointerUp(marker, { clientX: 300, clientY: 150 });

    expect(onMove).not.toHaveBeenCalled();
  });

  it('places the waiting unit where the plan is tapped', () => {
    const onPlace = vi.fn();
    render(
      <FloorPlanCanvas {...baseProps} editable placingName="Workbench" onPlace={onPlace} />
    );

    expect(screen.getByText(/Tap the plan to place/)).toBeInTheDocument();
    fireEvent.click(screen.getByAltText('Floor plan'), { clientX: 100, clientY: 150 });

    expect(onPlace).toHaveBeenCalledWith({ x_percent: 25, y_percent: 75 });
  });

  it('does not place a unit when an existing marker is tapped', () => {
    const onPlace = vi.fn();
    render(
      <FloorPlanCanvas {...baseProps} editable placingName="Workbench" onPlace={onPlace} />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Metal Rack, Garage' }));

    expect(onPlace).not.toHaveBeenCalled();
  });

  it('ignores taps on the plan when nothing is waiting to be placed', () => {
    const onPlace = vi.fn();
    render(<FloorPlanCanvas {...baseProps} editable onPlace={onPlace} />);

    fireEvent.click(screen.getByAltText('Floor plan'), { clientX: 100, clientY: 150 });

    expect(onPlace).not.toHaveBeenCalled();
  });

  it('labels suggested positions so they can be told apart', () => {
    render(
      <FloorPlanCanvas
        {...baseProps}
        markers={[]}
        suggestions={[{ ...rack, position: { x_percent: 10, y_percent: 10 } }]}
      />
    );

    expect(
      screen.getByRole('button', { name: 'Metal Rack, Garage (suggested)' })
    ).toBeInTheDocument();
  });
});
