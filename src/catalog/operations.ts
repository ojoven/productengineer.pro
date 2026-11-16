import { canonicalUrl, favicon, hostOf, searchCatalog, type CatalogEntry, type CatalogFilters } from '../../server/src/catalog-model.ts';
import type { DiscoveryResult, DiscoverySource } from '../../server/src/catalog-discovery.ts';
import { api, button, el, formatLabel, icon, link } from './dom.ts';

type Found = DiscoveryResult & { existing: string | null; existingStatus: string | null };
interface Session {
  sources: { id: DiscoverySource; name: string; enabled: boolean; detail: string }[];
  territories: { id: string; name: string }[];
  skills: { id: string; name: string; path: string; territory: string }[];
  dailyBudget: number; spentToday: number;
}
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
let session: Session;
let entries: CatalogEntry[] = [];
let found: Found[] = [];
let source: DiscoverySource = 'web';
let searchRunning = false;
let batchRunning = false;
let entryPage = 1;
let detail: CatalogEntry | undefined;
const selectedFound = new Set<string>();
const selectedEntries = new Set<string>();
const detailForm = $<HTMLFormElement>('ops-detail-form');
const entryFilters = $<HTMLFormElement>('ops-entry-filters');
const dialog = $<HTMLDialogElement>('ops-detail');
const field = (name: string) => detailForm.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
const entryPath = (id: string) => `/api/operations/entries/${encodeURIComponent(id)}`;

