import { track } from '../../scripts/track.ts';

export type Navigation = 'next' | 'back' | 'chapter' | 'map_tile' | 'keyboard' | 'swipe' | 'resume' | 'restore';
interface Attempt { id: string; seen: number[]; ended: boolean; updated: number; }

/** Attempt state is visit-scoped, survives a skill-page round trip, and expires after inactivity. */
export class TourAnalytics {
  private attempt?: Attempt;
  private active = false;
  private step = 0;
  get isActive() { return this.active; }
  private readonly key: string;
  constructor(private id: string, private version: string, private total: number, private layout: () => string) {
    this.key = `pe-tour-analytics:${id}:${version}`;
    try {
      const a = JSON.parse(sessionStorage.getItem(this.key) ?? 'null') as Attempt | null;
      if (a && typeof a.id === 'string' && Array.isArray(a.seen) && typeof a.ended === 'boolean'
        && Date.now() - a.updated < 30 * 60_000 && a.updated <= Date.now()) {
        this.attempt = { ...a, seen: a.seen.filter(n => Number.isInteger(n) && n > 0 && n <= total) };
      }
    } catch { /* blocked/corrupt visit storage */ }
  }
  private persist() {
    if (!this.attempt) return;
    this.attempt.updated = Date.now();
    try { sessionStorage.setItem(this.key, JSON.stringify(this.attempt)); } catch { /* page-local attempt */ }
  }
  private context() {
    return { tour_id: this.id, tour_version: this.version, attempt_id: this.attempt!.id, layout: this.layout(), total_steps: this.total };
  }
  view(step: number, skill: string, section: string, navigation: Navigation, entry = 'page', restart = false) {
    if (document.visibilityState === 'hidden' || step < 1) return;
    restart ||= !!this.attempt?.ended && !this.active;
    if (restart || (this.attempt && Date.now() - this.attempt.updated >= 30 * 60_000)) {
      this.attempt = undefined; this.active = false;
    }
    const continued = !!this.attempt?.seen.length;
    this.attempt ??= { id: crypto.randomUUID(), seen: [], ended: false, updated: Date.now() };
    const isStop = step <= this.total;
    if (!this.active && isStop) {
      this.active = true;
      track('tour_started', { ...this.context(), start_type: restart ? 'restart' : navigation === 'restore' ? 'restore' : continued ? 'resume' : 'new', entry_point: entry, start_step: step });
    }
    if (isStop) {
      if (!this.attempt.seen.includes(step)) this.attempt.seen.push(step);
      track('tour_step_viewed', { ...this.context(), step_index: step, skill_id: skill, section_id: section, navigation });
    } else if (!this.attempt.ended && this.active) {
      this.attempt.ended = true;
      track('tour_end_reached', { ...this.context(), unique_steps_viewed: this.attempt.seen.length, final_step_index: step });
    }
    this.step = step;
    this.persist();
  }
  exit(reason: string, destination = '') {
    if (!this.active || !this.attempt) return;
    track('tour_exited', { ...this.context(), reason, step_index: this.step, unique_steps_viewed: this.attempt.seen.length, destination_id: destination });
    this.active = false;
    this.persist();
  }
  suspend() { this.active = false; this.persist(); }
}
