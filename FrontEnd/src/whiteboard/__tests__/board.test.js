import { describe, it, expect } from 'vitest';
import { Board } from '../board';
import { constrainShape, hitTest, bbox } from '../objects';
import { OP } from '../constants';

// Wire two boards so each one's local ops are delivered to the other, exactly
// like the DataChannel/socket relay would in a real 1:1 session.
function pair() {
  const A = new Board({ senderId: 'A', onLocalOp: (op) => B.applyRemoteOp(op) });
  const B = new Board({ senderId: 'B', onLocalOp: (op) => A.applyRemoteOp(op) });
  return { A, B };
}
const stroke = (id, pts, extra = {}) => ({ id, type: 'stroke', tool: 'pen', color: '#fff', width: 3, points: pts, ...extra });
const ids = (b) => [...b.objects.keys()].sort();

describe('Board op-log convergence', () => {
  it('converges when both peers draw concurrently', () => {
    const { A, B } = pair();
    A.addObject(stroke('a1', [{ x: 0, y: 0 }, { x: 10, y: 10 }]));
    B.addObject(stroke('b1', [{ x: 5, y: 5 }, { x: 20, y: 20 }]));
    A.addObject(stroke('a2', [{ x: 1, y: 1 }, { x: 2, y: 2 }]));
    expect(ids(A)).toEqual(['a1', 'a2', 'b1']);
    expect(ids(A)).toEqual(ids(B));
  });

  it('resolves concurrent edits to the same object by last-writer-wins', () => {
    const { A, B } = pair();
    A.addObject(stroke('s', [{ x: 0, y: 0 }, { x: 1, y: 1 }]));
    A.updateObject('s', { color: '#111' });
    B.updateObject('s', { color: '#222' }); // later Lamport seq wins
    expect(A.objects.get('s').color).toBe(B.objects.get('s').color);
  });

  it('keeps a delete when an older re-add arrives late', () => {
    const A = new Board({ senderId: 'A', onLocalOp: () => {} });
    A.applyRemoteOp({ t: OP.ADD, senderId: 'X', seq: 5, obj: stroke('z', [{ x: 0, y: 0 }]) });
    A.applyRemoteOp({ t: OP.DELETE, senderId: 'X', seq: 9, id: 'z' });
    A.applyRemoteOp({ t: OP.ADD, senderId: 'X', seq: 6, obj: stroke('z', [{ x: 0, y: 0 }]) }); // stale
    expect(A.objects.has('z')).toBe(false);
  });
});

describe('Undo / redo', () => {
  it('undo removes and redo resurrects an added object (tombstone-versioned)', () => {
    const { A, B } = pair();
    A.addObject(stroke('u', [{ x: 0, y: 0 }, { x: 3, y: 3 }]));
    expect(A.objects.has('u')).toBe(true);
    A.undo();
    expect(A.objects.has('u')).toBe(false);
    expect(B.objects.has('u')).toBe(false);
    A.redo();
    expect(A.objects.has('u')).toBe(true);
    expect(B.objects.has('u')).toBe(true); // redo propagated to peer
  });

  it('undo of a delete restores the object on both peers', () => {
    const { A, B } = pair();
    A.addObject(stroke('d', [{ x: 0, y: 0 }, { x: 1, y: 1 }]));
    A.deleteObjects(['d']);
    expect(B.objects.has('d')).toBe(false);
    A.undo();
    expect(A.objects.has('d')).toBe(true);
    expect(B.objects.has('d')).toBe(true);
  });
});

describe('Pixel eraser', () => {
  it('splits a stroke into surviving runs around the erased region', () => {
    const A = new Board({ senderId: 'A', onLocalOp: () => {} });
    // horizontal line of 7 points; erase the middle point
    const pts = Array.from({ length: 7 }, (_, i) => ({ x: i * 10, y: 0 }));
    A.addObject(stroke('line', pts));
    A.pixelErase([{ x: 30, y: 0 }], 5); // erase near x=30 (the 4th point)
    // original removed, replaced by two runs
    expect(A.objects.has('line')).toBe(false);
    const strokes = [...A.objects.values()].filter((o) => o.type === 'stroke');
    expect(strokes.length).toBe(2);
    expect(strokes[0].points.length).toBeGreaterThanOrEqual(2);
  });
});

describe('Geometry helpers', () => {
  it('constrains a rectangle to a square with Shift', () => {
    const c = constrainShape('rect', 0, 0, 40, 10, true);
    expect(Math.abs(c.x1 - c.x0)).toBe(Math.abs(c.y1 - c.y0));
  });
  it('snaps a line to 45° with Shift', () => {
    const c = constrainShape('line', 0, 0, 100, 5, true);
    // near-horizontal → snaps to horizontal (y1 ~= y0)
    expect(Math.round(c.y1)).toBe(0);
  });
  it('hit-tests a point on a stroke', () => {
    const s = stroke('h', [{ x: 0, y: 0 }, { x: 100, y: 0 }]);
    expect(hitTest(s, { x: 50, y: 1 }, 4)).toBe(true);
    expect(hitTest(s, { x: 50, y: 40 }, 4)).toBe(false);
  });
  it('computes a bounding box for a shape', () => {
    const b = bbox({ type: 'shape', shape: 'rect', x0: 10, y0: 20, x1: 40, y1: 60, width: 2 });
    expect(b.x).toBeLessThanOrEqual(10);
    expect(b.w).toBeGreaterThanOrEqual(30);
  });
});

describe('Snapshot round-trip', () => {
  it('restores objects and pages from a snapshot', () => {
    const A = new Board({ senderId: 'A', onLocalOp: () => {} });
    A.addObject(stroke('s1', [{ x: 0, y: 0 }, { x: 5, y: 5 }]));
    A.addPage('grid');
    const snap = A.snapshot();
    const C = new Board({ senderId: 'C', onLocalOp: () => {} });
    C.loadSnapshot(snap);
    expect(C.objects.has('s1')).toBe(true);
    expect(C.pages.length).toBe(2);
  });
});
