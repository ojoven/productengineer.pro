// Helpers shared by the figures: ids, scales, number formatting, text wrapping for SVG labels and
// the interval maths behind ABResult. Plain TypeScript with no Astro imports, so tests can use it.

/** SVG figures are drawn twice, at article width and at phone width, and a container query shows one. */
export const WIDTHS = { wide: 640, narrow: 340 } as const;
export type Variant = keyof typeof WIDTHS;
export const VARIANTS: Variant[] = ['wide', 'narrow'];

let counter = 0;
/** A document-unique id for SVG markers, clip paths and aria references. */
export const uid = (prefix = 'fg') => `${prefix}-${(++counter).toString(36)}`;

/** How a claim is known. The same four words the site uses in its product notes, plus one for example data. */
export const EVIDENCE = {
  measured: 'Measured',
  observed: 'Observed',
  reported: 'Reported',
  assumed: 'Assumed',
  illustrative: 'Illustrative data',
} as const;
export type Evidence = keyof typeof EVIDENCE;

/** Props every figure accepts and hands to the frame. */
export interface FrameProps {
  /** One line above the figure, saying what it shows. */
  title?: string;
  /** One or two sentences under it: what to read from it. */
  caption?: string;
  /** How the content is known. `illustrative` marks example data, so it is never read as a finding. */
  evidence?: Evidence;
  /** Where it comes from: tool, dates, sample size, version. */
  source?: string;
  /**
   * Shows a Replay button. On by default only for figures whose reveal shows an order (Sequence,
   * Timeline, Journey, ScreenSteps, Rollout, Funnel, LineChart). Set it to turn the button on or off.
   */
  replay?: boolean;
}

/** Pointy-top hexagon, the shape of a map tile, centred on (cx, cy) with circumradius r. */
export function hexPath(cx: number, cy: number, r: number): string {
  const w = (Math.sqrt(3) / 2) * r;
  const p = (x: number, y: number) => `${round(x)} ${round(y)}`;
  return `M${p(cx, cy - r)}L${p(cx + w, cy - r / 2)}L${p(cx + w, cy + r / 2)}L${p(cx, cy + r)}L${p(cx - w, cy + r / 2)}L${p(cx - w, cy - r / 2)}Z`;
}

export const round = (n: number, d = 2) => {
  const f = 10 ** d;
  return Math.round(n * f) / f;
};

export const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Linear scale from a domain to a range. */
export function scale(d0: number, d1: number, r0: number, r1: number) {
  const span = d1 - d0 || 1;
  return (v: number) => r0 + ((v - d0) / span) * (r1 - r0);
}

/** Round tick values covering [min, max]: 0, 25, 50, 75, 100 and the like. */
export function niceTicks(min: number, max: number, count = 4): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1];
  if (min === max) max = min + 1;
  const raw = (max - min) / Math.max(1, count);
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
  const start = Math.floor(min / step) * step;
  const ticks: number[] = [];
  for (let v = start; v < max + step * 0.999; v += step) ticks.push(round(v, 6));
  return ticks;
}

/** 1284 -> "1,284"; 12900 -> "12.9K" when compact. Never invents precision. */
export function fmt(n: number, opts: { digits?: number; compact?: boolean; fixed?: boolean } = {}): string {
  const { digits, compact = false, fixed = false } = opts;
  if (compact && Math.abs(n) >= 10000) {
    const units: [number, string][] = [
      [1e9, 'B'],
      [1e6, 'M'],
      [1e3, 'K'],
    ];
    for (const [size, suffix] of units) {
      if (Math.abs(n) >= size) return `${round(n / size, 1)}${suffix}`;
    }
  }
  const d = digits ?? (Number.isInteger(n) ? 0 : Math.abs(n) < 10 ? 2 : 1);
  return n.toLocaleString('en-GB', { minimumFractionDigits: fixed ? d : 0, maximumFractionDigits: d });
}

/** A share as a percentage: 0.4127 -> "41.3%". With `fixed`, 0.15 -> "15.0%", so a column lines up. */
export const pct = (share: number, digits = 1, fixed = false) => `${fmt(share * 100, { digits, fixed })}%`;

/** A value with its unit: "%" and "×" sit against the number, words get a space. */
export function withUnit(n: number, unit = '', opts: { digits?: number; compact?: boolean } = {}): string {
  const v = fmt(n, opts);
  if (!unit) return v;
  return /^[%×x°]$/.test(unit) ? `${v}${unit}` : `${v} ${unit}`;
}

/** Signed change: "+4.2" or "−1.3" (with a real minus sign). */
export function signed(n: number, digits = 1, fixed = false): string {
  const v = fmt(Math.abs(n), { digits, fixed });
  return n > 0 ? `+${v}` : n < 0 ? `−${v}` : v;
}

/** Breaks text into lines of at most `max` characters, for SVG labels (which do not wrap). */
export function wrap(text: string, max: number, maxLines = 3): string[] {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    if (!line) line = w;
    else if ((line + ' ' + w).length <= max) line += ' ' + w;
    else {
      lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = kept[maxLines - 1].replace(/.{0,1}$/, '…');
    return kept;
  }
  return lines;
}

/** "2:40" from seconds; "1:02:05" past an hour. */
export function clock(seconds: number): string {
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${r}` : `${m}:${r}`;
}

/** "2 min 40 s" from seconds, for sentences. */
export function duration(seconds: number): string {
  const s = Math.round(seconds);
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (!m) return `${r} s`;
  return r ? `${m} min ${r} s` : `${m} min`;
}

// ---- intervals for proportions (ABResult)

export interface Interval {
  /** Point estimate. */
  p: number;
  lo: number;
  hi: number;
}

/**
 * Wilson score interval for a proportion k/n. Holds up with small samples and with rates near
 * 0 or 1, where the usual p ± z·se interval does not. z = 1.96 gives 95%.
 */
export function wilson(k: number, n: number, z = 1.96): Interval {
  if (n <= 0) return { p: 0, lo: 0, hi: 1 };
  const p = k / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const centre = (p + z2 / (2 * n)) / denom;
  const half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denom;
  return { p, lo: Math.max(0, centre - half), hi: Math.min(1, centre + half) };
}

/**
 * Newcombe's interval (method 10, from the two Wilson intervals) for the difference between two
 * proportions, variant minus control. Returned in the same units as the rates (0.04 = 4 points).
 */
export function newcombe(kControl: number, nControl: number, kVariant: number, nVariant: number, z = 1.96): Interval {
  const c = wilson(kControl, nControl, z);
  const v = wilson(kVariant, nVariant, z);
  const diff = v.p - c.p;
  const lo = diff - Math.sqrt((v.p - v.lo) ** 2 + (c.hi - c.p) ** 2);
  const hi = diff + Math.sqrt((v.hi - v.p) ** 2 + (c.p - c.lo) ** 2);
  return { p: diff, lo, hi };
}

/** What the interval for a difference lets you say, in plain words. */
export function readDifference(d: Interval): 'higher' | 'lower' | 'unclear' {
  if (d.lo > 0) return 'higher';
  if (d.hi < 0) return 'lower';
  return 'unclear';
}
