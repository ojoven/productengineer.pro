// Fieldwork entries are Markdown (.md), or MDX (.mdx) when they use figures, with front
// matter, rendered by Astro. The atlas, resources and tools stay plain YAML, read by
// src/atlas/load.ts; they are not collections.
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { FieldworkEntry } from './editorial/schema.ts';

const fieldwork = defineCollection({
  loader: glob({ base: './src/content/fieldwork', pattern: '[^_]*.{md,mdx}' }),
  schema: FieldworkEntry,
});

export const collections = { fieldwork };
