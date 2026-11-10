// Terrain and node glyphs for both map styles. Each glyph is drawn in screen pixels around
// (0,0), with its base at y=0, and placed with translate + scale(1/k) so it stays the same
// size at every zoom level.

export type GlyphName =
  | 'tree' | 'pine' | 'hill' | 'mountain' | 'house' | 'tower' | 'castle' | 'workshop'
  | 'field' | 'tent' | 'dome' | 'wave' | 'boat' | 'gate';

/** Ink: single-colour pen strokes, filled with paper so nearer glyphs overlap farther ones. */
const ink: Record<GlyphName, string> = {
  tree: '<path class="gp" d="M0,-13c4,0 7,3 6,6c2,2 0,6-3,6c-1,2-5,2-6,0c-3,0-5-4-3-6c-1-3 2-6 6-6z"/><path class="gs" d="M0,-1v4M-2,-6l2,2l2-3"/>',
  pine: '<path class="gp" d="M0,-15l5,7h-2.5l4,6h-13l4-6h-2.5z"/><path class="gs" d="M0,-2v4"/>',
  hill: '<path class="gs" d="M-11,2c3-7 8-9 12-8c4 1 7 4 9 8M-2,-3c1,1 2,2 2,4"/>',
  mountain: '<path class="gp" d="M-13,3l9-15l4,6l3-4l10,13z"/><path class="gs" d="M-4,-12l2,5M1,-6l1,3M3,-3l1,3M6,-6l2,3M7,-3l2,3M-6,-5l-1,3"/>',
  house: '<path class="gp" d="M-6,3v-7l6-5l6,5v7z"/><path class="gs" d="M-1,3v-4h2v4M-7,-3.5l7-6l7,6"/>',
  tower: '<path class="gp" d="M-3,3v-12h6v12z"/><path class="gp" d="M-4.5,-9l4.5-6l4.5,6z"/><path class="gs" d="M-1,-5h2M-1,-1h2"/>',
  castle: '<path class="gp" d="M-9,3v-9h3v2h2v-2h3v-3h3v3h3v-2h2v2h2v9z"/><path class="gs" d="M-1.5,3v-4a1.5,1.5 0 0 1 3,0v4M0,-9v-5l3,1l-3,1"/>',
  workshop: '<path class="gp" d="M-8,3v-7l5-3v3l5-3v3l5-3v10z"/><path class="gp" d="M4,-8v-5h2.5v5"/><path class="gs" d="M5,-15c-2-2 2-3 0-5"/>',
  field: '<path class="gp" d="M-11,2l4-7h15l-4,7z"/><path class="gs" d="M-8,0.5h15M-6.5,-2h15M-5,-4h12"/>',
  tent: '<path class="gp" d="M-7,3l7-11l7,11z"/><path class="gs" d="M0,-8v-4l3,1l-3,1M-2,3l2-5l2,5"/>',
  dome: '<path class="gp" d="M-6,3v-5h12v5z"/><path class="gp" d="M-5,-2a5,5 0 0 1 10,0z"/><path class="gs" d="M1,-5l6-5"/>',
  wave: '<path class="gs" d="M-9,0c2-3 4-3 6,0s4,3 6,0s4-3 6,0"/>',
  boat: '<path class="gp" d="M-8,0h16l-3,3h-10z"/><path class="gp" d="M0,0v-12l6,10z"/><path class="gs" d="M0,0v-12"/>',
  gate: '<path class="gp" d="M-8,3v-11h4v-2h8v2h4v11z"/><path class="gs" d="M-3,3v-5a3,3 0 0 1 6,0v5"/>',
};

/** Illustrated: coloured shapes with a darker outline, closer to a painted fantasy map. */
const illustrated: Record<GlyphName, string> = {
  tree: '<path class="gt" d="M0,-13c4,0 7,3 6,6c2,2 0,6-3,6c-1,2-5,2-6,0c-3,0-5-4-3-6c-1-3 2-6 6-6z"/><path class="gk" d="M0,-1v4"/>',
  pine: '<path class="gt" d="M0,-15l5,7h-2.5l4,6h-13l4-6h-2.5z"/><path class="gk" d="M0,-2v4"/>',
  hill: '<path class="gh" d="M-11,3c3-8 8-10 12-9c4 1 7 5 9 9z"/>',
  mountain: '<path class="gm" d="M-13,3l9-15l4,6l3-4l10,13z"/><path class="gms" d="M-4,-12l3,15h-9zM3,-10l2,13h5z"/><path class="gsn" d="M-4,-12l2.5,4l-2,-0.5l-2,1.5z"/>',
  house: '<path class="gw" d="M-6,3v-7h12v7z"/><path class="gr" d="M-7.5,-3.5l7.5-6l7.5,6z"/><path class="gk" d="M-1,3v-3h2v3"/>',
  tower: '<path class="gw" d="M-3,3v-12h6v12z"/><path class="gr" d="M-4.5,-9l4.5-6l4.5,6z"/>',
  castle: '<path class="gw" d="M-9,3v-9h3v2h2v-2h3v-3h3v3h3v-2h2v2h2v9z"/><path class="gr" d="M0,-9v-5l4,1.5l-4,1.5"/><path class="gk" d="M-1.5,3v-4a1.5,1.5 0 0 1 3,0v4"/>',
  workshop: '<path class="gw" d="M-8,3v-7l5-3v3l5-3v3l5-3v10z"/><path class="gr" d="M4,-8v-5h2.5v5z"/><path class="gsm" d="M5,-15c-2-2 2-3 0-5"/>',
  field: '<path class="gf" d="M-11,2l4-7h15l-4,7z"/><path class="gfl" d="M-8,0.5h15M-6.5,-2h15M-5,-4h12"/>',
  tent: '<path class="gr" d="M-7,3l7-11l7,11z"/><path class="gk" d="M0,-8v-4l3,1l-3,1"/>',
  dome: '<path class="gw" d="M-6,3v-5h12v5z"/><path class="gd" d="M-5,-2a5,5 0 0 1 10,0z"/><path class="gk" d="M1,-5l6-5"/>',
  wave: '<path class="gwv" d="M-9,0c2-3 4-3 6,0s4,3 6,0s4-3 6,0"/>',
  boat: '<path class="gbh" d="M-8,0h16l-3,3h-10z"/><path class="gw" d="M0,0v-12l6,10z"/>',
  gate: '<path class="gw" d="M-8,3v-11h4v-2h8v2h4v11z"/><path class="gk" d="M-3,3v-5a3,3 0 0 1 6,0v5"/>',
};

