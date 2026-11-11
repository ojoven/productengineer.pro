import { Atlas } from '../src/atlas.ts';
import { openDb } from '../src/db.ts';
import { createApp, type Deps } from '../src/app.ts';
import { loadConfig } from '../src/config.ts';
import { providersFrom } from '../src/providers.ts';
import type { ClientMetadataFetcher } from '../src/cimd.ts';

export const PUBLIC = 'http://localhost:4321';

const skill = (id: string, code: string, capability: string, territory: string, name: string, related: string[] = []) => ({
  id,
  code,
  name,
  summary: `${name} in one line.`,
  description: `${name} described.`,
  capability,
  territory,
  path: `/atlas/${territory}/${capability}/${id}/`,
  related,
  resources: id === 'sample-size' ? ['evan-miller'] : [],
  tools: id === 'sample-size' ? ['growthbook'] : [],
});

export function fixtureAtlas(): Atlas {
  return new Atlas({
    generated: 'test',
    territories: [
      {
        id: 'discovery',
        code: '01',
        name: 'Discovery',
        tagline: 'Find the real problem',
        question: 'Are we solving a real problem?',
        description: 'Discovery.',
        expected: 'Talk to users.',
        crossCutting: false,
        path: '/atlas/discovery/',
        capabilities: ['user-research'],
      },
      {
        id: 'measurement',
        code: '06',
        name: 'Measurement',
        tagline: 'Learn from evidence',
        question: 'What evidence supports our next decision?',
        description: 'Measurement.',
        expected: 'Measure.',
        crossCutting: false,
        path: '/atlas/measurement/',
        capabilities: ['experiment-design', 'product-analytics'],
      },
    ],
    capabilities: [
      {
        id: 'user-research',
        code: '01.1',
        name: 'User research',
        description: 'Research.',
        territory: 'discovery',
        path: '/atlas/discovery/user-research/',
        related: [],
        resources: [],
        tools: [],
        skills: ['user-interviews'],
      },
      {
        id: 'experiment-design',
        code: '06.1',
        name: 'Experiment design',
        description: 'Experiments.',
        territory: 'measurement',
        path: '/atlas/measurement/experiment-design/',
        related: [],
        resources: ['evan-miller'],
        tools: ['growthbook'],
        skills: ['sample-size', 'ab-testing'],
      },
      {
        id: 'product-analytics',
        code: '06.2',
        name: 'Product analytics',
        description: 'Analytics.',
        territory: 'measurement',
        path: '/atlas/measurement/product-analytics/',
        related: [],
        resources: [],
        tools: [],
        skills: ['funnel-analysis'],
      },
    ],
    skills: [
      skill('user-interviews', '01.1.1', 'user-research', 'discovery', 'User interviews'),
      skill('sample-size', '06.1.1', 'experiment-design', 'measurement', 'Sample size', ['ab-testing']),
      skill('ab-testing', '06.1.2', 'experiment-design', 'measurement', 'A/B testing'),
      skill('funnel-analysis', '06.2.1', 'product-analytics', 'measurement', 'Funnel analysis', ['sample-size']),
    ],
    resources: {
      'evan-miller': { title: 'Sample size calculator', url: 'https://www.evanmiller.org/ab-testing/sample-size.html', author: 'Evan Miller', type: 'tool-guide', level: 'intro', why: 'The standard calculator.', paid: false },
    },
    tools: { growthbook: { name: 'GrowthBook', url: 'https://www.growthbook.io/', what: 'Experiments and flags.', pricing: 'open-source' } },
    aliases: { 'old-sample-size': 'sample-size' },
  });
}

export function makeApp(opts: { fetchClientMetadata?: ClientMetadataFetcher } = {}) {
  // The SDK also checks expiry against the wall clock. Start alongside it, then let tests
  // advance this clock explicitly to exercise expiry without waiting.
  const clock = { now: Date.now() };
  const config = loadConfig({ PUBLIC_URL: PUBLIC, DEV_LOGIN: '1' } as NodeJS.ProcessEnv);
  const deps: Deps = {
    config,
    db: openDb(':memory:'),
    atlas: fixtureAtlas(),
    providers: providersFrom(config),
    now: () => clock.now,
    version: 'test',
    fetchClientMetadata: opts.fetchClientMetadata ?? (async () => Promise.reject(new Error('no network in tests'))),
  };
  const app = createApp(deps);
  const fetch = (input: string | URL | Request, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : String(input);
    return Promise.resolve(app.request(input instanceof Request ? input : new URL(url, PUBLIC).href, init));
  };
  return { app, deps, clock, fetch };
}

/** A browser with its own cookie jar, talking to the app in-process. */
export class Browser {
  cookies = new Map<string, string>();
  readonly fetchApp: (input: string, init?: RequestInit) => Promise<Response>;
  constructor(fetchApp: (input: string, init?: RequestInit) => Promise<Response>) {
    this.fetchApp = fetchApp;
  }

  async request(path: string, init: RequestInit & { json?: unknown } = {}): Promise<Response> {
    const headers = new Headers(init.headers);
    if (this.cookies.size) headers.set('cookie', [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; '));
    let body = init.body;
    if (init.json !== undefined) {
      headers.set('content-type', 'application/json');
      headers.set('origin', PUBLIC);
      body = JSON.stringify(init.json);
    }
    const res = await this.fetchApp(new URL(path, PUBLIC).href, { ...init, headers, body, redirect: 'manual' });
    for (const line of res.headers.getSetCookie()) {
      const [pair, ...attrs] = line.split(';');
      const i = pair.indexOf('=');
      const name = pair.slice(0, i).trim();
      const value = pair.slice(i + 1).trim();
      const gone = attrs.some((a) => /max-age=0\b/i.test(a.trim())) || attrs.some((a) => /expires=thu, 01 jan 1970/i.test(a.trim()));
      if (gone || !value) this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
    return res;
  }

  /** Signs in with the dev provider as a named fake person. */
  async signIn(as = 'alice', opts: { link?: boolean; returnTo?: string } = {}): Promise<Response> {
    const q = new URLSearchParams({ as, return: opts.returnTo ?? '/me/' });
    if (opts.link) q.set('link', '1');
    const start = await this.request(`/api/auth/dev/start?${q}`);
    if (start.status !== 302) throw new Error(`start returned ${start.status}`);
    return this.request(start.headers.get('location')!);
  }
}

export const location = (res: Response) => new URL(res.headers.get('location')!, PUBLIC);
