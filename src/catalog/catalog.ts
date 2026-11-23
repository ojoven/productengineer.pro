import { favicon, hostOf, searchCatalog, type CatalogEntry, type CatalogFilters } from '../../server/src/catalog-model.ts';
import { button, el, formatLabel, icon, link, priceLabel } from './dom.ts';
import { track, queryLengthBucket } from '../scripts/track.ts';
const root = document.querySelector<HTMLElement>('#catalog-app')!;
const data = JSON.parse(document.getElementById('catalog-data')!.textContent!) as { entries: CatalogEntry[]; territories: { id: string; name: string }[] };
let entries = data.entries;
const territoryNames = new Map(data.territories.map(t => [t.id, t.name]));
const form = document.querySelector<HTMLFormElement>('#catalog-filters')!;
const q = document.querySelector<HTMLInputElement>('#catalog-q')!;
const sort = document.querySelector<HTMLSelectElement>('#catalog-sort')!;
const results = document.querySelector<HTMLElement>('#catalog-results')!;
let page = 1;
let analyticsTimer: ReturnType<typeof setTimeout>;
let lastSearch = '';
const size = 24;
const filters: CatalogFilters = { kind: root.dataset.kind ?? '' };
const url = new URL(location.href);
for (const key of ['q', 'territory', 'pricing', 'type', 'level', 'sort'] as const) filters[key] = url.searchParams.get(key) ?? '';
q.value = filters.q ?? ''; sort.value = filters.sort || 'relevance';
for (const select of form.querySelectorAll('select')) {
  select.value = filters[select.name as keyof CatalogFilters] ?? '';
  // Only options from the public taxonomy may become analytics properties.
  filters[select.name as keyof CatalogFilters] = select.value;
}
function render(updateUrl = true, trigger = 'filter') {
  const matched = searchCatalog(entries, filters);
  const max = Math.max(1, Math.ceil(matched.length / size)); page = Math.min(page, max);
  document.getElementById('catalog-count')!.textContent = `${matched.length} ${matched.length === 1 ? 'entry' : 'entries'}`;
  document.getElementById('catalog-context')!.textContent = filters.q ? ` for “${filters.q}”` : ' across the atlas';
  results.replaceChildren(...matched.slice((page - 1) * size, page * size).map(e => {
    const card = el('li', 'catalog-card'); card.append(icon(e.icon, favicon(e.url)));
    const main = el('div', 'catalog-card-main'); const meta = el('div', 'catalog-card-meta');
    meta.append(el('span', 'catalog-kind', formatLabel(e.type)), el('span', '', hostOf(e.url)));
    const h = el('h2'); const learningLink = link(e.title + ' ↗', e.url);
    learningLink.dataset.learningId = e.id; learningLink.dataset.learningKind = e.kind;
    h.append(learningLink); main.append(meta, h, el('p', '', e.description));
    const by = el('div', 'catalog-card-by'); if (e.author) by.append(el('span', '', e.author));
    if (e.checked) by.append(el('span', '', `Checked ${e.checked}`)); main.append(by);
    const tags = el('div', 'catalog-tags');
    for (const t of e.territories) tags.append(button(territoryNames.get(t) ?? t, 'catalog-tag', () => { filters.territory = t; (form.elements.namedItem('territory') as HTMLSelectElement).value = t; page = 1; render(); }));
    if (e.skills.length) {
      const details = el('details', 'catalog-skills'); details.append(el('summary', '', `${e.skills.length} related ${e.skills.length === 1 ? 'skill' : 'skills'}`));
      for (const s of e.skills) { const a = el('a', '', s.name); a.href = s.path; details.append(a); } tags.append(details);
    }
    main.append(tags); card.append(main, el('span', 'catalog-price', priceLabel(e.pricing))); return card;
  }));
  document.getElementById('catalog-empty')!.hidden = matched.length > 0;
  const active = document.getElementById('catalog-active')!; active.replaceChildren();
  for (const key of ['territory', 'type', 'pricing', 'level'] as const) if (filters[key]) {
    const value = key === 'territory' ? territoryNames.get(filters[key]!) ?? filters[key]! : key === 'pricing' ? priceLabel(filters[key]!) : key === 'level' ? filters[key] === 'intro' ? 'Start here' : 'Go deeper' : formatLabel(filters[key]!);
    active.append(button(`${value} ×`, 'catalog-tag', () => { filters[key] = ''; (form.elements.namedItem(key) as HTMLSelectElement).value = ''; page = 1; render(); }));
  }
  const pagination = document.getElementById('catalog-pagination')!; pagination.replaceChildren();
  if (matched.length > size) {
    const prev = button('← Previous', 'btn small', () => changePage(page - 1)); prev.disabled = page === 1;
    const next = button('Next →', 'btn small', () => changePage(page + 1)); next.disabled = page === max;
    pagination.append(prev, el('span', 'label', `Page ${page} of ${max}`), next);
  }
  for (const tab of document.querySelectorAll<HTMLAnchorElement>('[data-kind-tab]')) {
    tab.querySelector('span')!.textContent = String(entries.filter(e => !tab.dataset.kindTab || e.kind === tab.dataset.kindTab).length);
    const target = new URL(tab.pathname, location.origin);
    for (const [key, value] of Object.entries(filters)) if (value && key !== 'kind') target.searchParams.set(key, value);
    tab.href = target.pathname + target.search;
  }
  if (updateUrl) {
    const target = new URL(location.href); target.search = '';
    for (const [key, value] of Object.entries(filters)) if (value && key !== 'kind' && !(key === 'sort' && value === 'relevance')) target.searchParams.set(key, value);
    history.replaceState({}, '', target);
  }
  clearTimeout(analyticsTimer);
  if (updateUrl || filters.q || ['territory', 'type', 'pricing', 'level'].some(key => filters[key as keyof CatalogFilters])) {
    analyticsTimer = setTimeout(() => {
      const signature = JSON.stringify([filters, page, matched.length]);
      if (signature === lastSearch) return;
      lastSearch = signature;
      track('search_results_viewed', {
        surface: 'catalog', trigger, result_count: matched.length, query_length_bucket: queryLengthBucket(filters.q ?? ''),
        filter_count: ['territory', 'type', 'pricing', 'level'].filter(key => filters[key as keyof CatalogFilters]).length,
        kind: filters.kind || 'all', territory_id: filters.territory ?? '', format: filters.type ?? '',
        pricing: filters.pricing ?? '', depth: filters.level ?? '',
      });
    }, 500);
  }
}
function changePage(next: number) { page = next; render(true, 'pagination'); document.querySelector('.library-results-head')!.scrollIntoView({ block: 'start', behavior: 'smooth' }); }
function reset() { for (const key of Object.keys(filters) as (keyof CatalogFilters)[]) if (key !== 'kind') filters[key] = ''; q.value = ''; form.reset(); sort.value = 'relevance'; page = 1; render(); }
let timer: ReturnType<typeof setTimeout>;
q.addEventListener('input', () => { clearTimeout(timer); clearTimeout(analyticsTimer); timer = setTimeout(() => { filters.q = q.value.trim(); page = 1; render(true, 'search'); }, 150); });
document.getElementById('catalog-search')!.addEventListener('submit', e => { e.preventDefault(); clearTimeout(timer); filters.q = q.value.trim(); page = 1; render(true, 'submit'); });
form.addEventListener('change', () => { for (const select of form.querySelectorAll('select')) filters[select.name as keyof CatalogFilters] = select.value; page = 1; render(); });
sort.addEventListener('change', () => { filters.sort = sort.value; page = 1; render(); });
document.getElementById('catalog-reset')!.addEventListener('click', reset);
document.getElementById('catalog-empty-reset')!.addEventListener('click', reset);
for (const b of document.querySelectorAll<HTMLButtonElement>('[data-suggestion]')) b.addEventListener('click', () => { reset(); q.value = b.dataset.suggestion!; filters.q = q.value; filters.pricing = b.dataset.pricing!; (form.elements.namedItem('pricing') as HTMLSelectElement).value = filters.pricing; render(); });
document.addEventListener('keydown', e => { if (e.key === '/' && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement)) { e.preventDefault(); q.focus(); } });
window.addEventListener('popstate', () => location.reload());
render(false);
fetch('/api/catalog', { cache: 'no-store' }).then(async r => {
  if (!r.ok) throw new Error(); const live = await r.json(); if (!Array.isArray(live.entries)) throw new Error(); entries = live.entries; render(false);
}).catch(() => { const notice = document.getElementById('catalog-notice')!; notice.hidden = false; notice.textContent = 'Showing the catalog from the last site build. Live catalog updates are temporarily unavailable.'; });