function message(text: string, error = false, inDetail = false) {
  const node = $(inDetail ? 'ops-detail-message' : 'ops-message'); node.textContent = text; node.hidden = !text; node.dataset.error = String(error);
}
async function action(b: HTMLButtonElement | null, fn: () => Promise<void>, inDetail = false) {
  if (b?.disabled) return; if (b) b.disabled = true;
  try { message('', false, inDetail); await fn(); } catch (err) { message((err as Error).message, true, inDetail); }
  finally { if (b) b.disabled = false; }
}
function progress(text: string) { $('ops-progress').hidden = !text; $('ops-progress').textContent = text; }
function setEntry(e: CatalogEntry) {
  const index = entries.findIndex(x => x.id === e.id); if (index < 0) entries.unshift(e); else entries[index] = e;
  if (detail?.id === e.id) detail = e;
  for (const f of found) if (canonicalUrl(f.url) === canonicalUrl(e.url)) { f.existing = e.id; f.existingStatus = e.status; }
  stats(); renderEntries(); renderFound();
}
function stats() {
  for (const s of ['pending', 'validated', 'invalidated']) $(`stat-${s}`).textContent = String(entries.filter(e => e.status === s).length);
  $('stat-issues').textContent = String(entries.filter(e => e.fetchError || e.httpStatus && e.httpStatus >= 400).length);
  $('ops-budget').textContent = `$${session.spentToday.toFixed(4)} / $${session.dailyBudget.toFixed(2)} spent or reserved today`;
}
function switchMode(next: string) {
  message(''); selectedEntries.clear();
  for (const tab of document.querySelectorAll<HTMLButtonElement>('[data-mode]')) { tab.setAttribute('aria-selected', String(tab.dataset.mode === next)); tab.tabIndex = tab.dataset.mode === next ? 0 : -1; }
  for (const panel of ['discover', 'review', 'catalog', 'history']) $(`panel-${panel}`).hidden = next !== panel;
  const workspace = $('ops-entries-workspace'); workspace.hidden = !['review', 'catalog'].includes(next);
  if (next === 'review' || next === 'catalog') {
    $(`ops-${next}-slot`).append(workspace);
    (entryFilters.elements.namedItem('status') as HTMLSelectElement).value = next === 'review' ? 'pending' : '';
    $('ops-entries-title').textContent = next === 'review' ? 'Review the evidence.' : 'Keep the collection useful.';
    entryPage = 1; renderEntries();
  }
  if (next === 'history') void loadHistory().catch(err => message(err.message, true));
  const u = new URL(location.href); u.searchParams.set('view', next); history.replaceState({}, '', u);
}
function chooseSource(id: DiscoverySource) {
  source = id;
  for (const b of document.querySelectorAll<HTMLButtonElement>('[data-source]')) b.setAttribute('aria-pressed', String(b.dataset.source === id));
  const current = session.sources.find(s => s.id === id)!;
  $('ops-source-help').textContent = `${current.detail}. ${['web', 'youtube', 'x'].includes(id) ? 'Maximum $0.02 per search; recent repeats use the saved result.' : 'No API key needed. Provider rate limits apply.'}`;
  $('ops-discover-submit').textContent = `Search ${id === 'web' ? 'the web' : current.name} ↗`;
}
function renderFound() {
  $('ops-discovery-toolbar').hidden = found.length === 0;
  $('ops-discovery-empty').hidden = found.length > 0;
  $('ops-discovery-count').textContent = `${found.length} results · ${selectedFound.size} selected`;
  $<HTMLButtonElement>('ops-retrieve-selected').disabled = selectedFound.size === 0 || batchRunning;
  const available = found.filter(f => !f.existing);
  const all = $<HTMLInputElement>('ops-select-discovery'); all.checked = available.length > 0 && available.every(f => selectedFound.has(f.url)); all.indeterminate = selectedFound.size > 0 && !all.checked;
  $('ops-discovery-results').replaceChildren(...found.map(f => {
    const row = el('li', 'ops-row'); const checkbox = el('input'); checkbox.type = 'checkbox'; checkbox.checked = selectedFound.has(f.url); checkbox.disabled = Boolean(f.existing) || batchRunning; checkbox.setAttribute('aria-label', `Select ${f.title}`);
    checkbox.addEventListener('change', () => { if (checkbox.checked) selectedFound.add(f.url); else selectedFound.delete(f.url); renderFound(); });
    const main = el('div'); const meta = el('div', 'catalog-card-meta'); meta.append(el('span', 'catalog-kind', formatLabel(f.type)), el('span', '', hostOf(f.url)), el('span', '', f.author));
    const h = el('h3'); h.append(link(f.title + ' ↗', f.url)); main.append(meta, h, el('p', '', f.description || 'Retrieve the page to inspect its metadata and relevance.'));
    if (f.sourceUrl && f.sourceUrl !== f.url) main.append(link('Source discussion ↗', f.sourceUrl, 'text-button'));
    const actions = el('div', 'ops-row-actions');
    if (f.existing) {
      const status = el('span', 'ops-status', f.existingStatus ?? 'In catalog'); status.dataset.status = f.existingStatus ?? ''; actions.append(status, button('Review →', 'btn small', () => void openDetail(f.existing!)));
    } else {
      const b = button('Retrieve ↓', 'btn small', () => void action(b, async () => { const entry = await retrieveFound(f); await openDetail(entry.id); })); actions.append(b);
    }
    row.append(checkbox, icon(favicon(f.url), favicon(f.url)), main, actions); return row;
  }));
}
async function discover() {
  if (searchRunning) return;
  const q = $<HTMLInputElement>('ops-discover-q').value.trim(); if (q.length < 2) return;
  searchRunning = true; const b = $<HTMLButtonElement>('ops-discover-submit'); b.disabled = true;
  for (const btn of document.querySelectorAll<HTMLButtonElement>('[data-source]')) btn.disabled = true;
  progress(`Searching ${session.sources.find(s => s.id === source)!.name}…`); message('');
  try {
    const result = await api<{ results: Found[]; costUsd: number; provider: string; cached: boolean; warning: string }>('/api/operations/discover', { source, q });
    found = result.results; selectedFound.clear(); renderFound(); session.spentToday += result.costUsd; stats();
    message(`${result.results.length} results · ${result.cached ? 'saved search · no new charge' : `${result.provider} · $${result.costUsd.toFixed(5)}`}${result.warning ? '\n' + result.warning : ''}`);
    if (!found.length) $('ops-discovery-empty').textContent = 'No results from this source. Try a different phrase or another source.';
  } catch (err) { message((err as Error).message, true); }
  finally {
    searchRunning = false; b.disabled = false; progress('');
    try { session.spentToday = (await api<Session>('/api/operations/session')).spentToday; stats(); } catch { /* preserve search result */ }
    for (const btn of document.querySelectorAll<HTMLButtonElement>('[data-source]')) btn.disabled = !session.sources.find(s => s.id === btn.dataset.source)!.enabled;
  }
}
async function retrieveFound(f: Found) {
  const choice = $<HTMLSelectElement>('ops-retrieve-kind').value;
  const r = await api<{ entry: CatalogEntry; duplicate: boolean }>('/api/operations/retrieve', { ...f, kind: choice === 'auto' ? f.kind : choice, type: f.type === 'tool' ? 'article' : f.type });
  setEntry(r.entry); selectedFound.delete(f.url); renderFound(); return r.entry;
}
function currentFilters(): CatalogFilters {
  return Object.fromEntries(new FormData(entryFilters).entries()) as CatalogFilters;
}
function renderEntries() {
  const matched = searchCatalog(entries, currentFilters()); const size = 25; const pages = Math.max(1, Math.ceil(matched.length / size)); entryPage = Math.min(entryPage, pages);
  const visible = matched.slice((entryPage - 1) * size, entryPage * size);
  $('ops-entry-count').textContent = `${matched.length} entries · ${selectedEntries.size} selected`;
  $('ops-entries-empty').hidden = matched.length > 0;
  $<HTMLButtonElement>('ops-check-selected').disabled = selectedEntries.size === 0 || batchRunning;
  const all = $<HTMLInputElement>('ops-select-entries'); all.checked = visible.length > 0 && visible.every(e => selectedEntries.has(e.id)); all.indeterminate = selectedEntries.size > 0 && !all.checked;
  $('ops-entries').replaceChildren(...visible.map(e => {
    const row = el('li', 'ops-row'); const check = el('input'); check.type = 'checkbox'; check.checked = selectedEntries.has(e.id); check.setAttribute('aria-label', `Select ${e.title}`); check.disabled = batchRunning;
    check.addEventListener('change', () => { if (check.checked) selectedEntries.add(e.id); else selectedEntries.delete(e.id); renderEntries(); });
    const main = el('div'); const meta = el('div', 'catalog-card-meta'); meta.append(el('span', 'catalog-kind', formatLabel(e.type)), el('span', '', hostOf(e.url)), el('span', '', e.source));
    const h = el('h3'); h.append(button(e.title, 'text-button', () => void openDetail(e.id))); main.append(meta, h, el('p', '', e.description || 'Description needed before validation.'));
    const health = e.fetchError ? `⚠ ${e.fetchError}` : e.httpStatus ? `HTTP ${e.httpStatus} · retrieved ${e.fetchedAt.slice(0, 10)}` : e.checked ? `Editorially checked ${e.checked} · HTTP check not recorded` : 'Not checked yet';
    main.append(el('span', e.fetchError ? 'ops-link-error catalog-card-meta' : 'catalog-card-meta', health));
    const actions = el('div', 'ops-row-actions'); const status = el('span', 'ops-status', e.status); status.dataset.status = e.status;
    actions.append(status, button('Review →', 'btn small', () => void openDetail(e.id))); row.append(check, icon(e.icon, favicon(e.url)), main, actions); return row;
  }));
  const pager = $('ops-entry-pagination'); pager.replaceChildren();
  if (matched.length > size) {
    const prev = button('← Previous', 'btn small', () => { entryPage--; selectedEntries.clear(); renderEntries(); }); prev.disabled = entryPage === 1;
    const next = button('Next →', 'btn small', () => { entryPage++; selectedEntries.clear(); renderEntries(); }); next.disabled = entryPage === pages;
    pager.append(prev, el('span', 'label', `Page ${entryPage} of ${pages}`), next);
  }
}
async function reloadEntries() { entries = (await api<{ entries: CatalogEntry[] }>('/api/operations/entries')).entries; stats(); renderEntries(); }
async function openDetail(id: string) {
  detail = entries.find(e => e.id === id); if (!detail) { await reloadEntries(); detail = entries.find(e => e.id === id); } if (!detail) return;
  const e = detail; message('', false, true);
  $('ops-detail-title').textContent = e.kind === 'tool' ? 'Review tool' : 'Review resource';
  const url = $<HTMLAnchorElement>('ops-detail-url'); url.href = e.url; url.textContent = e.url + ' ↗';
  for (const name of ['title', 'description', 'author', 'kind', 'type', 'pricing', 'level', 'note']) field(name).value = e[name as keyof CatalogEntry] as string;
  $<HTMLInputElement>('ops-skill-search').value = '';
  (field('manualVerified') as HTMLInputElement).checked = false;
  for (const checkbox of document.querySelectorAll<HTMLInputElement>('#ops-detail-territories input')) checkbox.checked = e.territories.includes(checkbox.value);
  for (const option of $<HTMLSelectElement>('ops-detail-skills').options) { option.selected = e.skills.some(s => s.id === option.value); option.hidden = false; }
  renderDetailHealth(); if (!dialog.open) dialog.showModal(); await detailHistory(e.id);
}
function renderDetailHealth() {
  if (!detail) return;
  $('ops-detail-status').textContent = detail.status; $('ops-detail-status').dataset.status = detail.status;
  $('ops-detail-evidence').textContent = detail.evidence ? [detail.evidence.title, detail.evidence.author, detail.evidence.description, detail.evidence.excerpt].filter(Boolean).join('\n\n') : 'Check the source to capture its metadata and available text excerpt.';
  $('ops-detail-health').textContent = detail.fetchError ? `Retrieval issue: ${detail.fetchError}` : detail.httpStatus ? `HTTP ${detail.httpStatus} · retrieved ${detail.fetchedAt.slice(0, 16).replace('T', ' ')}. Check the content and relevance before validating.` : 'No source retrieval recorded. Check the source or confirm your manual verification.';
}
async function detailHistory(id: string) {
  try {
    const result = await api<{ events: { action: string; note: string; at: string }[] }>(`${entryPath(id)}/history`);
    if (detail?.id !== id) return;
    $('ops-detail-history').replaceChildren(...result.events.map(e => { const li = el('li', '', `${formatLabel(e.action.replaceAll('-', ' '))}${e.note ? ' · ' + e.note : ''}`); li.append(el('span', '', e.at.slice(0, 16).replace('T', ' '))); return li; }));
    if (!result.events.length) $('ops-detail-history').replaceChildren(el('li', '', 'Imported from the checked atlas. New review actions will appear here.'));
  } catch { $('ops-detail-history').textContent = 'Review history is temporarily unavailable.'; }
}
function draft() {
  const values = Object.fromEntries(['title', 'description', 'author', 'kind', 'type', 'pricing', 'level', 'note'].map(n => [n, field(n).value.trim()]));
  const territories = [...document.querySelectorAll<HTMLInputElement>('#ops-detail-territories input:checked')].map(i => i.value);
  const skillIds = [...$<HTMLSelectElement>('ops-detail-skills').selectedOptions].map(o => o.value);
  return { ...values, territories, skillIds, version: detail!.version };
}
async function saveDraft(force = false) {
  if (!detailForm.reportValidity()) throw new Error('Fill in the title and description first.');
  const body = draft();
  const changed = ['title', 'description', 'author', 'kind', 'type', 'pricing', 'level'].some(n => field(n).value.trim() !== detail![n as keyof CatalogEntry]) ||
    JSON.stringify([...body.territories].sort()) !== JSON.stringify([...detail!.territories].sort()) || JSON.stringify([...body.skillIds].sort()) !== JSON.stringify(detail!.skills.map(s => s.id).sort());
  if (changed || force) { const r = await api<{ entry: CatalogEntry }>(entryPath(detail!.id), body, 'PATCH'); setEntry(r.entry); renderDetailHealth(); await detailHistory(r.entry.id); }
}
async function review(status: string) {
  if (!detail) return;
  if (status === 'validated') await saveDraft();
  const r = await api<{ entry: CatalogEntry }>(`${entryPath(detail.id)}/review`, { version: detail.version, status, note: field('note').value.trim(), manualVerified: (field('manualVerified') as HTMLInputElement).checked });
  setEntry(r.entry); renderDetailHealth(); await detailHistory(r.entry.id);
  message(status === 'validated' ? 'Validated. This entry is now in the public library.' : status === 'invalidated' ? 'Invalidated. This entry is excluded from the public library.' : 'Returned to the review queue.', false, true);
}
async function loadHistory() {
  const { runs } = await api<{ runs: { id: number; source: DiscoverySource; query: string; costUsd: number; at: string; estimated: number; state: string }[] }>('/api/operations/history');
  $('ops-history').replaceChildren(...runs.map(run => {
    const row = el('div', 'ops-history-row'); row.append(el('span', 'mono', run.at.slice(0, 10)), el('span', 'catalog-kind', run.source), el('span', '', `${run.query}${run.state === 'failed' ? ' · failed' : run.state === 'running' ? ' · in progress' : ''}`), el('span', 'mono', `$${run.costUsd.toFixed(5)}${run.estimated ? ' held' : ''}`), button('Search again ↗', 'btn small', () => { switchMode('discover'); chooseSource(run.source); $<HTMLInputElement>('ops-discover-q').value = run.query; void discover(); })); return row;
  }));
  if (!runs.length) $('ops-history').replaceChildren(el('p', 'ops-empty', 'Your first discovery search will appear here.'));
}

