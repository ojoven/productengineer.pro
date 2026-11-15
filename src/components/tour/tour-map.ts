// The map of a quick tour, in the browser. Each stop zooms to its skill; moving between stops
// flies over the map (zoom out, pan, zoom in) so the reader sees where the next skill sits.
//
// Two layers: `detail` is the map drawn for the view at rest (labels, dimmed neighbours);
// `transit` is the whole map without labels, drawn once per move, whose viewBox is animated.
import { computeView, renderMap, type MapAtlas } from '../../atlas/render.ts';
import type { Box, Geometry } from '../../atlas/geometry.ts';

type Data = MapAtlas & { geometry: Geometry };
export interface View {
  /** '' for the whole map, or a skill id. */
  focus: string;
  selected: string | null;
}

let pending: Promise<Data> | undefined;
const loadData = () => (pending ??= fetch('/atlas-data.json').then((r) => r.json() as Promise<Data>));

const reduce = matchMedia('(prefers-reduced-motion: reduce)');
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const frame = () => new Promise<number>((r) => requestAnimationFrame(r));
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Smooth zoom between two views, centre and width (van Wijk and Nuij, as in d3-interpolate). */
function flight(a: [number, number, number], b: [number, number, number]) {
  const rho = Math.SQRT2;
  const [ux0, uy0, w0] = a;
  const [ux1, uy1, w1] = b;
  const dx = ux1 - ux0;
  const dy = uy1 - uy0;
  const d2 = dx * dx + dy * dy;
  if (d2 < 1e-9) {
    const S = Math.log(w1 / w0) / rho;
    return { S, at: (t: number): [number, number, number] => [ux0 + t * dx, uy0 + t * dy, w0 * Math.exp(rho * t * S)] };
  }
  const d1 = Math.sqrt(d2);
  const b0 = (w1 * w1 - w0 * w0 + 4 * d2) / (2 * w0 * 2 * d1);
  const b1 = (w1 * w1 - w0 * w0 - 4 * d2) / (2 * w1 * 2 * d1);
  const r0 = Math.log(Math.sqrt(b0 * b0 + 1) - b0);
  const r1 = Math.log(Math.sqrt(b1 * b1 + 1) - b1);
  const S = (r1 - r0) / rho;
  return {
    S,
    at: (t: number): [number, number, number] => {
      const s = t * S;
      const c0 = Math.cosh(r0);
      const u = (w0 / (2 * d1)) * (c0 * Math.tanh(rho * s + r0) - Math.sinh(r0));
      return [ux0 + u * dx, uy0 + u * dy, (w0 * c0) / Math.cosh(rho * s + r0)];
    },
  };
}

export class TourMap {
  private data?: Data;
  private box?: Box;
  private view: View = { focus: '', selected: null };
  private run = 0;
  private size = { width: 0, height: 0 };
  private readonly transit: HTMLElement;
  private readonly detail: HTMLElement;

  constructor(
    private readonly el: HTMLElement,
    private readonly lit: string[],
  ) {
    this.transit = el.querySelector('[data-qt-transit]')!;
    this.detail = el.querySelector('[data-qt-detail]')!;
    // a new size (full screen, rotation, resize) redraws the view at rest, without moving
    new ResizeObserver(() => {
      const { width, height } = this.measure();
      if (!this.data || (width === this.size.width && height === this.size.height)) return;
      this.show(this.view, false);
    }).observe(el);
  }

  /** Starts loading the atlas, so the first move does not wait for it. */
  prepare() {
    void loadData();
  }

  private measure() {
    const r = this.el.getBoundingClientRect();
    return { width: Math.max(200, Math.round(r.width)), height: Math.max(160, Math.round(r.height)) };
  }

  private options(view: View, width: number, height: number) {
    return {
      focus: view.focus,
      width,
      height,
      scale: width < 520 ? 0.85 : 1,
      links: false,
      state: { lit: this.lit, selected: view.selected },
    };
  }

  async show(view: View, animate = true) {
    const run = ++this.run;
    const data = (this.data ??= await loadData());
    if (run !== this.run) return;
    const { width, height } = (this.size = this.measure());
    const aspect = width / height;
    const target = computeView(data, data.geometry, this.options(view, width, height)).box;
    const from = this.box ?? computeView(data, data.geometry, this.options({ focus: '', selected: null }, width, height)).box;
    const same = Math.abs(from.x - target.x) + Math.abs(from.y - target.y) + Math.abs(from.w - target.w) < target.w * 0.01;
    this.view = view;

    if (animate && !reduce.matches && !same) {
      // the whole map, drawn as if four times larger so the hairlines between tiles stay thin when zoomed in
      this.transit.innerHTML = renderMap(data, data.geometry, {
        focus: '',
        width: width * 4,
        height: height * 4,
        labels: false,
        links: false,
        state: { lit: this.lit, selected: view.selected },
      });
      const svg = this.transit.querySelector('svg')!;
      const set = (b: Box) => {
        svg.setAttribute('viewBox', `${b.x} ${b.y} ${b.w} ${b.h}`);
        this.box = b;
      };
      const toBox = ([cx, cy, w]: [number, number, number]): Box => ({ x: cx - w / 2, y: cy - w / aspect / 2, w, h: w / aspect });
      const a: [number, number, number] = [from.x + from.w / 2, from.y + from.h / 2, Math.max(from.w, from.h * aspect)];
      const b: [number, number, number] = [target.x + target.w / 2, target.y + target.h / 2, target.w];
      const path = flight(a, b);
      const duration = Math.min(1500, Math.max(450, Math.abs(path.S) * 520));
      set(toBox(a));
      this.el.classList.add('is-moving');
      const t0 = performance.now();
      for (;;) {
        const now = await frame();
        if (run !== this.run) return;
        const t = Math.min(1, (now - t0) / duration);
        set(toBox(path.at(ease(t))));
        if (t >= 1) break;
      }
    }

    if (run !== this.run) return;
    this.detail.innerHTML = renderMap(data, data.geometry, this.options(view, width, height));
    this.box = target;
    this.el.classList.remove('is-moving');
    // the transit layer hides once the detail has faded in over it
    await wait(220);
    if (run === this.run) this.transit.innerHTML = '';
  }
}
