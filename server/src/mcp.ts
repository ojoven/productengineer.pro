// The MCP server. Agents read the atlas (territories, capabilities, skills, resources, tools)
// and, when signed in, the person's own progress. Read-only.
//
// Two endpoints share one tool definition:
//   /mcp         OAuth required. Every tool, with the person's statuses included.
//   /mcp/public  No sign-in. The atlas content only.
import { createMcpHandler, McpServer, type CallToolResult } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import type { Atlas, Node, Skill } from './atlas.ts';
import type { Db } from './db.ts';
import { getUser, readProgress, type User } from './users.ts';

type Status = 'learning' | 'comfortable' | 'not-interested' | 'not_started';
const STATUS_FILTER = ['learning', 'comfortable', 'not-interested', 'not_started', 'marked'] as const;

interface ToolDeps {
  atlas: Atlas;
  db: Db;
  publicUrl: string;
  version: string;
}

const INSTRUCTIONS = `ProductEngineer.pro is the Skill Atlas, a map of product engineering organised into territories, capabilities and skills, with AI as its own territory. Each skill has a short description, checked learning resources and the tools people use for it. Codes like 06.4.5 read territory.capability.skill.
Start with list_territories or search_atlas, then drill down with get_territory, get_capability and get_skill. Ids are lowercase kebab-case slugs; codes work too.`;

const INSTRUCTIONS_USER = `${INSTRUCTIONS}
This connection is signed in. Each person marks skills as "learning", "comfortable" or "not-interested"; everything else is "not_started". Skills marked "not-interested" are deliberately excluded from their development interests; respect that choice when suggesting what to learn. Use get_my_progress for an overview of where they stand, and list_skills with a status filter to find gaps or what they are learning now. Statuses are set by the person on the site, not through this server.`;

const text = (data: unknown): CallToolResult => ({ content: [{ type: 'text', text: JSON.stringify(data) }] });
const notFound = (what: string, id: string): CallToolResult => ({
  isError: true,
  content: [{ type: 'text', text: `No ${what} with id or code "${id}". Use search_atlas or list_territories to find one.` }],
});
const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const;

