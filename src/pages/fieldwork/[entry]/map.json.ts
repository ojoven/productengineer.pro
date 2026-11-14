import type { APIRoute } from 'astro';
import { render } from 'astro:content';
import { atlas } from '../../../lib/atlas.ts';
import { allItems, type Item } from '../../../lib/editorial.ts';
import { entryCoverage } from '../../../editorial/coverage.ts';

export async function getStaticPaths() {
  return (await allItems())
    .filter((entry) => entry.data.coverage.length > 0)
    .map((entry) => ({ params: { entry: entry.id }, props: { entry } }));
}

export const GET: APIRoute = async ({ props }) => {
  const entry = props.entry as Item;
  const { headings } = await render(entry);
  return new Response(JSON.stringify(entryCoverage(atlas(), entry, headings)), {
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...(entry.data.draft ? { 'X-Robots-Tag': 'noindex' } : {}) },
  });
};
