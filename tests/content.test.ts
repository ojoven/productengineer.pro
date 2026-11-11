import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadAtlas, loadGeometry, loadSources, ROOT } from '../src/atlas/load.ts';
import { validateAtlas } from '../src/atlas/validate.ts';
import { hexDistance, hexKey, isConnected } from '../src/atlas/geometry.ts';
import { relatedNodes, resolveNode, skillsOf } from '../src/atlas/model.ts';

const atlas = loadAtlas();
const sources = loadSources();
const geometry = loadGeometry();

describe('taxonomy', () => {
  it('has eleven territories including AI, plus the cross-cutting group', () => {
    const land = atlas.territories.filter((t) => !t.crossCutting).map((t) => t.id);
    expect(land).toEqual([
      'discovery', 'strategy', 'experience', 'engineering', 'shipping',
      'measurement', 'activation', 'retention', 'distribution', 'operations', 'ai',
    ]);
    expect(atlas.territories.filter((t) => t.crossCutting)).toHaveLength(1);
  });

  it('has 72 capabilities, 64 of them in territories', () => {
    expect(atlas.capabilities).toHaveLength(72);
    const cross = atlas.territories.find((t) => t.crossCutting)!;
    expect(atlas.capabilities.filter((c) => c.territory !== cross.id)).toHaveLength(64);
  });

  it('gives every skill exactly one home', () => {
    const homes = new Map<string, number>();
    for (const c of atlas.capabilities) for (const s of c.skills) homes.set(s, (homes.get(s) ?? 0) + 1);
    expect([...homes.values()].every((n) => n === 1)).toBe(true);
    expect(homes.size).toBe(atlas.skills.length);
  });

  it('passes every integrity check: references resolve, every node has a position', () => {
    const report = validateAtlas(atlas, sources, geometry);
    expect(report.errors).toEqual([]);
  });

  it('keeps descriptions within the page templates', () => {
    const report = validateAtlas(atlas, sources, geometry);
    expect(report.warnings.filter((w) => w.includes('sentences') || w.includes('chars'))).toEqual([]);
  });
});

describe('stable ids', () => {
  const locked = readFileSync(join(ROOT, 'src', 'atlas', 'ids.lock'), 'utf8')
    .split('\n')
    .filter((l) => l && !l.startsWith('#'));

  it('never drops a published id (it must stay as an id or an alias)', () => {
    const missing = locked.filter((id) => !resolveNode(atlas, id));
    expect(missing, 'renamed? add the old id to `aliases` of the node').toEqual([]);
  });

  it('has every current id in the lock file', () => {
    const lockedSet = new Set(locked);
    const unlocked = [...atlas.nodes.keys()].filter((id) => !lockedSet.has(id));
    expect(unlocked, 'run: node --experimental-strip-types scripts/lock-ids.ts').toEqual([]);
  });
});

describe('geometry', () => {
  it('gives every skill its own tile', () => {
    const seen = new Set<string>();
    for (const sk of atlas.skills) {
      const h = geometry.cells[sk.id];
      expect(h, sk.id).toBeDefined();
      expect(seen.has(hexKey(h)), `${sk.id} shares a tile`).toBe(false);
      seen.add(hexKey(h));
    }
  });

  it('keeps every capability in one connected cluster', () => {
    for (const c of atlas.capabilities) expect(isConnected(c.skills.map((sk) => geometry.cells[sk])), c.id).toBe(true);
  });

  it('keeps territories apart, with at least one empty tile between them', () => {
    for (const a of atlas.skills)
      for (const b of atlas.skills) {
        if (a.territory === b.territory) continue;
        expect(hexDistance(geometry.cells[a.id], geometry.cells[b.id]), `${a.id} / ${b.id}`).toBeGreaterThanOrEqual(2);
      }
  });
});

describe('model helpers', () => {
  it('rolls skills up through capabilities and territories', () => {
    const m = atlas.nodes.get('measurement')!;
    expect(skillsOf(atlas, m).length).toBe(
      atlas.capabilities.filter((c) => c.territory === 'measurement').reduce((n, c) => n + c.skills.length, 0),
    );
  });

  it('makes related links two-way', () => {
    const interviews = atlas.nodes.get('user-interviews')!;
    const qualitative = atlas.nodes.get('qualitative-evaluation')!;
    if (interviews.level === 'skill') expect(relatedNodes(atlas, interviews).map((n) => n.id)).toContain('qualitative-evaluation');
    expect(qualitative.level).toBe('capability');
  });
});
