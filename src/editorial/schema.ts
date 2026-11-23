// Schemas for the editorial layer that sits beside the atlas:
//
//   Fieldwork: product reviews, comparisons, interviews, profiles, podcast profiles, observations,
//   experiments, shipped improvements and case studies on real products.
//
// Every entry names the atlas skills it exercised, in the order they were used, so its page can
// light them on the map and each skill page can link back to it. The body is Markdown with a
// fixed set of sections per kind (SECTIONS below), checked by validateEditorial.
import { z } from 'astro/zod';
import { Id } from '../atlas/schema.ts';

const Text = z.string().trim().min(1);
/** YAML parsers disagree on unquoted dates (js-yaml returns a Date, yaml a string). Both end as YYYY-MM-DD. */
const IsoDate = z.preprocess(
  (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : v),
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'dates are YYYY-MM-DD'),
);
/** Older work may only be known to the year or month: YYYY, YYYY-MM or YYYY-MM-DD. */
const PartialDate = z.preprocess(
  (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : typeof v === 'number' ? String(v) : v),
  z.string().regex(/^\d{4}(?:-\d{2}(?:-\d{2})?)?$/, 'dates are YYYY, YYYY-MM or YYYY-MM-DD'),
);
/** A link to another entry: `fieldwork/<id>`. */
export const EntryRef = z.string().regex(/^fieldwork\/[a-z0-9]+(?:-[a-z0-9]+)*$/, 'refs look like fieldwork/<id>');

export const RESEARCH_KINDS = ['review', 'comparison', 'interview', 'profile', 'podcast', 'observation'] as const;
/** Kinds organised by territory through `coverage`: a maker's product across the map. */
export const MAP_KINDS = ['profile', 'podcast'] as const;
export const APPLICATION_KINDS = ['experiment', 'improvement', 'case-study'] as const;
export const FIELDWORK_KINDS = [...RESEARCH_KINDS, ...APPLICATION_KINDS] as const;
export const WORK_STATUS = ['planned', 'running', 'shipped', 'concluded', 'abandoned'] as const;
/** What the evidence said about the hypothesis. */
export const VERDICTS = ['pending', 'supported', 'not-supported', 'inconclusive'] as const;
/** What was done about it. */
export const DECISIONS = ['pending', 'keep', 'iterate', 'revert', 'stop'] as const;

export type FieldworkKind = (typeof FIELDWORK_KINDS)[number];
export type EntryKind = FieldworkKind;
/** Profiles and podcasts: one product across the map, grouped by territory. */
export const isMapKind = (kind: EntryKind): boolean => (MAP_KINDS as readonly string[]).includes(kind);

/**
 * The sections every entry of a kind has, as `## Heading` lines in this order. Extra sections are
 * allowed between them. Short is fine; a section can be one paragraph.
 */
export const SECTIONS: Record<EntryKind, readonly string[]> = {
  review: ['Scope', 'Who it is for', 'First run', 'What works', 'Where it loses people', 'Trade-offs', 'What I would test', 'What I take from it'],
  comparison: ['Scope', 'The shared job', 'Side by side', 'Where they differ', 'What I would test', 'What I take from it'],
  interview: ['Who and what', 'The decision', 'How they knew', 'What they measured', 'What they would change', 'What I take from it'],
  // A profile adds one section per territory it covers between "On the map" and "Beyond the product".
  // Those come from `coverage` in the front matter, and validateEditorial checks each one has its heading.
  profile: ['Who and what', 'On the map', 'Beyond the product', 'What I take from it'],
  // A podcast is a profile built from a public episode someone else recorded: same sections.
  podcast: ['Who and what', 'On the map', 'Beyond the product', 'What I take from it'],
  observation: ['What I saw', 'Why it matters', 'What I take from it'],
  experiment: ['Context', 'What I built', 'How I measured', 'What happened', 'Trade-offs', 'What I learned'],
  improvement: ['Context', 'What I shipped', 'Trade-offs', 'Effect', 'What I learned'],
  'case-study': ['Context', 'My role', 'Decisions', 'Outcome', 'What I would do differently'],
};

/**
 * The sections of one entry. A profile or podcast about a person and their work, with no product
 * in `subjects`, ends its territory sections with "Beyond the work" instead of "Beyond the product".
 */
export function sectionsFor(d: { kind: EntryKind; subjects?: readonly unknown[] }): readonly string[] {
  const aboutPerson = isMapKind(d.kind) && d.subjects !== undefined && d.subjects.length === 0;
  return aboutPerson ? SECTIONS[d.kind].map((h) => (h === 'Beyond the product' ? 'Beyond the work' : h)) : SECTIONS[d.kind];
}

const Subject = z.object({
  name: Text,
  url: z.url().optional(),
  /** Company or person behind it. */
  maker: Text.optional(),
  /** The product's logo, under public/img/fieldwork/<id>/: square SVG or PNG. Shown in lists and the social image. */
  logo: Text.optional(),
  /** One sentence: what the product is, written to be quoted. Used in the facts and in structured data. */
  what: Text.optional(),
});

const Person = z.object({
  name: Text,
  role: Text,
  url: z.url().optional(),
  /** Square portrait under public/img/fieldwork/<id>/. Shown beside the entry and on its social image. */
  avatar: Text.optional(),
  /** Other public profiles of the same person (X, GitHub), for structured data. */
  sameAs: z.array(z.url()).default([]),
});

/** Podcasts: the public episode the entry is built from. */
const Episode = z.object({
  /** The show, as it names itself. */
  show: Text,
  /** The episode's own title, in its language. */
  title: Text.optional(),
  url: z.url(),
  /** Who asks the questions. */
  host: Text,
  hostUrl: z.url().optional(),
  published: IsoDate,
  /** Length as h:mm:ss or m:ss. */
  duration: z.string().regex(/^\d+:\d{2}(?::\d{2})?$/, 'duration is h:mm:ss or m:ss'),
  /** Language spoken in the episode. */
  language: Text.optional(),
});

