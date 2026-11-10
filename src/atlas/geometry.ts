// Shape of geometry.json: a hex-tile atlas. Every skill is one hexagon; a capability is a
// connected cluster of its skills' hexagons; a territory is a region of clusters. Geometry is
// kept apart from content, so a re-layout never touches the taxonomy.

export type Pt = [number, number];
export type Hex = [number, number]; // axial q, r (pointy-top)

export interface Geometry {
  version: 2;
  /** Hexagon circumradius, in world units. */
  size: number;
  width: number;
  height: number;
  /** World position of axial (0, 0). */
  origin: Pt;
  /** Hex cell of every skill. Frozen once written. */
  cells: Record<string, Hex>;
  /** Centre of every skill and capability (capability = centre of its cluster). */
  points: Record<string, Pt>;
  /** Anchor for each territory's name, just above its region. */
  territories: Record<string, { label: Pt }>;
}

export type Box = { x: number; y: number; w: number; h: number };

const SQRT3 = Math.sqrt(3);

/** Neighbour directions, indexed by the hex edge they sit across (edge i joins corners i and i+1). */
export const DIRS: Hex[] = [
  [1, 0],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [0, -1],
  [1, -1],
];

export const hexKey = ([q, r]: Hex) => `${q},${r}`;

export function hexCenter(g: Pick<Geometry, 'size' | 'origin'>, [q, r]: Hex): Pt {
  return [g.origin[0] + g.size * SQRT3 * (q + r / 2), g.origin[1] + g.size * 1.5 * r];
}

/** Corner i of a pointy-top hexagon, starting at the upper right and going clockwise. */
export function hexCorner([cx, cy]: Pt, radius: number, i: number): Pt {
  const a = ((60 * i - 30) * Math.PI) / 180;
  return [cx + radius * Math.cos(a), cy + radius * Math.sin(a)];
}

export function hexDistance([q1, r1]: Hex, [q2, r2]: Hex): number {
  return (Math.abs(q1 - q2) + Math.abs(r1 - r2) + Math.abs(q1 + r1 - q2 - r2)) / 2;
}

/** Nearest hex to a world point. */
export function pointToHex(g: Pick<Geometry, 'size' | 'origin'>, [x, y]: Pt): Hex {
  const px = x - g.origin[0];
  const py = y - g.origin[1];
  const q = ((SQRT3 / 3) * px - py / 3) / g.size;
  const r = ((2 / 3) * py) / g.size;
  let rq = Math.round(q), rr = Math.round(r), rs = Math.round(-q - r);
  const dq = Math.abs(rq - q), dr = Math.abs(rr - r), ds = Math.abs(rs + q + r);
  if (dq > dr && dq > ds) rq = -rr - rs;
  else if (dr > ds) rr = -rq - rs;
  return [rq, rr];
}

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

/** Whether a set of hexes forms one connected piece. */
export function isConnected(hexes: Hex[]): boolean {
  if (hexes.length <= 1) return true;
  const set = new Set(hexes.map(hexKey));
  const seen = new Set<string>([hexKey(hexes[0])]);
  const stack = [hexes[0]];
  while (stack.length) {
    const [q, r] = stack.pop()!;
    for (const [dq, dr] of DIRS) {
      const k = hexKey([q + dq, r + dr]);
      if (set.has(k) && !seen.has(k)) {
        seen.add(k);
        stack.push([q + dq, r + dr]);
      }
    }
  }
  return seen.size === set.size;
}
