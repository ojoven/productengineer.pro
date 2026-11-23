// Fieldwork entries are Markdown (.md), or MDX (.mdx) when they use figures, with front
// matter, rendered by Astro. The atlas, resources and tools stay plain YAML, read by
// src/atlas/load.ts; they are not collections.
//
// A quick tour is an .mdx file under src/content/tours/ named after the profile it belongs to:
// one <Stop skill="…"> per skill of the profile's coverage, in the same order. It has no front matter.
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { FieldworkEntry } from './editorial/schema.ts';

const fieldwork = defineCollection({
  loader: glob({ base: './src/content/fieldwork', pattern: '[^_]*.{md,mdx}' }),
  schema: FieldworkEntry,
});

const tours = defineCollection({
  loader: glob({ base: './src/content/tours', pattern: '[^_]*.mdx' }),
  schema: z.object({}),
});

// A skill's body: optional MDX at src/content/skills/<skill-id>.mdx, shown on the skill page under
// the short description. It can use every figure by name, as entries do. Format and plan:
// docs/skill-bodies.md and docs/skill-bodies-batches.md.
const skills = defineCollection({
  loader: glob({ base: './src/content/skills', pattern: '[^_]*.{md,mdx}' }),
  schema: z.object({
    // YAML reads an unquoted 2026-11-20 as a date; keep it as the string.
    updated: z.preprocess((v) => (v instanceof Date ? v.toISOString().slice(0, 10) : v), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'dates are YYYY-MM-DD')),
    /** Every source used for a fact or the example, opened and checked. */
    sources: z.array(z.object({ title: z.string().trim().min(1), url: z.string().url() })).default([]),
  }),
});

export const collections = { fieldwork, tours, skills };
