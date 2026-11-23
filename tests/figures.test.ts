// The figure library stays in one piece: every component is in the catalogue and the index, the
// catalogue describes the props the components really take, its examples point at real atlas
// skills, the generated docs are current, and entries only use figures that exist.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadAtlas, ROOT } from '../src/atlas/load.ts';
import { splitFrontmatter } from '../src/editorial/load.ts';
import { SECTIONS } from '../src/editorial/schema.ts';
import { EVIDENCE_KINDS, FIGURES, FRAME_PROPS, GROUPS, PICKER, toMdx } from '../src/components/figures/catalog.ts';
import { figureDocs } from '../src/components/figures/docs.ts';
import { layoutFlow, type FlowEdge, type FlowNode } from '../src/components/figures/flow.ts';
import { EVIDENCE, VARIANTS, WIDTHS, clock, fmt, newcombe, niceTicks, pct, readDifference, signed, wilson, wrap } from '../src/components/figures/lib.ts';

const DIR = join(ROOT, 'src', 'components', 'figures');
const atlas = loadAtlas();
const source = (name: string) => readFileSync(join(DIR, `${name}.astro`), 'utf8');
/** Names registered in index.ts, read as text: Vitest does not compile .astro files. */
const registered = [...readFileSync(join(DIR, 'index.ts'), 'utf8').matchAll(/^import (\w+) from '\.\/(\w+)\.astro';$/gm)].map((m) => m[1]);
const frameNames = FRAME_PROPS.map((p) => p.name);

