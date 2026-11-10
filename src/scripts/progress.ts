// Casual progress, kept in this browser only. One status per skill. Nothing is sent anywhere.
import type { Status } from '../atlas/render.ts';

const KEY = 'pe-atlas:v1';
export const STATUSES: (Status | 'none')[] = ['none', 'learning', 'comfortable'];

export interface Saved {
  version: 1;
  name?: string;
  progress: Record<string, Status>;
  updated?: string;
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
    for (const [id, st] of Object.entries(parsed.progress)) {
      if (st === 'learning' || st === 'comfortable') progress[aliases[id] ?? id] = st;
    }
    return { version: 1, name: typeof parsed.name === 'string' ? parsed.name : undefined, progress, updated: parsed.updated };
  } catch {
    return empty();
  }
}

function save(data: Saved) {
  data.updated = new Date().toISOString();
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // storage blocked (private mode, disabled site data): progress lasts for this page only
  }
  window.dispatchEvent(new CustomEvent('pe:progress'));
}

export function setStatus(ids: string | string[], status: Status | 'none') {
  const data = load();
  for (const id of Array.isArray(ids) ? ids : [ids]) {
    if (status === 'none') delete data.progress[id];
    else data.progress[id] = status;
  }
  save(data);
}

export function setName(name: string) {
  const data = load();
  data.name = name.trim().slice(0, 60) || undefined;
  save(data);
}

export function reset() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent('pe:progress'));
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
  let imported = 0;
  let skipped = 0;
  for (const [id, st] of Object.entries(parsed.progress as Record<string, unknown>)) {
    if ((st === 'learning' || st === 'comfortable') && known.has(id)) {
      data.progress[id] = st;
      imported++;
    } else skipped++;
  }
  if (typeof parsed.name === 'string' && !data.name) data.name = parsed.name.slice(0, 60);
  save(data);
  return { imported, skipped };
}

export function onChange(fn: () => void) {
  window.addEventListener('pe:progress', fn);
  window.addEventListener('storage', (e) => {
    if (e.key === KEY || e.key === null) fn();
  });
}

/**
 * Applies progress to whatever is on the page: map nodes, list items, roll-ups and status
 * controls. Static pages ship without progress; this fills it in.
 */
export function applyProgress(root: ParentNode = document) {
  const { progress } = load();
  const st = (id: string) => progress[id] ?? 'none';

  root.querySelectorAll<SVGElement>('.pm .n-s[data-id]').forEach((el) => {
    el.classList.remove('st-learning', 'st-comfortable');
    const s = progress[el.dataset.id!];
    if (s) el.classList.add(`st-${s}`);
  });

  root.querySelectorAll<SVGElement>('.pm .n-c[data-skills]').forEach((el) => {
    const ids = el.dataset.skills!.split(' ');
    const comf = ids.filter((i) => progress[i] === 'comfortable').length;
    const learn = ids.filter((i) => progress[i] === 'learning').length;
    el.querySelector('.roll')?.setAttribute('stroke-dasharray', `${(comf / ids.length) * 100} 100`);
    el.querySelector('.roll-l')?.setAttribute('stroke-dasharray', `${((comf + learn) / ids.length) * 100} 100`);
  });

  root.querySelectorAll<HTMLElement>('[data-status-for]').forEach((el) => {
    el.dataset.status = st(el.dataset.statusFor!);
  });

  root.querySelectorAll<HTMLElement>('[data-rollup]').forEach((el) => {
    const ids = el.dataset.rollup!.split(' ').filter(Boolean);
    const comf = ids.filter((i) => progress[i] === 'comfortable').length;
    const learn = ids.filter((i) => progress[i] === 'learning').length;
    const n = ids.length;
    const bar = el.querySelector('.bar');
    if (bar) bar.innerHTML = `<i class="c" style="width:${(comf / n) * 100}%"></i><i class="l" style="width:${(learn / n) * 100}%"></i>`;
    const text = el.querySelector('.txt');
    if (text) text.textContent = comf || learn ? `${comf}/${n} comfortable${learn ? `, ${learn} learning` : ''}` : `${n} skills`;
  });

  root.querySelectorAll<HTMLInputElement>('input[data-status-input]').forEach((input) => {
    input.checked = st(input.dataset.statusInput!) === input.value;
  });
}
