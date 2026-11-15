// Reads the editorial files from disk for the build check, tests and pages that need plain data.
// Pages render entry bodies through Astro's content collections (src/content.config.ts), which use
// the same schemas.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { CONTENT, ROOT } from '../atlas/load.ts';
import { Author, FieldworkEntry, ProductMap } from './schema.ts';

export interface DiskEntry<T> {
  collection: 'fieldwork';
  id: string;
  file: string;
  data: T;
  /** `## ` headings of the body, in order. */
  headings: string[];
}

/** A profile's quick tour (src/content/tours/<id>.mdx): the skill of each `<Stop>`, in order. */
export interface DiskTour {
  id: string;
  file: string;
  stops: string[];
}

export interface EditorialSources {
  fieldwork: DiskEntry<FieldworkEntry>[];
  tours: DiskTour[];
  products: Record<string, ReturnType<typeof ProductMap.parse>[string]>;
  author: Author;
}

type Schema<T> = { safeParse(v: unknown): { success: true; data: T } | { success: false; error: { issues: { path: PropertyKey[]; message: string }[] } } };

function check<T>(raw: unknown, schema: Schema<T>, file: string): T {
  const result = schema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid content in ${file.replace(ROOT + '/', '')}:\n${issues}`);
  }
  return result.data;
}

/** Splits a Markdown file into its YAML front matter and body. */
export function splitFrontmatter(text: string): { data: unknown; body: string } {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text);
  if (!m) return { data: {}, body: text };
  return { data: parse(m[1]) ?? {}, body: m[2] };
}

/** Level-two headings, ignoring fenced code. */
export function h2s(body: string): string[] {
  return body
    .replace(/```[\s\S]*?```/g, '')
    .split('\n')
    .filter((l) => /^## /.test(l))
    .map((l) => l.slice(3).trim());
}

function loadEntries<T>(collection: 'fieldwork', schema: Schema<T>): DiskEntry<T>[] {
  const dir = join(CONTENT, collection);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => /\.mdx?$/.test(f) && !f.startsWith('_'))
    .sort()
    .map((f) => {
      const file = join(dir, f);
      const { data, body } = splitFrontmatter(readFileSync(file, 'utf8'));
      return { collection, id: f.replace(/\.mdx?$/, ''), file, data: check(data, schema, file), headings: h2s(body) };
    });
}

/** The `skill` of every `<Stop>` in a tour body, in order, ignoring fenced code. */
export function tourStops(body: string): string[] {
  return [...body.replace(/```[\s\S]*?```/g, '').matchAll(/<Stop\b[^>]*?\bskill=["']([^"']+)["']/g)].map((m) => m[1]);
}

export function loadTours(): DiskTour[] {
  const dir = join(CONTENT, 'tours');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.mdx') && !f.startsWith('_'))
    .sort()
    .map((f) => {
      const file = join(dir, f);
      return { id: f.replace(/\.mdx$/, ''), file, stops: tourStops(readFileSync(file, 'utf8')) };
    });
}

const yamlFile = (name: string) => {
  const file = join(CONTENT, name);
  return { file, raw: existsSync(file) ? (parse(readFileSync(file, 'utf8')) ?? {}) : {} };
};

export function loadProducts() {
  const { file, raw } = yamlFile('products.yaml');
  return check(raw, ProductMap, file);
}

export function loadAuthor(): Author {
  const { file, raw } = yamlFile('author.yaml');
  return check(raw, Author, file);
}

export function loadEditorial(): EditorialSources {
  return {
    fieldwork: loadEntries('fieldwork', FieldworkEntry),
    tours: loadTours(),
    products: loadProducts(),
    author: loadAuthor(),
  };
}
