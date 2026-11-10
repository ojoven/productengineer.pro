import { describe, expect, it } from 'vitest';
import { loadAtlas, loadGeometry } from '../src/atlas/load.ts';
import { computeView, renderMap } from '../src/atlas/render.ts';

const atlas = loadAtlas();
const geometry = loadGeometry();
const ids = (svg: string, cls: string) => [...svg.matchAll(new RegExp(`class="n ${cls}[^"]*" data-id="([^"]+)"`, 'g'))].map((m) => m[1]);

describe('renderer', () => {
  it('draws the world with every capability as a landmark and no skills', () => {
    const svg = renderMap(atlas, geometry, { width: 1200, height: 780 });
    expect(new Set(ids(svg, 'n-c')).size).toBe(atlas.capabilities.length);
    expect(ids(svg, 'n-s')).toEqual([]);
  });

  it('zooms to every territory and every capability without errors', () => {
    for (const t of atlas.territories) {
      const svg = renderMap(atlas, geometry, { focus: t.id, width: 900, height: 560 });
      for (const c of t.capabilities) expect(svg).toContain(`data-id="${c}"`);
    }
    for (const c of atlas.capabilities) {
      const svg = renderMap(atlas, geometry, { focus: c.id, width: 900, height: 560 });
      expect(ids(svg, 'n-s').sort()).toEqual([...c.skills].sort());
      expect(computeView(atlas, geometry, { focus: c.id, width: 900, height: 560 }).level).toBe('capability');
    }
  });

  it('zooms to a skill by showing its capability with the skill selected', () => {
    const svg = renderMap(atlas, geometry, { focus: 'sample-size', width: 900, height: 560 });
    expect(svg).toMatch(/class="n n-s is-sel" data-id="sample-size"/);
  });

  it('lights skills at the visible level and joins them with a route', () => {
    const world = renderMap(atlas, geometry, { state: { lit: ['sample-size', 'funnel-analysis'], route: true } });
    expect(world).toMatch(/class="n n-c is-lit" data-id="experiment-design"/);
    expect(world).toMatch(/class="n n-c is-lit" data-id="behavioral-analysis"/);
    expect(world).toContain('class="route"');
    const cap = renderMap(atlas, geometry, { focus: 'experiment-design', state: { lit: ['sample-size', 'ab-tests'], route: true } });
    expect(cap).toMatch(/class="n n-s is-lit" data-id="sample-size"/);
  });

  it('ignores unknown lit ids', () => {
    expect(() => renderMap(atlas, geometry, { state: { lit: ['no-such-node'], route: true } })).not.toThrow();
  });

  it('keeps progress and lit as separate layers on the same node', () => {
    const svg = renderMap(atlas, geometry, {
      focus: 'experiment-design',
      state: { progress: { 'sample-size': 'comfortable' }, lit: ['sample-size'] },
    });
    expect(svg).toMatch(/class="n n-s st-comfortable is-lit" data-id="sample-size"/);
  });

  it('rolls progress up into the capability ring', () => {
    const cap = atlas.capabilities.find((c) => c.id === 'experiment-design')!;
    const progress = Object.fromEntries(cap.skills.slice(0, 3).map((s) => [s, 'comfortable' as const]));
    const svg = renderMap(atlas, geometry, { focus: 'measurement', state: { progress } });
    const node = svg.slice(svg.indexOf('data-id="experiment-design"'));
    expect(node).toMatch(new RegExp(`class="roll"[^>]*stroke-dasharray="${(3 / cap.skills.length) * 100} 100"`));
  });

  it('is deterministic', () => {
    const a = renderMap(atlas, geometry, { focus: 'discovery', width: 800, height: 500 });
    const b = renderMap(atlas, geometry, { focus: 'discovery', width: 800, height: 500 });
    expect(a).toBe(b);
  });

  it('renders both styles', () => {
    for (const style of ['ink', 'illustrated'] as const) {
      expect(renderMap(atlas, geometry, { style })).toContain(style === 'ink' ? 'pm--ink' : 'pm--ill');
    }
  });
});
