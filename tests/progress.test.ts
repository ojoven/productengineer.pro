import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cycleStatus, load, replaceFromAccount, setStatus } from '../src/scripts/progress.ts';

let storage: Map<string, string>;
beforeEach(() => {
  storage = new Map();
  vi.stubGlobal('localStorage', { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) });
  vi.stubGlobal('window', new EventTarget());
});
afterEach(() => vi.unstubAllGlobals());

describe('not interested progress', () => {
  it('keeps existing version 1 statuses and opted-out skills when loading and resolving aliases', () => {
    storage.set('pe-atlas:v1', JSON.stringify({ version: 1, progress: { first: 'learning', second: 'comfortable', old: 'not-interested', invalid: 'expert' }, at: { old: 42 } }));
    expect(load({ old: 'current' })).toMatchObject({ progress: { first: 'learning', second: 'comfortable', current: 'not-interested' }, at: { current: 42 } });
    expect(load().progress.invalid).toBeUndefined();
  });

  it('allows opting out, cycling back and choosing to learn again', () => {
    setStatus('sample-size', 'not-interested');
    expect(load().progress['sample-size']).toBe('not-interested');
    expect(cycleStatus('sample-size')).toBe('none');
    expect(load().progress['sample-size']).toBeUndefined();
    setStatus('sample-size', 'learning');
    expect(load().progress['sample-size']).toBe('learning');
  });

  it('keeps opt-outs from the account and preserves pending choices during account sync', () => {
    replaceFromAccount({ 'sample-size': { status: 'not-interested', at: 10 } });
    expect(load().progress['sample-size']).toBe('not-interested');
    replaceFromAccount({ 'sample-size': { status: 'not-interested', at: 10 } }, [{ id: 'sample-size', status: 'learning', at: 20 }]);
    expect(load().progress['sample-size']).toBe('learning');
  });
});
