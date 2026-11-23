// llms.txt (https://llmstxt.org): a short guide to the site for AI models and agents, built from
// the same data as the pages. llms-full.txt lists every skill.
import { atlas, code, path } from '../lib/atlas.ts';
import { fieldwork, itemPath } from '../lib/editorial.ts';
import { SITE } from '../site.ts';

const u = (p: string) => new URL(p, SITE.url).href;

export async function GET() {
  const a = atlas();
  const land = a.territories.filter((t) => !t.crossCutting).length;
  const entries = (await fieldwork()).filter((e) => !e.data.placeholder);
  const text = `# ${SITE.name}

> A free map of the skills of product engineering: ${land} territories plus a cross-cutting group, ${a.capabilities.length} capabilities and ${a.skills.length} skills, each with a short definition, checked resources and tools. "In practice" connects the map to real products: profiles told by their makers, reviews and experiments. Written by Mikel Torres Ugarte, a full-stack engineer and tech lead from Donostia, Spain.

A product engineer is a software engineer who also owns the product side of the work: talking to users, deciding what is worth building, shipping it in small steps and checking whether it helped.

Codes such as 06.4.5 read territory, capability, skill. Every territory, capability and skill has its own page. Links use permanent ids, so a renamed skill keeps its address.

## Start here

- [What is a product engineer?](${u('/what-is-a-product-engineer/')}): the definition, how the role differs from software engineer and product manager, and the skills it needs
- [Skills Map](${u('/skills-map/')}): the whole map of product engineering, by territory
- [In practice](${u('/in-practice/')}): product profiles and experiments, each connected to the skills it used
- [About](${u('/about/')}): who writes the site, how resources are chosen and how entries are written

## Territories

${a.territories.map((t) => `- [${code(t.id)} ${t.name}](${u(path(t))}): ${t.question}`).join('\n')}

## In practice

${entries.map((e) => `- [${e.data.title}](${u(itemPath(e))}): ${e.data.summary}`).join('\n')}

## For agents

- [All skills, one per line](${u('/llms-full.txt')}): code, name, definition and URL of every skill
- [Skills Map data](${u('/atlas-data.json')}): territories, capabilities and skills as JSON
- [MCP server, public](${u('/mcp/public')}): look up the Skills Map, no sign-in (Streamable HTTP)
- [MCP server, with sign-in](${u('/mcp')}): also reads a signed-in person's skill statuses, after they approve it
- [Agent skills](${u('/skills/')}): ten skills for coding agents on the product side of the work ([GitHub](https://github.com/ojoven/product-engineering-skills))

## Optional

- [Tools](${u('/tools/')}): tools for product engineering, linked to the skills they serve
- [Resources](${u('/resources/')}): checked articles, videos, books and courses
- [In practice feed](${u('/in-practice/rss.xml')}): RSS
`;
  return new Response(text, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