/** Top-level members of `interface Props` in a component. */
function propsOf(name: string): string[] {
  const block = /interface Props[^{]*\{\n([\s\S]*?)\n\}/.exec(source(name));
  if (!block) throw new Error(`${name}.astro has no interface Props`);
  return [...block[1].matchAll(/^ {2}(\w+)\??:/gm)].map((m) => m[1]);
}

describe('catalogue', () => {
  it('lists every figure once, with a unique code, in a group that exists', () => {
    const names = FIGURES.map((f) => f.name);
    expect(new Set(names).size).toBe(names.length);
    expect(new Set(FIGURES.map((f) => f.code)).size).toBe(FIGURES.length);
    const groups = new Set(GROUPS.map((g) => g.id));
    expect(FIGURES.filter((f) => !groups.has(f.group)).map((f) => f.name)).toEqual([]);
    // codes carry the letter of their group
    const letter = new Map(GROUPS.map((g) => [g.id, g.code]));
    expect(FIGURES.filter((f) => !f.code.startsWith(`${letter.get(f.group)}-`)).map((f) => f.name)).toEqual([]);
  });

  it('matches the components on disk and the index entries can import from', () => {
    const names = FIGURES.map((f) => f.name).sort();
    expect(names.filter((n) => !existsSync(join(DIR, `${n}.astro`)))).toEqual([]);
    // Figure is the bare frame: registered for entries, not a catalogue item
    expect(registered.filter((n) => n !== 'Figure').sort()).toEqual(names);
    expect(registered).toContain('Figure');
  });

  it('describes the props each component really takes', () => {
    for (const f of FIGURES) {
      expect(propsOf(f.name).sort(), `${f.name}: catalogue props and interface Props differ`).toEqual(f.props.map((p) => p.name).sort());
      // a framed figure hands the frame props on; a frameless one must not claim them
      expect(/extends FrameProps/.test(source(f.name)), `${f.name}: frame props`).toBe(!f.frameless);
    }
  });

  it('gives every figure an example that sets its required props and nothing unknown', () => {
    for (const f of FIGURES) {
      expect(f.examples.length, `${f.name} has no example`).toBeGreaterThan(0);
      const known = new Set([...f.props.map((p) => p.name), ...(f.frameless ? [] : frameNames)]);
      const required = f.props.filter((p) => p.required).map((p) => p.name);
      for (const ex of f.examples) {
        const keys = Object.keys(ex.props);
        expect(keys.filter((k) => !known.has(k)), `${f.name}: unknown prop in an example`).toEqual([]);
        expect(required.filter((r) => !keys.includes(r)), `${f.name}: example misses a required prop`).toEqual([]);
        if ('evidence' in ex.props) expect(Object.keys(EVIDENCE)).toContain(ex.props.evidence);
      }
    }
    expect(EVIDENCE_KINDS.map((e) => e.id).sort()).toEqual(Object.keys(EVIDENCE).sort());
  });

  it('points at skills and territories that exist in the atlas', () => {
    const isSkill = (id: string) => atlas.nodes.get(id)?.level === 'skill';
    const isTerritory = (id: string) => atlas.nodes.get(id)?.level === 'territory';
    for (const f of FIGURES) {
      expect(f.skills.filter((s) => !isSkill(s)), `${f.name}: skills`).toEqual([]);
      expect(f.territories.filter((t) => !isTerritory(t)), `${f.name}: territories`).toEqual([]);
      for (const ex of f.examples) {
        const p = ex.props as { ids?: string[]; skills?: string[]; territories?: string[]; territory?: string };
        const skills = [...(f.name === 'Skills' ? (p.ids ?? []) : []), ...(f.name === 'Territories' ? (p.skills ?? []) : [])];
        expect(skills.filter((s) => !isSkill(s)), `${f.name}: example skills`).toEqual([]);
        if (f.name === 'TerritoryMark') expect(isTerritory(p.territory!), `${f.name}: ${p.territory}`).toBe(true);
      }
    }
  });

  it('has an emblem for every territory of the atlas', () => {
    const emblem = source('Emblem');
    expect(atlas.territories.map((t) => t.id).filter((id) => !emblem.includes(`territory === '${id}'`))).toEqual([]);
  });
});

describe('picker', () => {
  it('covers every kind of entry, section by section, with figures that exist', () => {
    expect(PICKER.map((k) => k.kind).sort()).toEqual(Object.keys(SECTIONS).sort());
    const names = new Set(FIGURES.map((f) => f.name));
    for (const k of PICKER) {
      expect(k.sections.map((s) => s.section), k.kind).toEqual([...SECTIONS[k.kind as keyof typeof SECTIONS]]);
      for (const s of k.sections) expect(s.figures.filter((n) => !names.has(n)), `${k.kind} / ${s.section}`).toEqual([]);
    }
  });

  it('offers every figure in at least one section', () => {
    const offered = new Set(PICKER.flatMap((k) => k.sections.flatMap((s) => s.figures)));
    expect(FIGURES.map((f) => f.name).filter((n) => !offered.has(n))).toEqual([]);
  });
});

describe('docs', () => {
  it('are up to date with the catalogue (run `npm run figures:docs`)', () => {
    for (const [path, text] of Object.entries(figureDocs())) {
      const file = join(ROOT, 'docs', path);
      expect(existsSync(file), `docs/${path} is missing`).toBe(true);
      expect(readFileSync(file, 'utf8') === text, `docs/${path} is out of date`).toBe(true);
    }
  });

  it('writes MDX the way an author would', () => {
    expect(toMdx('Bars', { title: 'A title', unit: '%', sort: true, max: 40 })).toBe('<Bars\n  title="A title"\n  unit="%"\n  sort\n  max={40}\n/>');
    expect(toMdx('Quote', { text: 'She said "no"' })).toBe(`<Quote\n  text={'She said "no"'}\n/>`);
    expect(toMdx('Funnel', { flag: false, steps: [{ label: 'One', value: 1 }] })).toBe("<Funnel\n  flag={false}\n  steps={[{ label: 'One', value: 1 }]}\n/>");
    // an apostrophe in a nested string switches that string to double quotes
    expect(toMdx('Bars', { items: [{ label: "It's", value: 2 }] })).toContain('{ label: "It\'s", value: 2 }');
  });
});

describe('entries', () => {
  const dir = join(ROOT, 'src', 'content', 'fieldwork');
  const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.mdx')) : [];
  // a profile's quick tour (src/content/tours) uses the figures plus its own <Stop> and <Hot>
  const tourDir = join(ROOT, 'src', 'content', 'tours');
  const tours = existsSync(tourDir) ? readdirSync(tourDir).filter((f) => f.endsWith('.mdx')) : [];
  const components = (body: string) => [...new Set([...body.replace(/```[\s\S]*?```/g, '').matchAll(/<([A-Z][A-Za-z]*)\b/g)].map((m) => m[1]))];

  it('only use figures that exist', () => {
    for (const f of files) {
      const { body } = splitFrontmatter(readFileSync(join(dir, f), 'utf8'));
      expect(components(body).filter((n) => !registered.includes(n)), f).toEqual([]);
    }
    const tourKnown = new Set([...registered, 'Stop', 'Hot']);
    for (const f of tours) {
      const body = readFileSync(join(tourDir, f), 'utf8');
      expect(components(body).filter((n) => !tourKnown.has(n)), `tours/${f}`).toEqual([]);
      expect(/illustrative/.test(body), `tours/${f} has a figure marked illustrative`).toBe(false);
    }
  });

  it('keep example data out of finished entries', () => {
    for (const f of files.filter((n) => !n.startsWith('_'))) {
      const { data, body } = splitFrontmatter(readFileSync(join(dir, f), 'utf8'));
      if ((data as { placeholder?: boolean }).placeholder) continue;
      expect(/illustrative/.test(body), `${f} is not a placeholder but has a figure marked illustrative`).toBe(false);
    }
  });

  it('skill bodies use figures that exist, with no example data', () => {
    const skillDir = join(ROOT, 'src', 'content', 'skills');
    const bodies = existsSync(skillDir) ? readdirSync(skillDir).filter((f) => f.endsWith('.mdx') && !f.startsWith('_')) : [];
    for (const f of bodies) {
      const { body } = splitFrontmatter(readFileSync(join(skillDir, f), 'utf8'));
      expect(components(body).filter((n) => !registered.includes(n)), `skills/${f}`).toEqual([]);
      expect(/illustrative/.test(body), `skills/${f} has a figure marked illustrative`).toBe(false);
    }
  });

  it('has a template that shows a figure in every section of an experiment', () => {
    const { body } = splitFrontmatter(readFileSync(join(dir, '_example-figures.mdx'), 'utf8'));
    for (const section of SECTIONS.experiment) {
      const part = body.split(`## ${section}\n`)[1]?.split('\n## ')[0] ?? '';
      expect(/<[A-Z]/.test(part), `"${section}" has no figure`).toBe(true);
    }
  });
});

describe('numbers', () => {
  it('computes Wilson intervals (Newcombe 1998: 81 of 263 gives 0.2553 to 0.3662)', () => {
    const ci = wilson(81, 263);
    expect(ci.lo).toBeCloseTo(0.2553, 4);
    expect(ci.hi).toBeCloseTo(0.3662, 4);
    expect(wilson(0, 20).lo).toBe(0);
    expect(wilson(20, 20).hi).toBe(1);
  });

  it('computes the interval for a difference (Newcombe 1998: 56/70 against 48/80 gives 0.0524 to 0.3339)', () => {
    const d = newcombe(48, 80, 56, 70);
    expect(d.p).toBeCloseTo(0.2, 6);
    expect(d.lo).toBeCloseTo(0.0524, 4);
    expect(d.hi).toBeCloseTo(0.3339, 4);
    expect(readDifference(d)).toBe('higher');
    expect(readDifference(newcombe(19, 84, 22, 79))).toBe('unclear');
    expect(readDifference(newcombe(56, 70, 48, 80))).toBe('lower');
  });

  it('formats numbers without inventing precision', () => {
    expect(fmt(1284)).toBe('1,284');
    expect(fmt(12900, { compact: true })).toBe('12.9K');
    expect(pct(0.2123)).toBe('21.2%');
    expect(pct(0.15, 1, true)).toBe('15.0%');
    expect(signed(6.7)).toBe('+6.7');
    expect(signed(-1.6)).toBe('−1.6');
    expect(clock(95)).toBe('1:35');
    expect(clock(3725)).toBe('1:02:05');
    expect(niceTicks(0, 100)).toEqual([0, 25, 50, 75, 100]);
    expect(wrap('Asked after the lesson', 12)).toEqual(['Asked after', 'the lesson']);
  });
});

describe('flow layout', () => {
  const examples = FIGURES.find((f) => f.name === 'Flow')!.examples.map((e) => e.props as { nodes: FlowNode[]; edges: FlowEdge[]; stages?: string[] });

  it('keeps every box and arrow inside the drawing, at both widths, with no boxes on top of each other', () => {
    for (const ex of examples) {
      for (const v of VARIANTS) {
        const L = layoutFlow(ex.nodes, ex.edges, v, ex.stages);
        expect(L.width).toBe(WIDTHS[v]);
        for (const n of L.nodes) {
          expect(n.x).toBeGreaterThanOrEqual(0);
          expect(n.x + n.w).toBeLessThanOrEqual(L.width);
          expect(n.y + n.h).toBeLessThanOrEqual(L.height);
        }
        for (const a of L.nodes) {
          for (const b of L.nodes) {
            if (a.id >= b.id) continue;
            const apart = a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y;
            expect(apart, `${v}: ${a.id} overlaps ${b.id}`).toBe(true);
          }
        }
        for (const e of L.edges) {
          const nums = e.d.match(/-?\d+(\.\d+)?/g)!.map(Number);
          nums.forEach((value, i) => {
            const limit = i % 2 === 0 ? L.width : L.height;
            expect(value, `${v}: ${e.from} to ${e.to}`).toBeGreaterThanOrEqual(0);
            expect(value, `${v}: ${e.from} to ${e.to}`).toBeLessThanOrEqual(limit);
          });
        }
      }
    }
  });

  it('refuses an arrow to a node that does not exist', () => {
    expect(() => layoutFlow([{ id: 'a', label: 'A', col: 0, row: 0 }], [{ from: 'a', to: 'b' }], 'wide')).toThrow(/does not exist/);
  });

  it('draws two arrows between the same nodes side by side, not on top of each other', () => {
    const nodes = [
      { id: 'lead', label: 'Lead', col: 0, row: 0 },
      { id: 'helper', label: 'Helper', col: 0, row: 1 },
    ];
    const edges = [
      { from: 'lead', to: 'helper' },
      { from: 'helper', to: 'lead' },
    ];
    for (const v of VARIANTS) {
      const [there, back] = layoutFlow(nodes, edges, v).edges;
      expect(there.d, v).not.toBe(back.d);
      const start = (d: string) => d.match(/-?\d+(\.\d+)?/g)!.map(Number);
      const [tx, ty] = start(there.d);
      const [, , bx, by] = start(back.d);
      // the return arrow ends where the outgoing one starts, moved across
      if (v === 'wide') expect(tx).not.toBe(bx);
      else expect(ty).not.toBe(by);
    }
  });
});
