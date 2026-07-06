/**
 * Orbit Whiteboard — shared constants, tool + object type definitions, defaults.
 * Pure data, no dependencies. Imported by both the engine and the React layer.
 */

// Tools exposed in the toolbar. `kind` groups them for the pointer state machine.
export const TOOLS = {
  select:      { id: 'select',      kind: 'select' },
  pen:         { id: 'pen',         kind: 'draw'   },
  highlighter: { id: 'highlighter', kind: 'draw'   },
  eraserObject:{ id: 'eraserObject',kind: 'erase'  },
  eraserPixel: { id: 'eraserPixel', kind: 'erase'  },
  rect:        { id: 'rect',        kind: 'shape'  },
  ellipse:     { id: 'ellipse',     kind: 'shape'  },
  line:        { id: 'line',        kind: 'shape'  },
  arrow:       { id: 'arrow',       kind: 'shape'  },
  triangle:    { id: 'triangle',    kind: 'shape'  },
  diamond:     { id: 'diamond',     kind: 'shape'  },
  rounded:     { id: 'rounded',     kind: 'shape'  },
  text:        { id: 'text',        kind: 'text'   },
  sticky:      { id: 'sticky',      kind: 'sticky' },
  image:       { id: 'image',       kind: 'image'  },
  laser:       { id: 'laser',       kind: 'laser'  },
};

// Which tool ids draw a shape (used by the shape tool handler).
export const SHAPE_TOOLS = ['rect', 'ellipse', 'line', 'arrow', 'triangle', 'diamond', 'rounded'];

// Orbit-themed default palette (matches the cosmic accent tokens).
export const PALETTE = [
  '#ffffff', '#00c6ff', '#7c3aed', '#ff0076', '#00e5a0',
  '#ffb800', '#ff4b4b', '#a78bfa', '#33d4ff', '#0b0a20',
];

export const STICKY_COLORS = ['#ffd166', '#06d6a0', '#4cc9f0', '#f72585', '#b5179e', '#ffffff'];

export const DEFAULTS = {
  color: '#00c6ff',
  width: 3,
  highlighterWidth: 18,
  eraserSize: 24,
  fontSize: 22,
  fill: 'transparent',
};

// Op types for the sync log. Every op is idempotent and carries { senderId, seq }.
export const OP = {
  ADD:    'add',
  UPDATE: 'update',
  DELETE: 'delete',
  CLEAR:  'clear',
  PAGE_ADD: 'page-add',
  PAGE_DEL: 'page-del',
  PAGE_TPL: 'page-tpl',
};

// Page background templates.
export const TEMPLATES = ['blank', 'grid', 'dots', 'axes', 'staff', 'flow'];

// Hard caps (defense-in-depth; server enforces its own limits too).
export const LIMITS = {
  maxPoints: 4000,        // points in a single freehand stroke
  maxObjects: 5000,       // objects per board
  maxImageBytes: 3_000_000, // ~3MB dataURL cap for pasted/uploaded images
  maxPages: 25,
};

let _seq = 0;
/** Monotonic client-local id fragment (combined with senderId for global uniqueness). */
export function nextLocalId(senderId) {
  _seq += 1;
  return `${senderId}-${_seq}-${(performance.now() | 0).toString(36)}`;
}
