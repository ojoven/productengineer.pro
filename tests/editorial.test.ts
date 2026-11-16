import { describe, expect, it } from 'vitest';
import { loadAtlas } from '../src/atlas/load.ts';
import { h2s, loadEditorial, splitFrontmatter } from '../src/editorial/load.ts';
import { coverageProblems, sectionProblems, tourProblems, validateEditorial } from '../src/editorial/validate.ts';
import { entryCoverage } from '../src/editorial/coverage.ts';
import { SECTIONS } from '../src/editorial/schema.ts';

const atlas = loadAtlas();
const src = loadEditorial();

describe('fieldwork', () => {
  it('passes every check: skills exist, links resolve, sections follow the template', () => {
    expect(validateEditorial(atlas, src).errors).toEqual([]);
  });

  it('has at least one entry of every kind, so each template has a working example', () => {
    const kinds = new Set(src.fieldwork.map((e) => e.data.kind));
    expect([...kinds].sort()).toEqual(Object.keys(SECTIONS).sort());
  });

  it('marks every placeholder in its summary, so a list never passes one off as real work', () => {
    const unmarked = src.fieldwork.filter((e) => e.data.placeholder && !e.data.summary.startsWith('Placeholder'));
    expect(unmarked.map((e) => e.id)).toEqual([]);
  });
});

