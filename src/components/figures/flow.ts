// Layout for Flow: nodes sit on a grid (col, row), arrows are routed at right angles.
// At article width the flow runs left to right (columns are stages). At phone width the same grid
// is turned: it runs top to bottom, and rows become side-by-side lanes.
// Plain TypeScript, so the layout can be tested without rendering.
import { WIDTHS, round, wrap, type Variant } from './lib.ts';

export interface FlowNode {
  id: string;
  /** Short name, set in monospace. */
  label: string;
  /** One line under the name. */
  detail?: string;
  /** Stage, from 0. The flow runs along columns. */
  col: number;
  /** Lane, from 0. */
  row: number;
  /** step: a box. decision: filled, a choice is made here. external: dashed, outside your system. store: where data rests. */
  kind?: 'step' | 'decision' | 'external' | 'store';
  /** signal: the node to look at. lit: where the value is. */
  tone?: 'signal' | 'lit';
  /** Makes the node a link. */
  href?: string;
}

export interface FlowEdge {
  from: string;
  to: string;
  /** A word on the arrow: "yes", "401", "webhook". */
  label?: string;
  /** signal: the path the text is about. */
  tone?: 'signal';
  /** For something that happens later or only sometimes. */
  dashed?: boolean;
}

export interface PlacedNode extends FlowNode {
  x: number;
  y: number;
  w: number;
  h: number;
  nameLines: string[];
  detailLines: string[];
}

export interface PlacedEdge extends FlowEdge {
  d: string;
  length: number;
  back: boolean;
  labelAt?: { x: number; y: number; anchor: 'start' | 'middle' | 'end' };
}

export interface FlowLayout {
  variant: Variant;
  width: number;
  height: number;
  nodes: PlacedNode[];
  edges: PlacedEdge[];
  stages: { label: string; x: number; y: number }[];
}

type Point = [number, number];

