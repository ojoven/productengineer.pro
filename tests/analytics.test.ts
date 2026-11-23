import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let local: Map<string, string>;
let session: Map<string, string>;
const fakeStorage = (data: Map<string, string>) => ({ getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value), removeItem: (key: string) => data.delete(key) });
const requests = () => vi.mocked(fetch).mock.calls.map(([, init]) => JSON.parse(String(init!.body)));

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv('PROD', true);
  local = new Map(); session = new Map();
  vi.stubGlobal('localStorage', fakeStorage(local)); vi.stubGlobal('sessionStorage', fakeStorage(session));
  vi.stubGlobal('window', new EventTarget()); vi.stubGlobal('document', Object.assign(new EventTarget(), { referrer: 'https://linkedin.com/feed/?private=secret', querySelector: () => null }));
  vi.stubGlobal('location', { href: 'https://productengineer.pro/library/', hostname: 'productengineer.pro', pathname: '/library/', search: '?q=private-email@example.com&utm_source=linkedin&code=secret' });
  vi.stubGlobal('screen', { width: 1440, height: 900 });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers(); });

describe('Rybbit boundary', () => {
  it('sends sanitized pageviews and drains early events only once', async () => {
    const { initAnalytics, track } = await import('../src/scripts/track.ts');
    track('progress_changed', { changed_count: 3, surface: 'bulk', email: 'secret@example.com', private_map: 'secret', storage: 'local' });
    initAnalytics(); initAnalytics();
    expect(requests()).toHaveLength(2);
    expect(requests()[0]).toMatchObject({ type: 'pageview', querystring: '?utm_source=linkedin', referrer: 'https://linkedin.com' });
    expect(requests()[1]).toMatchObject({ type: 'custom_event', event_name: 'progress_changed' });
    expect(JSON.parse(requests()[1].properties)).toMatchObject({ changed_count: 3, utm_source: 'linkedin' });
    expect(JSON.stringify(requests())).not.toMatch(/private|secret|example.com/);
  });
  it.each(['localhost', '127.0.0.1', 'staging.productengineer.pro'])('never collects from %s', async hostname => {
    location.hostname = hostname;
    const { initAnalytics, track } = await import('../src/scripts/track.ts');
    initAnalytics(); track('map_used');
    expect(fetch).not.toHaveBeenCalled();
  });
  it('does not collect in development, protected routes or after opt-out', async () => {
    vi.stubEnv('PROD', false);
    let adapter = await import('../src/scripts/track.ts'); adapter.initAnalytics();
    expect(fetch).not.toHaveBeenCalled();
    vi.resetModules(); vi.stubEnv('PROD', true); location.pathname = '/connect/';
    adapter = await import('../src/scripts/track.ts'); adapter.initAnalytics();
    expect(fetch).not.toHaveBeenCalled();
    vi.resetModules(); location.pathname = '/library/'; local.set('disable-rybbit', 'true');
    adapter = await import('../src/scripts/track.ts'); adapter.initAnalytics(); adapter.track('map_used');
    expect(fetch).not.toHaveBeenCalled();
  });
  it('drops stale startup events and rejects non-finite/unknown properties', async () => {
    vi.useFakeTimers();
    const { initAnalytics, track } = await import('../src/scripts/track.ts');
    track('map_used', { action: 'select_node' });
    vi.advanceTimersByTime(10_001); initAnalytics();
    expect(requests()).toHaveLength(1);
    track('progress_changed', { changed_count: NaN, email: 'hidden' });
    expect(JSON.parse(requests()[1].properties)).toEqual({ utm_source: 'linkedin' });
  });
  it('keeps first-touch labelled campaigns across navigation and contains blocked transport failures', async () => {
    const { initAnalytics, track } = await import('../src/scripts/track.ts'); initAnalytics();
    expect(session.get('pe-acquisition:v1')).toContain('linkedin');
    location.search = '';
    track('map_used', { action: 'filter_progress' });
    expect(JSON.parse(requests()[1].properties).utm_source).toBe('linkedin');
    vi.mocked(fetch).mockRejectedValue(new Error('blocked'));
    expect(() => track('map_used')).not.toThrow();
    await Promise.resolve();
    local.set('disable-rybbit', 'true');
    const count = requests().length; track('map_used'); expect(requests()).toHaveLength(count);
  });
});
