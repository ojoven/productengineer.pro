// Shape of geometry.json. Geometry is kept apart from content, so a re-layout or a
// second map style never touches the taxonomy. Coordinates are world units.

export type Pt = [number, number];

export interface Geometry {
  version: 1;
  width: number;
  height: number;
  /** Continent outline, closed. */
  coast: Pt[];
  /** Island outline per cross-cutting capability. */
  islands: Record<string, Pt[]>;
  /** Territory outline and the anchor for its name. */
  territories: Record<string, { outline: Pt[]; label: Pt }>;
  /** Borders between territories, each drawn once. */
  borders: Pt[][];
  /** Position of every capability and skill, keyed by id. Frozen once written. */
  points: Record<string, Pt>;
}

export type Box = { x: number; y: number; w: number; h: number };

export function bbox(points: Pt[]): Box {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of points) {
    if (x < x0) x0 = x;
    if (y < y0) y0 = y;
    if (x > x1) x1 = x;
    if (y > y1) y1 = y;
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

export function pointInPolygon([x, y]: Pt, poly: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