/**
 * Where on the map an entry went, section by section. One item per `##` section of the body that
 * discusses atlas skills. Together the items list every skill in `skills`, each once.
 * `/in-practice/<id>/map.json` serves it with names, codes and anchors, to light the map from it.
 */
export const COVERAGE_SCOPES = ['product', 'general'] as const;
const Coverage = z
  .object({
    /** Territory id, when the section belongs to one territory. Its skills must all be in it. */
    territory: Id.optional(),
    /** The `##` heading of the section. Default: the name of the territory. */
    section: Text.optional(),
    /** `product`: about the product itself. `general`: came up in the conversation, not about the product. */
    scope: z.enum(COVERAGE_SCOPES).default('product'),
    /** Skill ids discussed in the section, in the order the text reaches them. */
    skills: z.array(Id).min(1),
    /** One line: what the section says about this part of the map. */
    note: Text.optional(),
    /** One sentence per skill: how the product applied it. Shown in "On the map" and served in map.json. */
    notes: z.record(Id, Text).default({}),
  })
  .refine((c) => c.territory || c.section, { message: 'a coverage item needs a territory or a section' });

const Common = {
  title: Text,
  /** A shorter title for search results (about 60 characters), when `title` is long. */
  seoTitle: Text.optional(),
  /** One or two sentences: what this is and what came out of it. Used in lists and meta tags. */
  summary: Text,
  /** A structure example, not a real piece of work. Shown with a notice, kept out of search and the sitemap. */
  placeholder: z.boolean().default(false),
  /**
   * Written, but not cleared to go out: an interviewee has not read it yet. The page builds and is
   * reachable by URL, with a notice. It stays out of lists, skill pages, the sitemap and search.
   */
  draft: z.boolean().default(false),
  /** Atlas skill ids, in the order the work used them. The map highlights these skills. */
  skills: z.array(Id).min(1),
  /** The same skills grouped by the section that discusses them. Required for profiles. */
  coverage: z.array(Coverage).default([]),
  /** Other entries this one fed or came from. Every item should connect to at least one when possible. */
  related: z.array(EntryRef).default([]),
};

const ResearchEntry = z.object({
  kind: z.enum(RESEARCH_KINDS),
  date: IsoDate,
  updated: IsoDate.optional(),
  /**
   * Products looked at. A comparison has two or more. A profile or podcast about a person and their
   * work, not a product, has none: the page then leads with the person.
   */
  subjects: z.array(Subject).default([]),
  /** Interviews and profiles: who was interviewed. Podcasts: the guest. */
  person: Person.optional(),
  /** Podcasts: the episode it is built from. */
  episode: Episode.optional(),
  /** What I set out to find out, as a question. */
  question: Text,
  /** How I looked: version, platform, dates, time spent, as what kind of user. */
  method: Text,
  ...Common,
});

const Metric = z.object({
  name: Text,
  baseline: Text.optional(),
  target: Text.optional(),
  result: Text.optional(),
});

const AppliedEntry = z.object({
  kind: z.enum(APPLICATION_KINDS),
  /** Product id from src/content/products.yaml. */
  product: Id,
  started: PartialDate,
  ended: PartialDate.optional(),
  status: z.enum(WORK_STATUS),
  /** The user problem, in one or two sentences, with the evidence that it is real. */
  problem: Text,
  /** Experiments: "If we ..., then ... , because ...". Optional for other kinds. */
  hypothesis: Text.optional(),
  /** Experiments: the one number that decides it. */
  metric: Metric.optional(),
  /** Numbers that must not get worse. */
  guardrails: z.array(Metric).default([]),
  verdict: z.enum(VERDICTS).default('pending'),
  decision: z.enum(DECISIONS).default('pending'),
  ...Common,
});

export const FieldworkEntry = z.discriminatedUnion('kind', [ResearchEntry, AppliedEntry]);

export const Product = z.object({
  name: Text,
  url: z.url().optional(),
  /** One line: what it is. */
  what: Text,
  /** Mine, or work done for someone else. */
  owned: z.boolean().default(true),
  role: Text.optional(),
  since: z.number().int().optional(),
});
export const ProductMap = z.record(Id, Product);

const Link = z.object({ label: Text, href: z.url() });

export const Author = z.object({
  name: Text,
  role: Text,
  location: Text,
  photo: Text.optional(),
  /** Paragraphs, in the author's voice. */
  intro: z.array(Text).min(1),
  links: z.array(Link).default([]),
  outcomes: z.array(z.object({ value: Text, label: Text, text: Text })).default([]),
  /** Selected product work. Skills light the author's map. */
  work: z
    .array(
      z.object({
        title: Text,
        context: Text,
        when: Text.optional(),
        text: Text,
        decisions: z.array(Text).default([]),
        skills: z.array(Id).min(1),
        /** Fieldwork entries about this work. */
        related: z.array(EntryRef).default([]),
        /** Still to be written by the author. */
        placeholder: z.boolean().default(false),
      }),
    )
    .default([]),
  background: z.array(z.object({ years: Text, title: Text, text: Text })).default([]),
  /** What I am working on next. Honest gaps, not a sales pitch. */
  next: z.array(z.object({ label: Text, text: Text })).default([]),
});

export type FieldworkEntry = z.infer<typeof FieldworkEntry>;
export type Coverage = z.infer<typeof Coverage>;
export type Episode = z.infer<typeof Episode>;
export type Product = z.infer<typeof Product>;
export type Author = z.infer<typeof Author>;