export function layoutFlow(nodes: FlowNode[], edges: FlowEdge[], variant: Variant, stageLabels: string[] = []): FlowLayout {
  const W = WIDTHS[variant];
  const horizontal = variant === 'wide';
  const ids = new Set(nodes.map((n) => n.id));
  for (const e of edges) {
    if (!ids.has(e.from) || !ids.has(e.to)) throw new Error(`Flow: edge ${e.from} -> ${e.to} points to a node that does not exist`);
  }
  const mains = Math.max(...nodes.map((n) => n.col)) + 1;
  const crosses = Math.max(...nodes.map((n) => n.row)) + 1;
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const isBack = (e: FlowEdge) => byId.get(e.to)!.col < byId.get(e.from)!.col;
  // Two arrows between the same two nodes, one each way: they run side by side, not on top of each other.
  const isPaired = (e: FlowEdge) => edges.some((o) => o !== e && o.from === e.to && o.to === e.from);
  const backCount = edges.filter(isBack).length;
  const hasStages = stageLabels.some(Boolean);

  // ---- box sizes
  const lanes = horizontal ? mains : crosses; // boxes side by side across the width
  const sideReserve = horizontal ? 0 : backCount ? 10 + backCount * 12 : 0;
  const minGap = horizontal ? 44 : 16;
  // boxes stay narrow enough to leave room for a word on the arrow between them
  const maxBox = horizontal ? 168 : 260;
  const boxW = Math.min(maxBox, Math.floor((W - sideReserve - (lanes - 1) * minGap) / lanes));
  const gapAcross = lanes > 1 ? Math.min(horizontal ? 96 : 28, (W - sideReserve - lanes * boxW) / (lanes - 1)) : 0;
  const nameChars = Math.max(6, Math.floor((boxW - 22) / 7.9));
  const detailChars = Math.max(8, Math.floor((boxW - 22) / 5.8));

  const sized = nodes.map((n) => {
    const nameLines = wrap(n.label, nameChars, 2);
    const detailLines = n.detail ? wrap(n.detail, detailChars, 2) : [];
    const h = 13 + nameLines.length * 16 + (detailLines.length ? 2 + detailLines.length * 14 : 0) + 9;
    return { ...n, nameLines, detailLines, w: boxW, h };
  });

  // ---- positions
  const bandOf = (n: FlowNode) => (horizontal ? n.row : n.col); // bands stack down the page
  const laneOf = (n: FlowNode) => (horizontal ? n.col : n.row); // lanes run across it
  const bands = horizontal ? crosses : mains;
  const bandH = Array.from({ length: bands }, (_, b) => Math.max(0, ...sized.filter((n) => bandOf(n) === b).map((n) => n.h)));
  const stageRoom = hasStages ? 20 : 0;
  const bandGap = horizontal ? 30 : 34 + (hasStages ? 16 : 0);
  const bandY: number[] = [];
  let y = horizontal ? stageRoom : hasStages ? 18 : 2;
  for (let b = 0; b < bands; b++) {
    bandY.push(y);
    y += bandH[b] + bandGap;
  }
  const bottom = y - bandGap;
  const laneX = (l: number) => l * (boxW + gapAcross);
  const right = laneX(lanes - 1) + boxW;

  const placed: PlacedNode[] = sized.map((n) => ({
    ...n,
    x: round(laneX(laneOf(n))),
    y: round(bandY[bandOf(n)] + (bandH[bandOf(n)] - n.h) / 2),
  }));
  const node = new Map(placed.map((n) => [n.id, n]));
  const occupied = (col: number, row: number) => placed.some((n) => n.col === col && n.row === row);

  // ---- arrows
  // Each route also says where its label goes, so a word never lands on a box or runs off the edge.
  type Label = { x: number; y: number; anchor: 'start' | 'middle' | 'end' };
  let backIndex = 0;
  const routed: PlacedEdge[] = edges.map((e) => {
    const a = node.get(e.from)!;
    const b = node.get(e.to)!;
    const back = isBack(e);
    const aCx = a.x + a.w / 2;
    const aCy = a.y + a.h / 2;
    const bCx = b.x + b.w / 2;
    const bCy = b.y + b.h / 2;
    let pts: Point[];
    let lab: Label;

    if (horizontal) {
      const aR = a.x + a.w;
      const bL = b.x;
      if (b.col > a.col) {
        if (a.row === b.row) {
          let blocked = false;
          for (let c = a.col + 1; c < b.col; c++) blocked ||= occupied(c, a.row);
          if (!blocked) {
            pts = [[aR, aCy], [bL, bCy]];
            lab = { x: (aR + bL) / 2, y: aCy - 6, anchor: 'middle' };
          } else {
            const lane = bandY[a.row] + bandH[a.row] + bandGap / 2;
            pts = [[aR, aCy], [aR + 14, aCy], [aR + 14, lane], [bL - 14, lane], [bL - 14, bCy], [bL, bCy]];
            lab = { x: (aR + bL) / 2, y: lane - 6, anchor: 'middle' };
          }
        } else {
          // out, down the gap between the columns, in: the word sits beside the vertical run
          const mid = bL - gapAcross / 2;
          pts = [[aR, aCy], [mid, aCy], [mid, bCy], [bL, bCy]];
          const down = b.row > a.row;
          const gapY = down ? bandY[b.row] - bandGap / 2 : bandY[a.row] - bandGap / 2;
          lab = { x: mid + 6, y: gapY + 3, anchor: 'start' };
        }
      } else if (b.col === a.col) {
        const down = b.row > a.row;
        const shift = isPaired(e) ? (down ? -9 : 9) : 0;
        const x = aCx + shift;
        pts = down ? [[x, a.y + a.h], [x, b.y]] : [[x, a.y], [x, b.y + b.h]];
        const labY = (down ? a.y + a.h + b.y : a.y + b.y + b.h) / 2 + 3;
        lab = shift < 0 ? { x: x - 6, y: labY, anchor: 'end' } : { x: x + 6, y: labY, anchor: 'start' };
      } else {
        // a loop back: under everything, and up into the earlier node
        const lane = bottom + 18 + backIndex++ * 12;
        let belowA = false;
        let belowB = false;
        for (let r = a.row + 1; r < crosses; r++) belowA ||= occupied(a.col, r);
        for (let r = b.row + 1; r < crosses; r++) belowB ||= occupied(b.col, r);
        const out: Point[] = belowA ? [[aR, aCy], [aR + 14, aCy], [aR + 14, lane]] : [[aCx, a.y + a.h], [aCx, lane]];
        const into: Point[] = belowB ? [[bL - 14, lane], [bL - 14, bCy], [bL, bCy]] : [[bCx, lane], [bCx, b.y + b.h]];
        pts = [...out, ...into];
        lab = { x: (aCx + bCx) / 2, y: lane - 6, anchor: 'middle' };
      }
    } else {
      const aB = a.y + a.h;
      const bT = b.y;
      if (b.col > a.col) {
        if (a.row === b.row) {
          let blocked = false;
          for (let c = a.col + 1; c < b.col; c++) blocked ||= occupied(c, a.row);
          if (!blocked) {
            pts = [[aCx, aB], [bCx, bT]];
            // close under the box it leaves, clear of arrows that branch off half-way down
            lab = { x: aCx + 7, y: aB + 11, anchor: 'start' };
          } else {
            const lane = a.x + a.w + gapAcross / 2;
            pts = [[aCx, aB], [aCx, aB + 12], [lane, aB + 12], [lane, bT - 12], [bCx, bT - 12], [bCx, bT]];
            lab = { x: lane + 6, y: (aB + bT) / 2 + 3, anchor: 'start' };
          }
        } else {
          // down, across to the other lane, down: the word sits over the run, at the far end
          const mid = bT - (bandGap - (hasStages ? 16 : 0)) / 2;
          pts = [[aCx, aB], [aCx, mid], [bCx, mid], [bCx, bT]];
          lab = bCx > aCx ? { x: bCx - 6, y: mid - 5, anchor: 'end' } : { x: bCx + 6, y: mid - 5, anchor: 'start' };
        }
      } else if (b.col === a.col) {
        const toRight = b.row > a.row;
        const shift = isPaired(e) ? (toRight ? -7 : 7) : 0;
        pts = toRight ? [[a.x + a.w, aCy + shift], [b.x, bCy + shift]] : [[a.x, aCy + shift], [b.x + b.w, bCy + shift]];
        const gapX = toRight ? (a.x + a.w + b.x) / 2 : (b.x + b.w + a.x) / 2;
        lab = { x: gapX, y: aCy + shift + (shift > 0 ? 13 : -5), anchor: 'middle' };
      } else {
        // a loop back: up the right-hand side. The word goes to the left of it, where there is room.
        const lane = right + 12 + backIndex++ * 12;
        pts = [[a.x + a.w, aCy], [lane, aCy], [lane, bCy], [b.x + b.w, bCy]];
        lab = { x: lane - 6, y: (aCy + bCy) / 2 + 3, anchor: 'end' };
      }
    }

    pts = pts.map(([px, py]) => [round(px, 1), round(py, 1)] as Point);
    const d = pts.map(([px, py], i) => `${i ? 'L' : 'M'}${px} ${py}`).join('');
    let length = 0;
    for (let i = 1; i < pts.length; i++) length += Math.abs(pts[i][0] - pts[i - 1][0]) + Math.abs(pts[i][1] - pts[i - 1][1]);
    return { ...e, d, length, back, labelAt: e.label ? { x: round(lab.x, 1), y: round(lab.y, 1), anchor: lab.anchor } : undefined };
  });

  const stages = stageLabels
    .map((label, i) => ({ label, x: horizontal ? round(laneX(i)) : 0, y: horizontal ? 10 : round(bandY[i] - 7) }))
    .filter((s, i) => s.label && i < mains);

  const height = horizontal ? bottom + (backCount ? 18 + backCount * 12 + 4 : 2) : bottom + 2;
  return { variant, width: W, height: round(height), nodes: placed, edges: routed, stages };
}
