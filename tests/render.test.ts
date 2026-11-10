import { describe, expect, it } from 'vitest';
import { loadAtlas, loadGeometry } from '../src/atlas/load.ts';
import { computeView, nodeCodes, renderMap, wrapText } from '../src/atlas/render.ts';

const atlas = loadAtlas();
const geometry = loadGeometry();
const groups = (svg: string, cls: string) => [...svg.matchAll(new RegExp(`class="n ${cls}[^"]*" data-id="([^"]+)"`, 'g'))].map((m) => m[1]);
const tiles = (svg: string) => (svg.match(/class="tile[^"]*" data-skill=/g) ?? []).length;

describe('renderer', () => {
  it('draws the world with every skill as a tile, grouped by territory', () => {
    const svg = renderMap(atlas, geometry, { width: 1200, height: 1000 });
    expect(tiles(svg)).toBe(atlas.skills.length);
    expect(new Set(groups(svg, 'n-t')).size).toBe(atlas.territories.length);
  });

  it('zooms to every territory, grouping its tiles by capability', () => {
    for (const t of atlas.territories) {
      const svg = renderMap(atlas, geometry, { focus: t.id, width: 900, height: 600 });
      expect(groups(svg, 'n-c').sort()).toEqual([...t.capabilities].sort());
      expect(computeView(atlas, geometry, { focus: t.id }).level).toBe('territory');
    }
  });

  it('zooms to every capability, with one link per skill', () => {
    for (const c of atlas.capabilities) {
      const svg = renderMap(atlas, geometry, { focus: c.id, width: 900, height: 600 });
      expect(groups(svg, 'n-s').sort()).toEqual([...c.skills].sort());
    }
  });

  it('zooms to a skill by showing its capability with the skill selected', () => {
    const svg = renderMap(atlas, geometry, { focus: 'sample-size', width: 900, height: 600 });
    expect(svg).toMatch(/class="n n-s is-sel" data-id="sample-size"/);
    expect(svg).toContain('class="b-sel"');
  });

  it('lights skills at every zoom and joins them with a route', () => {
    const world = renderMap(atlas, geometry, { state: { lit: ['sample-size', 'funnel-analysis'], route: true } });
    expect(world).toMatch(/class="tile is-lit" data-skill="sample-size"/);
    expect(world).toMatch(/class="tile is-lit" data-skill="funnel-analysis"/);
    expect(world).toContain('class="route"');
  });

  it('ignores unknown lit ids', () => {
    expect(() => renderMap(atlas, geometry, { state: { lit: ['no-such-node', 'sample-size'], route: true } })).not.toThrow();
  });

  it('keeps progress and lit as separate layers on the same tile', () => {
    const svg = renderMap(atlas, geometry, { state: { progress: { 'sample-size': 'comfortable' }, lit: ['sample-size'] } });
    expect(svg).toMatch(/class="tile st-comfortable is-lit" data-skill="sample-size"/);
  });

  it('is deterministic', () => {
    const a = renderMap(atlas, geometry, { focus: 'discovery', width: 800, height: 500 });
    expect(renderMap(atlas, geometry, { focus: 'discovery', width: 800, height: 500 })).toBe(a);
  });
});

describe('codes and labels', () => {
  it('numbers territories, capabilities and skills in taxonomy order', () => {
    const codes = nodeCodes(atlas);
    expect(codes.get('discovery')).toBe('01');
    expect(codes.get('measurement')).toBe('06');
    expect(codes.get('experiment-design')).toBe('06.4');
    expect(codes.get('sample-size')).toBe('06.4.5');
    expect(codes.get('cross-cutting')).toBe('X');
  });

  it('wraps long names into a few short lines', () => {
    expect(wrapText('Separation of concerns', 12)).toEqual(['Separation', 'of concerns']);
    expect(wrapText('a b c d e f g h', 1, 3)).toHaveLength(3);
  });
});
