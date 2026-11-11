// Casual progress, one status per skill, kept in this browser. Without an account nothing is
// sent anywhere. With one, sync.ts copies each change to the account and pulls the account's
// state back in; the pages always read from here.
import { isStatus, STATUS_OPTIONS, STATUSES, type Status } from '../atlas/status.ts';
export { STATUSES } from '../atlas/status.ts';

const KEY = 'pe-atlas:v1';

export interface Saved {
  version: 1;
  name?: string;
  progress: Record<string, Status>;
  /** When each status last changed, in ms. Merging with the account keeps the newest change. */
  at?: Record<string, number>;
  updated?: string;
}

export interface Change {
  id: string;
  status: Status | 'none';
  at: number;
}

const empty = (): Saved => ({ version: 1, progress: {} });

export function load(aliases: Record<string, string> = {}): Saved {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const parsed = JSON.parse(raw) as Saved;
    if (!parsed || typeof parsed !== 'object' || typeof parsed.progress !== 'object') return empty();
    // a renamed skill keeps its old id as an alias, so saved progress follows it
    const progress: Record<string, Status> = {};
    const at: Record<string, number> = {};
    const savedAt = parsed.at && typeof parsed.at === 'object' ? parsed.at : {};
    for (const [id, st] of Object.entries(parsed.progress)) {
      if (!isStatus(st)) continue;
      const key = aliases[id] ?? id;
      progress[key] = st;
      if (typeof savedAt[id] === 'number') at[key] = savedAt[id];
    }
    return { version: 1, name: typeof parsed.name === 'string' ? parsed.name : undefined, progress, at, updated: parsed.updated };
  } catch {
    return empty();
  }
}

function save(data: Saved, changes: Change[] = []) {
  data.updated = new Date().toISOString();
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // storage blocked (private mode, disabled site data): progress lasts for this page only
  }
  window.dispatchEvent(new CustomEvent('pe:progress'));
  if (changes.length) window.dispatchEvent(new CustomEvent<Change[]>('pe:local-change', { detail: changes }));
}

function apply(data: Saved, id: string, status: Status | 'none', at: number) {
  data.at ??= {};
  if (status === 'none') {
    delete data.progress[id];
    delete data.at[id];
  } else {
    data.progress[id] = status;
    data.at[id] = at;
  }
}

export function setStatus(ids: string | string[], status: Status | 'none') {
  const data = load();
  const at = Date.now();
  const changes: Change[] = [];
  for (const id of Array.isArray(ids) ? ids : [ids]) {
    if ((data.progress[id] ?? 'none') === status) continue;
    apply(data, id, status, at);
    changes.push({ id, status, at });
  }
  save(data, changes);
}

/** The account's state, plus changes not yet sent, written over this browser's copy. */
export function replaceFromAccount(progress: Record<string, { status: Status; at: number }>, pending: Change[] = []) {
  const data = load();
  data.progress = {};
  data.at = {};
  for (const [id, v] of Object.entries(progress)) apply(data, id, v.status, v.at);
  for (const c of pending) apply(data, c.id, c.status, c.at);
  save(data);
}

export function setName(name: string) {
  const data = load();
  data.name = name.trim().slice(0, 60) || undefined;
  save(data);
}

/**
 * Erases every status in this browser. When signed in, the cleared skills are sent as changes
 * too, so the account is erased as well. `forget` only drops this browser's copy (signing out).
 */
export function reset(opts: { forget?: boolean } = {}) {
  const before = load();
  const at = Date.now();
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent('pe:progress'));
  const changes: Change[] = Object.keys(before.progress).map((id) => ({ id, status: 'none', at }));
  if (!opts.forget && changes.length) window.dispatchEvent(new CustomEvent<Change[]>('pe:local-change', { detail: changes }));
}

export function exportFile() {
  const data = load();
  const blob = new Blob([JSON.stringify({ ...data, exported: new Date().toISOString(), site: 'productengineer.pro' }, null, 2)], {
    type: 'application/json',
  });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `productengineer-progress-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export async function importFile(file: File, known: Set<string>): Promise<{ imported: number; skipped: number }> {
  const parsed = JSON.parse(await file.text());
  if (!parsed || typeof parsed.progress !== 'object') throw new Error('This file does not look like a progress export.');
  const data = load();
  const at = Date.now();
  const changes: Change[] = [];
  let skipped = 0;
  for (const [id, st] of Object.entries(parsed.progress as Record<string, unknown>)) {
    if (isStatus(st) && known.has(id)) {
      apply(data, id, st, at);
      changes.push({ id, status: st, at });
    } else skipped++;
  }
  const imported = changes.length;
  if (typeof parsed.name === 'string' && !data.name) data.name = parsed.name.slice(0, 60);
  save(data, changes);
  return { imported, skipped };
}

export function onChange(fn: () => void) {
  window.addEventListener('pe:progress', fn);
  window.addEventListener('storage', (e) => {
    if (e.key === KEY || e.key === null) fn();
  });
}

/** Cycles all four statuses. Each choice can also be set explicitly on a skill page. */
export function cycleStatus(id: string): Status | 'none' {
  const current = (load().progress[id] as Status | undefined) ?? 'none';
  const next = STATUSES[(STATUSES.indexOf(current) + 1) % STATUSES.length];
  setStatus(id, next);
  return next;
}

const LABEL = Object.fromEntries(STATUS_OPTIONS.map((option) => [option.value, option.label.toLowerCase()]));

/**
 * Applies progress to whatever is on the page: map tiles, list rows, tile strips, counts and
 * status controls. Static pages ship without progress; this fills it in.
 */
export function applyProgress(root: ParentNode = document) {
  const { progress } = load();
  const st = (id: string) => progress[id] ?? 'none';

  root.querySelectorAll<SVGElement>('.pm [data-skill]').forEach((el) => {
    const s = progress[el.dataset.skill!];
    el.classList.toggle('st-learning', s === 'learning');
    el.classList.toggle('st-comfortable', s === 'comfortable');
    el.classList.toggle('st-not-interested', s === 'not-interested');
  });

  root.querySelectorAll<HTMLElement>('[data-status-for]').forEach((el) => {
    el.dataset.status = st(el.dataset.statusFor!);
  });

  root.querySelectorAll<HTMLButtonElement>('button[data-cycle]').forEach((b) => {
    const s = st(b.dataset.cycle!);
    b.setAttribute('aria-label', `${b.dataset.name ?? 'Status'}: ${LABEL[s]}. Change status`);
    b.title = `Status: ${LABEL[s]} (click to change)`;
  });

  root.querySelectorAll<HTMLElement>('[data-rollup]').forEach((el) => {
    const ids = el.dataset.rollup!.split(' ').filter(Boolean);
    const comf = ids.filter((i) => progress[i] === 'comfortable').length;
    const learn = ids.filter((i) => progress[i] === 'learning').length;
    const uninterested = ids.filter((i) => progress[i] === 'not-interested').length;
    el.textContent = comf || learn || uninterested
      ? `${comf}/${ids.length} comfortable${learn ? ` · ${learn} learning` : ''}${uninterested ? ` · ${uninterested} not interested` : ''}`
      : `${ids.length} skill${ids.length === 1 ? '' : 's'}`;
  });

  root.querySelectorAll<HTMLInputElement>('input[data-status-input]').forEach((input) => {
    input.checked = st(input.dataset.statusInput!) === input.value;
  });
}
