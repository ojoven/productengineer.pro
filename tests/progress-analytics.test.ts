import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { setStatus, replaceFromAccount } from '../src/scripts/progress.ts';
import { track } from '../src/scripts/track.ts';
vi.mock('../src/scripts/track.ts', () => ({ track: vi.fn() }));
beforeEach(() => {
  vi.clearAllMocks(); const data = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => data.set(k, v) });
  vi.stubGlobal('window', new EventTarget());
});
afterEach(() => vi.unstubAllGlobals());
it('counts real changes once per bulk action and excludes duplicates/no-ops/rehydration', () => {
  setStatus(['one', 'one', 'two'], 'learning', 'bulk');
  expect(track).toHaveBeenCalledExactlyOnceWith('progress_changed', { changed_count: 2, surface: 'bulk', mode: 'bulk', storage: 'local' });
  setStatus(['one', 'two'], 'learning', 'bulk');
  replaceFromAccount({ one: { status: 'comfortable', at: 10 } });
  expect(track).toHaveBeenCalledTimes(1);
});
it('does not claim saved progress if browser storage fails', () => {
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => { throw new Error('quota'); } });
  setStatus('one', 'learning'); expect(track).not.toHaveBeenCalled();
});
