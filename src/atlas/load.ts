// Reads the content files from disk. Used at build time, by scripts and by tests.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { ResourceMap, TerritoryFile, ToolMap } from './schema.ts';
import { buildAtlas, type Atlas, type AtlasSources } from './model.ts';
import type { Geometry } from './geometry.ts';

// The project root. In a build this module is bundled elsewhere, so prefer the working
// directory (Astro, Vitest and the scripts all run from the root) and fall back to this file.
function findRoot(): string {
  const fromFile = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
  for (const dir of [process.cwd(), fromFile]) if (existsSync(join(dir, 'src', 'content', 'atlas'))) return dir;
  return process.cwd();
}
export const ROOT = findRoot();
export const CONTENT = join(ROOT, 'src', 'content');
export const GEOMETRY_FILE = join(ROOT, 'src', 'atlas', 'geometry.json');

const yamlFiles = (dir: string) =>
  existsSync(dir)
    ? readdirSync(dir)
        .filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'))
        .sort()
        .map((f) => join(dir, f))
    : [];

function parseFile<T>(file: string, schema: { safeParse(v: unknown): { success: true; data: T } | { success: false; error: { issues: { path: PropertyKey[]; message: string }[] } } }): T {
  const raw = parse(readFileSync(file, 'utf8')) ?? {};
  const result = schema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid content in ${file.replace(ROOT + '/', '')}:\n${issues}`);
  }
  return result.data;
}

export function loadSources(): AtlasSources {
  const territories = yamlFiles(join(CONTENT, 'atlas')).map((f) => parseFile(f, TerritoryFile));
  const resources: AtlasSources['resources'] = {};
  for (const f of yamlFiles(join(CONTENT, 'resources'))) {
    for (const [id, r] of Object.entries(parseFile(f, ResourceMap))) {
      if (resources[id]) throw new Error(`resource id "${id}" is defined twice (${f})`);
      resources[id] = r;
    }
  }
  const tools: AtlasSources['tools'] = {};
  for (const f of yamlFiles(join(CONTENT, 'tools'))) {
    for (const [id, t] of Object.entries(parseFile(f, ToolMap))) {
      if (tools[id]) throw new Error(`tool id "${id}" is defined twice (${f})`);
      tools[id] = t;
    }
  }
  return { territories, resources, tools };
}

export function loadAtlas(): Atlas {
  return buildAtlas(loadSources());
}

export function loadGeometry(): Geometry {
  return JSON.parse(readFileSync(GEOMETRY_FILE, 'utf8')) as Geometry;
}