describe('profile coverage', () => {
  const profile = src.fieldwork.find((e) => e.id === 'mamitsu')!;
  const headings = profile.headings.map((text, i) => ({ text, depth: 2, slug: `section-${i}` }));

  it('exports linked atlas references and distinguishes product work from the wider conversation', () => {
    const exported = entryCoverage(atlas, profile, headings);
    expect(exported.version).toBe(1);
    expect(exported.entry.id).toBe('mamitsu');
    expect(exported.sections.flatMap((s) => s.skills.map((skill) => skill.id))).toEqual(profile.data.skills);
    expect(exported.sections.filter((s) => s.scope === 'product')).toHaveLength(8);
    expect(exported.sections.filter((s) => s.scope === 'general').map((s) => s.section)).toEqual(['Beyond the product']);
    for (const section of exported.sections) {
      expect(headings.some((h) => `#${h.slug}` === section.anchor && h.text === section.section)).toBe(true);
      for (const skill of section.skills) {
        expect(skill.name).toBeTruthy();
        expect(skill.code).toBeTruthy();
        expect(skill.url).toMatch(/^\/skills-map\//);
        // the wider discussion can reach any territory; a territory section stays inside its own
        if (section.territory) expect(skill.territory).toBe(section.territory.id);
        // a published profile says, per skill, how the product applied it
        expect(skill.note, skill.id).toBeTruthy();
      }
    }
  });

  it('only accepts notes for skills of the same section', () => {
    const broken = structuredClone(profile.data);
    broken.coverage[0].notes = { ...broken.coverage[0].notes, mcp: 'Belongs to the AI section.' };
    expect(coverageProblems(atlas, broken, profile.headings).some((p) => p.includes('a note for "mcp"'))).toBe(true);
  });

  it('rejects coverage that would light the wrong territory or omit a discussed skill', () => {
    const broken = structuredClone(profile.data);
    broken.coverage[0].territory = 'engineering';
    broken.coverage[1].skills.pop();
    const problems = coverageProblems(atlas, broken, profile.headings);
    expect(problems.some((p) => p.includes('not in engineering'))).toBe(true);
    expect(problems.some((p) => p.includes('in no section'))).toBe(true);
    expect(() => entryCoverage(atlas, profile, [])).toThrow(/missing heading/);
  });
});

describe('structure checks', () => {
  it('finds missing and out-of-order sections', () => {
    expect(sectionProblems('observation', ['What I saw', 'Why it matters', 'What I take from it'])).toEqual([]);
    expect(sectionProblems('observation', ['What I saw', 'Screenshots', 'Why it matters', 'What I take from it'])).toEqual([]);
    expect(sectionProblems('observation', ['What I saw', 'What I take from it'])[0]).toMatch(/Why it matters/);
    expect(sectionProblems('observation', ['Why it matters', 'What I saw', 'What I take from it'])[0]).toMatch(/order/);
  });

  it('reads front matter and level-two headings, ignoring code blocks', () => {
    const { data, body } = splitFrontmatter('---\ntitle: A\n---\n## One\ntext\n```\n## Not a heading\n```\n## Two\n');
    expect(data).toEqual({ title: 'A' });
    expect(h2s(body)).toEqual(['One', 'Two']);
  });

  it('rejects an unknown skill and a broken link', () => {
    const broken = structuredClone(src);
    broken.fieldwork[0].data.skills = ['not-a-skill'];
    broken.fieldwork[0].data.related = ['fieldwork/missing'];
    const { errors } = validateEditorial(atlas, broken);
    expect(errors.some((e) => e.includes('not-a-skill'))).toBe(true);
    expect(errors.some((e) => e.includes('fieldwork/missing'))).toBe(true);
  });

  it('asks a podcast for its episode, its guest and its coverage, like a profile', () => {
    const broken = structuredClone(src);
    const podcast = broken.fieldwork.find((e) => e.data.kind === 'podcast')!;
    if (!('subjects' in podcast.data)) throw new Error('Expected a research entry');
    podcast.data.episode = undefined;
    podcast.data.person = undefined;
    podcast.data.coverage = [];
    const { errors } = validateEditorial(atlas, broken);
    expect(errors.some((e) => e.includes('a podcast needs its `episode`'))).toBe(true);
    expect(errors.some((e) => e.includes('a podcast needs a person'))).toBe(true);
    expect(errors.some((e) => e.includes('a podcast needs `coverage`'))).toBe(true);
  });

  it('gives every published map entry a quick tour with one stop per skill, in coverage order', () => {
    const published = src.fieldwork.filter((x) => (x.data.kind === 'profile' || x.data.kind === 'podcast') && !x.data.draft && !x.data.placeholder);
    expect(published.length).toBeGreaterThan(0);
    for (const e of published) {
      const tour = src.tours.find((t) => t.id === e.id);
      expect(tour, `no quick tour for ${e.id}`).toBeTruthy();
      expect(tour!.stops).toEqual(e.data.coverage.flatMap((c) => c.skills));
    }
    const d = src.fieldwork.find((e) => e.id === 'mamitsu')!.data;
    const stops = d.coverage.flatMap((c) => c.skills);
    expect(tourProblems(d, stops)).toEqual([]);
    expect(tourProblems(d, [stops[1], stops[0], ...stops.slice(2)])[0]).toMatch(/out of order/);
    expect(tourProblems(d, stops.slice(1))[0]).toMatch(/no stop for unmet-needs/);
    expect(tourProblems(d, [...stops, 'pricing'])[0]).toMatch(/more than one stop for pricing/);
    expect(tourProblems(d, [...stops, 'cohort-analysis'])[0]).toMatch(/not in `coverage`/);
  });

  it('still validates experiment evidence and products in the merged collection', () => {
    const broken = structuredClone(src);
    const experiment = broken.fieldwork.find((e) => e.data.kind === 'experiment')!;
    if (!('product' in experiment.data)) throw new Error('Expected an applied entry');
    experiment.data.product = 'missing-product';
    experiment.data.hypothesis = undefined;
    experiment.data.metric = undefined;
    experiment.data.status = 'concluded';
    experiment.data.verdict = 'pending';
    const { errors } = validateEditorial(atlas, broken);
    expect(errors.some((e) => e.includes('missing-product'))).toBe(true);
    expect(errors.some((e) => e.includes('needs a hypothesis'))).toBe(true);
    expect(errors.some((e) => e.includes('needs a primary metric'))).toBe(true);
    expect(errors.some((e) => e.includes('needs a verdict'))).toBe(true);
  });
});
