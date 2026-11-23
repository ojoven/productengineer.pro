// Every territory, capability and skill on one plain-text page, for AI models and agents.
import { atlas, capability, code, path, skill } from '../lib/atlas.ts';
import { SITE } from '../site.ts';

const u = (p: string) => new URL(p, SITE.url).href;

export function GET() {
  const a = atlas();
  const out = [
    `# ${SITE.name}: the Skills Map in full`,
    '',
    `> The skills of product engineering: ${a.territories.length} groups, ${a.capabilities.length} capabilities and ${a.skills.length} skills. Codes read territory, capability, skill. Each line links to the skill's page, which has its resources and tools. Short guide: ${u('/llms.txt')}`,
  ];
  for (const t of a.territories) {
    out.push('', `## ${code(t.id)} ${t.name}`, '', `${t.question} ${t.description}`, `URL: ${u(path(t))}`);
    for (const c of t.capabilities.map(capability)) {
      out.push('', `### ${code(c.id)} ${c.name}`, '', c.description, `URL: ${u(path(c))}`, '');
      for (const s of c.skills.map(skill)) out.push(`- ${code(s.id)} [${s.name}](${u(path(s))}): ${s.summary} ${s.description}`);
    }
  }
  return new Response(`${out.join('\n')}\n`, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