export function buildServer(deps: ToolDeps, user: User | undefined): McpServer {
  const { atlas, db, publicUrl } = deps;
  const server = new McpServer(
    { name: 'productengineer-atlas', title: 'ProductEngineer.pro Skill Atlas', version: deps.version, websiteUrl: publicUrl },
    { instructions: user ? INSTRUCTIONS_USER : INSTRUCTIONS },
  );

  // the person's statuses, read once per request and only if a tool needs them
  let cache: ReturnType<typeof readProgress> | undefined;
  const progress = () => (cache ??= user ? readProgress(db, user.id) : {});
  const statusOf = (id: string): Status => progress()[id]?.status ?? 'not_started';
  const url = (n: { path: string }) => publicUrl + n.path;
  const rollup = (skills: Skill[]) => {
    let comfortable = 0;
    let learning = 0;
    let not_interested = 0;
    for (const s of skills) {
      const st = statusOf(s.id);
      if (st === 'comfortable') comfortable++;
      else if (st === 'learning') learning++;
      else if (st === 'not-interested') not_interested++;
    }
    return { skills: skills.length, comfortable, learning, not_interested, not_started: skills.length - comfortable - learning - not_interested };
  };
  const withStatus = <T extends object>(obj: T, id: string) => (user ? { ...obj, status: statusOf(id) } : obj);
  const brief = (n: Node) => ({ level: n.level, id: n.id, code: n.code, name: n.name });
  const resourcesOf = (ids: string[]) => ids.map((id) => atlas.resources[id]).filter(Boolean);
  const toolsOf = (ids: string[]) => ids.map((id) => atlas.tools[id]).filter(Boolean);

  server.registerTool(
    'list_territories',
    {
      title: 'List territories',
      description:
        'The top level of the atlas: the territories plus the cross-cutting group, each with the question it answers and how many capabilities and skills it holds' +
        (user ? ', and the person’s progress in it.' : '.'),
      annotations: READ_ONLY,
    },
    async () =>
      text({
        atlas: { territories: atlas.territories.length, capabilities: atlas.capabilities.length, skills: atlas.skills.length, url: `${publicUrl}/atlas/` },
        territories: atlas.territories.map((t) => {
          const skills = atlas.skillsIn(t);
          return {
            id: t.id,
            code: t.code,
            name: t.name,
            tagline: t.tagline,
            question: t.question,
            capabilities: t.capabilities.length,
            ...(user ? { progress: rollup(skills) } : { skills: skills.length }),
            url: url(t),
          };
        }),
      }),
  );

  server.registerTool(
    'get_territory',
    {
      title: 'Get a territory',
      description: 'One territory: what it covers, what a product engineer should be able to do there, and its capabilities.',
      inputSchema: z.object({ id: z.string().describe('Territory id (e.g. "measurement") or code (e.g. "06")') }),
      annotations: READ_ONLY,
    },
    async ({ id }) => {
      const t = atlas.territory(id);
      if (!t) return notFound('territory', id);
      return text({
        id: t.id,
        code: t.code,
        name: t.name,
        tagline: t.tagline,
        question: t.question,
        description: t.description,
        expected: t.expected,
        url: url(t),
        ...(user ? { progress: rollup(atlas.skillsIn(t)) } : {}),
        capabilities: t.capabilities.map((cid) => {
          const c = atlas.capability(cid)!;
          return {
            id: c.id,
            code: c.code,
            name: c.name,
            description: c.description,
            ...(user ? { progress: rollup(atlas.skillsIn(c)) } : { skills: c.skills.length }),
          };
        }),
      });
    },
  );

  server.registerTool(
    'get_capability',
    {
      title: 'Get a capability',
      description: 'One capability: its description, its skills with one-line summaries, overview resources and tools.',
      inputSchema: z.object({ id: z.string().describe('Capability id (e.g. "experiment-design") or code (e.g. "06.4")') }),
      annotations: READ_ONLY,
    },
    async ({ id }) => {
      const c = atlas.capability(id);
      if (!c) return notFound('capability', id);
      const t = atlas.territory(c.territory)!;
      return text({
        id: c.id,
        code: c.code,
        name: c.name,
        description: c.description,
        territory: brief(t),
        url: url(c),
        ...(user ? { progress: rollup(atlas.skillsIn(c)) } : {}),
        skills: c.skills.map((sid) => {
          const s = atlas.skill(sid)!;
          return withStatus({ id: s.id, code: s.code, name: s.name, summary: s.summary }, s.id);
        }),
        resources: resourcesOf(c.resources),
        tools: toolsOf(c.tools),
        related: atlas.related(c).map(brief),
      });
    },
  );

  server.registerTool(
    'get_skill',
    {
      title: 'Get a skill',
      description:
        'One skill: what it is and why it matters, checked resources (intro and deep), the tools used for it, and related skills' +
        (user ? ', plus the person’s status.' : '.'),
      inputSchema: z.object({ id: z.string().describe('Skill id (e.g. "sample-size") or code (e.g. "06.4.5")') }),
      annotations: READ_ONLY,
    },
    async ({ id }) => {
      const s = atlas.skill(id);
      if (!s) return notFound('skill', id);
      const p = progress()[s.id];
      return text({
        id: s.id,
        code: s.code,
        name: s.name,
        summary: s.summary,
        description: s.description,
        territory: brief(atlas.territory(s.territory)!),
        capability: brief(atlas.capability(s.capability)!),
        url: url(s),
        ...(user ? { status: statusOf(s.id), status_updated: p ? new Date(p.at).toISOString() : null } : {}),
        resources: resourcesOf(s.resources),
        tools: toolsOf(s.tools),
        related: atlas.related(s).map((n) => withStatus(brief(n), n.id)),
      });
    },
  );

  server.registerTool(
    'search_atlas',
    {
      title: 'Search the atlas',
      description: 'Finds territories, capabilities and skills by words in their names and descriptions. Best for mapping a topic ("pricing", "feature flags", "onboarding") to atlas ids.',
      inputSchema: z.object({
        query: z.string().min(2).max(200).describe('Words to look for'),
        limit: z.number().int().min(1).max(30).optional().describe('Results to return, default 10'),
      }),
      annotations: READ_ONLY,
    },
    async ({ query, limit }) =>
      text({
        query,
        results: atlas.search(query, limit ?? 10).map(({ node }) =>
          withStatus(
            {
              ...brief(node),
              summary: node.level === 'skill' ? node.summary : node.level === 'territory' ? node.question : node.description,
              url: url(node),
            },
            node.id,
          ),
        ),
      }),
  );

  const scopeSchema = {
    territory: z.string().optional().describe('Only skills in this territory (id or code)'),
    capability: z.string().optional().describe('Only skills in this capability (id or code)'),
    limit: z.number().int().min(1).max(400).optional().describe('Most skills to return, default 100'),
  };
  server.registerTool(
    'list_skills',
    {
      title: 'List skills',
      description: user
        ? 'Lists skills with the person’s status, filtered by territory, capability and status. Use status "not_started" to find gaps, "learning" for what they are working on now, "not-interested" for skills they have opted out of, "marked" for anything they have marked.'
        : 'Lists skills with their one-line summaries, filtered by territory or capability.',
      inputSchema: user
        ? z.object({ ...scopeSchema, status: z.enum(STATUS_FILTER).optional().describe('Only skills with this status') })
        : z.object(scopeSchema),
      annotations: READ_ONLY,
    },
    async (args: { territory?: string; capability?: string; limit?: number; status?: (typeof STATUS_FILTER)[number] }) => {
      let skills: Skill[] = atlas.skills;
      if (args.capability) {
        const c = atlas.capability(args.capability);
        if (!c) return notFound('capability', args.capability);
        skills = atlas.skillsIn(c);
      } else if (args.territory) {
        const t = atlas.territory(args.territory);
        if (!t) return notFound('territory', args.territory);
        skills = atlas.skillsIn(t);
      }
      if (user && args.status) {
        const want = args.status;
        skills = skills.filter((s) => (want === 'marked' ? statusOf(s.id) !== 'not_started' : statusOf(s.id) === want));
      }
      const limit = args.limit ?? 100;
      return text({
        total: skills.length,
        returned: Math.min(limit, skills.length),
        skills: skills.slice(0, limit).map((s) =>
          withStatus({ id: s.id, code: s.code, name: s.name, summary: s.summary, capability: s.capability, territory: s.territory }, s.id),
        ),
      });
    },
  );

  if (user) {
    server.registerTool(
      'get_my_progress',
      {
        title: 'Get my progress',
        description:
          'An overview of the signed-in person’s map: totals, progress per territory, the skills they are learning now, territories they have not touched, and their latest changes.',
        annotations: READ_ONLY,
      },
      async () => {
        const p = progress();
        const territories = atlas.territories.map((t) => ({ id: t.id, code: t.code, name: t.name, ...rollup(atlas.skillsIn(t)) }));
        const changes = Object.entries(p).sort((a, b) => b[1].at - a[1].at);
        const learning = atlas.skills
          .filter((s) => p[s.id]?.status === 'learning')
          .map((s) => ({ id: s.id, code: s.code, name: s.name, capability: s.capability, territory: s.territory, since: new Date(p[s.id].at).toISOString() }));
        return text({
          person: { name: user.name, member_since: new Date(user.created_at).toISOString().slice(0, 10) },
          totals: rollup(atlas.skills),
          last_change: changes[0] ? new Date(changes[0][1].at).toISOString() : null,
          territories,
          learning,
          untouched_territories: territories.filter((t) => !t.comfortable && !t.learning && !t.not_interested).map((t) => t.name),
          recent_changes: changes.slice(0, 10).map(([id, v]) => ({ id, name: atlas.skill(id)?.name ?? id, status: v.status, at: new Date(v.at).toISOString() })),
          map_url: `${publicUrl}/me/`,
        });
      },
    );
  }

  return server;
}

export function mcpHandlers(deps: ToolDeps) {
  const signedIn = createMcpHandler(({ authInfo }) => {
    const userId = authInfo?.extra?.userId;
    const user = typeof userId === 'string' ? getUser(deps.db, userId) : undefined;
    // the bearer check runs first, so a missing user means the account was deleted mid-request
    return buildServer(deps, user);
  });
  const open = createMcpHandler(() => buildServer(deps, undefined));
  return { signedIn, open };
}
