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

export const collections = { fieldwork, tours };