async function start() {
  try {
    session = await api<Session>('/api/operations/session');
    await reloadEntries(); $('ops-gate').hidden = true; $('ops-workspace').hidden = false;
    $('ops-setup').hidden = session.sources.every(s => s.enabled);
    $('ops-sources').replaceChildren(...session.sources.map(s => { const b = button(s.name, 'ops-source', () => chooseSource(s.id)); b.dataset.source = s.id; b.disabled = !s.enabled; b.title = s.enabled ? s.detail : 'Connect Treg on the server to enable this source.'; b.setAttribute('aria-pressed', 'false'); return b; }));
    chooseSource(session.sources.find(s => s.enabled)!.id);
    for (const t of session.territories) {
      const option = el('option', '', t.name); option.value = t.id; $('ops-filter-territory').append(option);
      const label = el('label'); const check = el('input'); check.type = 'checkbox'; check.value = t.id; label.append(check, document.createTextNode(t.name)); $('ops-detail-territories').append(label);
    }
    for (const s of session.skills) { const o = el('option', '', s.name); o.value = s.id; $('ops-detail-skills').append(o); }
    const requested = new URL(location.href).searchParams.get('view'); switchMode(requested && ['discover', 'review', 'catalog', 'history'].includes(requested) ? requested : 'discover');
  } catch (err) {
    const e = err as Error & { status?: number };
    $('ops-gate-title').textContent = e.status === 401 ? 'Sign in to manage the library.' : e.status === 403 ? 'Operations access is required.' : 'The operations API is unavailable.';
    $('ops-gate-text').textContent = e.status === 403 ? 'This panel is restricted to the catalog team. An administrator can allow your account using OPS_ADMIN_IDS or your verified email with OPS_ADMIN_EMAILS on the API server.' : e.status === 401 ? 'Use your ProductEngineer.pro account. Catalog changes are restricted to the operations team.' : e.message;
    if (e.status === 401) {
      try {
        const { providers } = await api<{ providers: { id: string; label: string }[] }>('/api/auth/providers');
        for (const p of providers) { const a = el('a', 'btn', `Sign in with ${p.label}`); a.href = `/api/auth/${p.id}/start?return=${encodeURIComponent('/operations/')}`; $('ops-signin').append(a); }
      } catch { /* main gate already explains API failure */ }
    }
  }
}
for (const tab of document.querySelectorAll<HTMLButtonElement>('[data-mode]')) {
  tab.addEventListener('click', () => switchMode(tab.dataset.mode!));
  tab.addEventListener('keydown', e => { if (!['ArrowRight', 'ArrowLeft'].includes(e.key)) return; e.preventDefault(); const tabs = [...document.querySelectorAll<HTMLButtonElement>('[data-mode]')]; const i = (tabs.indexOf(tab) + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length; tabs[i].focus(); switchMode(tabs[i].dataset.mode!); });
}
for (const stat of document.querySelectorAll<HTMLButtonElement>('[data-stat]')) stat.addEventListener('click', () => { switchMode('catalog'); entryFilters.reset(); (entryFilters.elements.namedItem(stat.dataset.stat === 'issues' ? 'health' : 'status') as HTMLSelectElement).value = stat.dataset.stat!; entryPage = 1; renderEntries(); });
$('ops-discover-form').addEventListener('submit', e => { e.preventDefault(); void discover(); });
$('ops-manual-form').addEventListener('submit', e => {
  e.preventDefault(); const f = e.currentTarget as HTMLFormElement; const b = f.querySelector<HTMLButtonElement>('button')!;
  void action(b, async () => { const r = await api<{ entry: CatalogEntry; duplicate: boolean }>('/api/operations/retrieve', Object.fromEntries(new FormData(f).entries())); setEntry(r.entry); message(r.duplicate ? 'This URL is already in the catalog. Opening its existing record.' : 'Retrieved into the pending queue.'); await openDetail(r.entry.id); });
});
$('ops-select-discovery').addEventListener('change', e => { for (const f of found.filter(f => !f.existing)) if ((e.target as HTMLInputElement).checked) selectedFound.add(f.url); else selectedFound.delete(f.url); renderFound(); });
$('ops-retrieve-selected').addEventListener('click', () => {
  if (batchRunning) return; batchRunning = true; renderFound();
  void (async () => { const items = found.filter(f => selectedFound.has(f.url)); let ok = 0; const errors: string[] = [];
    for (const [i, f] of items.entries()) { progress(`Retrieving ${i + 1} of ${items.length}: ${f.title}`); try { await retrieveFound(f); ok++; } catch (err) { errors.push(`${f.title}: ${(err as Error).message}`); } }
    message(`${ok} of ${items.length} retrieved into the review queue.${errors.length ? '\n' + errors.join('\n') : ''}`, Boolean(errors.length));
  })().finally(() => { batchRunning = false; progress(''); renderFound(); });
});
entryFilters.addEventListener('input', () => { selectedEntries.clear(); entryPage = 1; renderEntries(); });
entryFilters.addEventListener('submit', e => e.preventDefault());
$('ops-select-entries').addEventListener('change', e => { const visible = searchCatalog(entries, currentFilters()).slice((entryPage - 1) * 25, entryPage * 25); for (const entry of visible) if ((e.target as HTMLInputElement).checked) selectedEntries.add(entry.id); else selectedEntries.delete(entry.id); renderEntries(); });
$('ops-check-selected').addEventListener('click', () => {
  if (batchRunning) return; batchRunning = true; renderEntries();
  void (async () => { const ids = [...selectedEntries]; let ok = 0; let issues = 0; const errors: string[] = [];
    for (const [i, id] of ids.entries()) { const entry = entries.find(e => e.id === id)!; progress(`Checking ${i + 1} of ${ids.length}: ${entry.title}`);
      try { const r = await api<{ entry: CatalogEntry }>(`${entryPath(id)}/retrieve`, { version: entry.version }); setEntry(r.entry); if (r.entry.fetchError) issues++; else ok++; } catch (err) { errors.push((err as Error).message); }
    } message(`${ok} healthy, ${issues} with issues, ${errors.length} failed. Editorial review status is unchanged.${errors.length ? '\n' + errors.join('\n') : ''}`, Boolean(errors.length));
  })().finally(() => { batchRunning = false; progress(''); selectedEntries.clear(); renderEntries(); });
});
$('ops-refresh').addEventListener('click', () => void action($<HTMLButtonElement>('ops-refresh'), async () => { await reloadEntries(); message('Catalog refreshed.'); }));
$('ops-export').addEventListener('click', () => { const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), entries: searchCatalog(entries, currentFilters()) }, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = el('a'); a.href = url; a.download = `productengineer-catalog-${new Date().toISOString().slice(0, 10)}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); });
$('ops-detail-close').addEventListener('click', () => dialog.close());
detailForm.addEventListener('submit', e => { e.preventDefault(); void action(detailForm.querySelector<HTMLButtonElement>('[type=submit]'), async () => { await saveDraft(true); message('Saved to the pending queue. Validate when the entry is ready.', false, true); }, true); });
for (const [id, status] of [['validate', 'validated'], ['invalidate', 'invalidated'], ['pending', 'pending']]) $('ops-detail-' + id).addEventListener('click', () => void action($<HTMLButtonElement>('ops-detail-' + id), () => review(status), true));
$('ops-detail-retrieve').addEventListener('click', () => void action($<HTMLButtonElement>('ops-detail-retrieve'), async () => { const r = await api<{ entry: CatalogEntry; metadata?: { title: string; description: string; author: string } }>(`${entryPath(detail!.id)}/retrieve`, { version: detail!.version }); setEntry(r.entry); renderDetailHealth(); await detailHistory(r.entry.id); message(r.entry.fetchError || 'Source retrieved. Your editorial description is preserved.', Boolean(r.entry.fetchError), true); }, true));
$('ops-skill-search').addEventListener('input', e => { const q = (e.target as HTMLInputElement).value.toLowerCase(); for (const o of $<HTMLSelectElement>('ops-detail-skills').options) o.hidden = !o.selected && !o.text.toLowerCase().includes(q); });
void start();