export const GLYPHS = { ink, illustrated };

/**
 * Glyphs are drawn through <use>, and stylesheet rules do not reach inside a <use> clone,
 * so each part gets an inline style. Custom properties still inherit, so themes work.
 */
const PART_STYLE: Record<string, string> = {
  gp: 'fill:var(--m-land);stroke:var(--m-ink);stroke-width:1.1;stroke-linejoin:round',
  gs: 'fill:none;stroke:var(--m-ink);stroke-width:1.1;stroke-linecap:round;stroke-linejoin:round',
  gt: 'fill:var(--m-tree);stroke:var(--m-tree-k);stroke-width:.9',
  gk: 'fill:none;stroke:var(--m-tree-k);stroke-width:1.1;stroke-linecap:round',
  gh: 'fill:var(--m-hillc);stroke:var(--m-mtn-s);stroke-width:.7',
  gm: 'fill:var(--m-mtn);stroke:var(--m-mtn-s);stroke-width:.9;stroke-linejoin:round',
  gms: 'fill:var(--m-mtn-s);opacity:.55',
  gsn: 'fill:var(--m-snow)',
  gw: 'fill:var(--m-wall);stroke:var(--m-ink-soft);stroke-width:.8;stroke-linejoin:round',
  gr: 'fill:var(--m-roof);stroke:var(--m-ink-soft);stroke-width:.8;stroke-linejoin:round',
  gsm: 'fill:none;stroke:var(--m-ink-soft);stroke-width:.9;opacity:.7',
  gf: 'fill:var(--m-field);stroke:var(--m-field-l);stroke-width:.8',
  gfl: 'fill:none;stroke:var(--m-field-l);stroke-width:.8',
  gd: 'fill:var(--m-dome);stroke:var(--m-ink-soft);stroke-width:.8',
  gwv: 'fill:none;stroke:var(--m-wave);stroke-width:1.2;stroke-linecap:round',
  gbh: 'fill:var(--m-hull);stroke:var(--m-ink-soft);stroke-width:.8',
};

export function glyphDefs(style: 'ink' | 'illustrated', prefix: string): string {
  return Object.entries(GLYPHS[style])
    .map(([name, body]) => {
      let inner = body.replace(/class="(\w+)"/g, (_, c: string) => `style="${PART_STYLE[c]}"`);
      if (style === 'ink' && name === 'wave') inner = inner.replace('stroke:var(--m-ink)', 'stroke:var(--m-ink-soft)');
      return `<symbol id="${prefix}-${name}" overflow="visible">${inner}</symbol>`;
    })
    .join('');
}

/** Terrain carries meaning: forests for discovery, mountains for strategy, and so on. */
export const TERRAIN: Record<string, [GlyphName, number][]> = {
  discovery: [['tree', 5], ['pine', 4], ['hill', 1]],
  strategy: [['mountain', 6], ['pine', 2], ['hill', 2]],
  experience: [['house', 4], ['tree', 3], ['hill', 2]],
  engineering: [['workshop', 3], ['mountain', 3], ['pine', 2], ['hill', 1]],
  shipping: [['house', 2], ['tree', 3], ['hill', 3], ['tower', 1]],
  measurement: [['dome', 1], ['hill', 4], ['tree', 3], ['tower', 1]],
  activation: [['gate', 1], ['house', 3], ['tree', 2], ['hill', 2]],
  retention: [['field', 6], ['tree', 2], ['house', 1]],
  distribution: [['tent', 2], ['hill', 4], ['tree', 3]],
  operations: [['castle', 2], ['mountain', 3], ['pine', 3]],
  sea: [['wave', 1]],
};

/** The landmark drawn for a capability at world zoom, by territory. */
export const LANDMARK: Record<string, GlyphName> = {
  discovery: 'pine',
  strategy: 'tower',
  experience: 'house',
  engineering: 'workshop',
  shipping: 'boat',
  measurement: 'dome',
  activation: 'gate',
  retention: 'field',
  distribution: 'tent',
  operations: 'castle',
  'cross-cutting': 'tower',
};
