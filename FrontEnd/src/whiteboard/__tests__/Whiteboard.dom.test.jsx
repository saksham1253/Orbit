import { describe, it, expect, beforeAll } from 'vitest';
import { render, fireEvent, screen, cleanup, act } from '@testing-library/react';
import Whiteboard from '../Whiteboard';

/**
 * Integration test: mounts the REAL <Whiteboard> component in jsdom and drives a
 * pen stroke through the actual pointer state machine → Board engine → React UI.
 * jsdom has no canvas backend, so we stub getContext and disable the rAF render
 * loop (rendering is exercised in a real browser manually; here we verify the
 * component mounts, tools render, and drawing wires through to engine state).
 */
beforeAll(() => {
  globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  // Disable the render loop so no canvas draw calls run (Path2D isn't in jsdom).
  globalThis.requestAnimationFrame = () => 0;
  globalThis.cancelAnimationFrame = () => {};
  const ctxStub = new Proxy({}, {
    get: (_t, p) => (p === 'measureText' ? () => ({ width: 10 }) : () => {}),
    set: () => true,
  });
  HTMLCanvasElement.prototype.getContext = () => ctxStub;
  if (!globalThis.PointerEvent) globalThis.PointerEvent = MouseEvent;
});

describe('<Whiteboard> component', () => {
  it('mounts without throwing and renders the full toolset', () => {
    render(<Whiteboard socket={null} pc={null} roomId="test-room" user={{ _id: 'u1', name: 'Tester' }} otherUser={{ name: 'Peer' }} onClose={() => {}} />);
    // A representative sample of the hand-built tools must be present.
    for (const title of ['Pen', 'Highlighter', 'Eraser (rub out)', 'Rectangle', 'Circle / ellipse', 'Arrow', 'Text', 'Sticky note', 'Laser pointer']) {
      expect(screen.getByTitle(title)).toBeTruthy();
    }
    cleanup();
  });

  it('drawing a pen stroke wires through to engine state (undo becomes available)', () => {
    const { container } = render(<Whiteboard socket={null} pc={null} roomId="test-room" user={{ _id: 'u1', name: 'Tester' }} otherUser={{ name: 'Peer' }} onClose={() => {}} />);
    const live = container.querySelector('.wb-live');
    expect(live).toBeTruthy();

    // Undo starts disabled (nothing drawn yet).
    expect(screen.getByTitle('Undo').disabled).toBe(true);

    // Draw a short stroke with the default pen tool.
    act(() => {
      fireEvent.pointerDown(live, { clientX: 20, clientY: 20, pointerId: 1 });
      fireEvent.pointerMove(live, { clientX: 40, clientY: 30, pointerId: 1 });
      fireEvent.pointerMove(live, { clientX: 60, clientY: 50, pointerId: 1 });
      window.dispatchEvent(new Event('pointerup'));
    });

    // The committed stroke made an undoable op → Undo is now enabled.
    expect(screen.getByTitle('Undo').disabled).toBe(false);
    cleanup();
  });

  it('switching tools updates the active tool button', () => {
    render(<Whiteboard socket={null} pc={null} roomId="test-room" user={{ _id: 'u1', name: 'Tester' }} otherUser={{ name: 'Peer' }} onClose={() => {}} />);
    const rect = screen.getByTitle('Rectangle');
    fireEvent.click(rect);
    expect(rect.className).toContain('active');
    cleanup();
  });
});
