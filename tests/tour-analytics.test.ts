import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { track } from '../src/scripts/track.ts';
import { TourAnalytics } from '../src/components/tour/tour-analytics.ts';
vi.mock('../src/scripts/track.ts', () => ({ track: vi.fn() }));
let data: Map<string, string>;
beforeEach(() => {
  vi.clearAllMocks(); data = new Map();
  vi.stubGlobal('sessionStorage', { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value) });
  vi.stubGlobal('document', { visibilityState: 'visible' });
});
afterEach(() => vi.unstubAllGlobals());
const events = (name: string) => vi.mocked(track).mock.calls.filter(([event]) => event === name);
describe('Tour attempt lifecycle', () => {
  it('starts inline, counts distinct coverage, and deduplicates the end until an explicit restart', () => {
    const tour = new TourAnalytics('test', 'v1', 3, () => 'inline');
    tour.view(1, 'first', 'discovery', 'next');
    tour.view(3, 'third', 'strategy', 'chapter');
    tour.view(4, '', '', 'next');
    tour.view(3, 'third', 'strategy', 'back'); tour.view(4, '', '', 'next');
    expect(events('tour_started')).toHaveLength(1);
    expect(events('tour_end_reached')).toHaveLength(1);
    expect(events('tour_end_reached')[0][1]).toMatchObject({ unique_steps_viewed: 2, total_steps: 3, layout: 'inline' });
    const first = events('tour_started')[0][1]!.attempt_id;
    tour.view(1, 'first', 'discovery', 'next', 'page', true);
    expect(events('tour_started')[1][1]).toMatchObject({ start_type: 'restart' });
    expect(events('tour_started')[1][1]!.attempt_id).not.toBe(first);
    tour.view(4, '', '', 'next'); tour.exit('close');
    const completed = events('tour_started')[1][1]!.attempt_id;
    tour.view(1, 'first', 'discovery', 'next');
    expect(events('tour_started')[2][1]).toMatchObject({ start_type: 'restart' });
    expect(events('tour_started')[2][1]!.attempt_id).not.toBe(completed);
  });
  it('preserves the attempt and coverage on a skill-page round trip, and captures exit before reset', () => {
    const tour = new TourAnalytics('test', 'v1', 3, () => 'fullscreen');
    tour.view(2, 'second', 'strategy', 'chapter', 'dock'); tour.exit('open_skill', 'second'); tour.exit('browser_back');
    expect(events('tour_exited')).toHaveLength(1);
    expect(events('tour_exited')[0][1]).toMatchObject({ step_index: 2, reason: 'open_skill' });
    const restored = new TourAnalytics('test', 'v1', 3, () => 'fullscreen');
    restored.view(2, 'second', 'strategy', 'restore', 'hash'); restored.view(4, '', '', 'next');
    expect(events('tour_started')[1][1]).toMatchObject({ start_type: 'restore', attempt_id: events('tour_started')[0][1]!.attempt_id });
    expect(events('tour_end_reached')[0][1]!.unique_steps_viewed).toBe(1);
  });
  it('does not fabricate hidden views or unload exits and keeps versions separate', () => {
    const tour = new TourAnalytics('test', 'v1', 3, () => 'inline');
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); tour.view(1, 'first', '', 'next'); expect(track).not.toHaveBeenCalled();
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true }); tour.view(1, 'first', '', 'next'); tour.suspend(); expect(events('tour_exited')).toHaveLength(0);
    new TourAnalytics('test', 'v2', 3, () => 'inline').view(1, 'first', '', 'next');
    expect(events('tour_started')[1][1]).toMatchObject({ start_type: 'new', tour_version: 'v2' });
  });
});
