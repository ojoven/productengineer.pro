// Rybbit's public browser ingestion API, with URL sanitization before data leaves the browser.
import { SITE } from '../site.ts';
export type Props = Record<string, string | number>;
const fields = {
  tour_started: ['tour_id', 'tour_version', 'attempt_id', 'layout', 'total_steps', 'start_type', 'entry_point', 'start_step'],
  tour_step_viewed: ['tour_id', 'tour_version', 'attempt_id', 'layout', 'total_steps', 'step_index', 'skill_id', 'section_id', 'navigation'],
  tour_end_reached: ['tour_id', 'tour_version', 'attempt_id', 'layout', 'total_steps', 'unique_steps_viewed', 'final_step_index'],
  tour_exited: ['tour_id', 'tour_version', 'attempt_id', 'layout', 'total_steps', 'reason', 'step_index', 'unique_steps_viewed', 'destination_id'],
  progress_changed: ['surface', 'mode', 'changed_count', 'storage'],
  map_used: ['mode', 'action', 'view_level', 'focus_area', 'progress_filter'],
  search_results_viewed: ['surface', 'trigger', 'result_count', 'query_length_bucket', 'filter_count', 'kind', 'territory_id', 'format', 'pricing', 'depth'],
  learning_link_opened: ['entry_id', 'kind', 'surface', 'context_id'],
  setup_command_copied: ['command_id', 'surface', 'method'],
} as const;
export type AnalyticsEvent = keyof typeof fields;
const campaignKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'] as const;
const QUEUE_TTL = 10_000;
let initialized = false;
let pending: { event: AnalyticsEvent; props: Props; at: number; path: string }[] = [];
let queueTimer: ReturnType<typeof setTimeout> | undefined;
let acquisition: Props = {};

export function optedOut() {
  try { return !!window.__RYBBIT_OPTOUT__ || localStorage.getItem('disable-rybbit') !== null; }
  catch { return !!window.__RYBBIT_OPTOUT__; }
}

export function analyticsEnabled() {
  return !!import.meta.env.PROD && location.hostname === 'productengineer.pro'
    && SITE.analytics.enabled && !optedOut()
    && !/^\/(operations|connect)(\/|$)/.test(location.pathname);
}

/** Labelled campaigns only. Search/auth/filter state and free-text utm_term are excluded. */
export function campaignQuery(search: string) {
  const input = new URLSearchParams(search);
  const output = new URLSearchParams();
  for (const key of campaignKeys) {
    const value = input.get(key);
    if (value && /^[a-zA-Z0-9_.~-]{1,80}$/.test(value)) output.set(key, value);
  }
  const query = output.toString();
  return query ? `?${query}` : '';
}

export function referrerOrigin(referrer: string) {
  try { const u = new URL(referrer); return /^https?:$/.test(u.protocol) ? u.origin : ''; }
  catch { return ''; }
}

function publicPath() {
  // Static canonical paths also prevent arbitrary 404 URLs entering analytics.
  try { return new URL(document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href ?? location.href).pathname; }
  catch { return location.pathname; }
}

function send(type: 'custom_event' | 'pageview' | 'outbound', event?: AnalyticsEvent, props?: Props, path = publicPath()) {
  if (!analyticsEnabled()) return;
  const serialized = JSON.stringify({ ...acquisition, ...props });
  if (serialized.length > 2048) return;
  const payload = {
    site_id: SITE.analytics.siteId, type, hostname: location.hostname, pathname: path,
    querystring: campaignQuery(location.search), referrer: referrerOrigin(document.referrer),
    screenWidth: screen.width, screenHeight: screen.height, language: navigator.language,
    ...(event ? { event_name: event } : {}),
    ...(props || type === 'pageview' ? { properties: serialized } : {}),
  };
  // No offline retry: it would assign a new timestamp or duplicate an already received event.
  try {
    void fetch(`${SITE.analytics.host}/api/track`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      mode: 'cors', credentials: 'omit', referrerPolicy: 'no-referrer', keepalive: true,
    }).catch(() => {});
  } catch { /* analytics must never interrupt the product */ }
}

export function track(event: AnalyticsEvent, properties: Props = {}) {
  if (!analyticsEnabled()) { pending = []; return; }
  const props: Props = {};
  for (const key of fields[event]) {
    const value = properties[key];
    if (typeof value === 'number' && Number.isFinite(value)) props[key] = value;
    else if (typeof value === 'string' && value.length <= 160) props[key] = value;
  }
  if (JSON.stringify(props).length > 1800) return;
  if (!initialized) {
    if (pending.length < 50) pending.push({ event, props, at: Date.now(), path: publicPath() });
    queueTimer ??= setTimeout(() => { pending = []; queueTimer = undefined; }, QUEUE_TTL);
    return;
  }
  window.rybbit?.event(event, props);
}

declare global {
  interface Window {
    __RYBBIT_OPTOUT__?: boolean;
    rybbit?: { event: (event: AnalyticsEvent, props?: Props) => void };
  }
}

export function initAnalytics() {
  if (initialized) return;
  initialized = true;
  clearTimeout(queueTimer);
  queueTimer = undefined;
  if (!analyticsEnabled()) { pending = []; return; }
  window.rybbit = { event: (event, props) => send('custom_event', event, props) };
  // Tab-session attribution survives internal navigation without storing a person identifier.
  try {
    const saved = JSON.parse(sessionStorage.getItem('pe-acquisition:v1') ?? 'null');
    if (saved && Date.now() - saved.at < 30 * 60_000 && saved.at <= Date.now()) {
      for (const key of campaignKeys) if (typeof saved.props?.[key] === 'string' && /^[a-zA-Z0-9_.~-]{1,80}$/.test(saved.props[key])) acquisition[key] = saved.props[key];
    } else acquisition = Object.fromEntries(new URLSearchParams(campaignQuery(location.search)));
    sessionStorage.setItem('pe-acquisition:v1', JSON.stringify({ at: Date.now(), props: acquisition }));
  } catch { acquisition = Object.fromEntries(new URLSearchParams(campaignQuery(location.search))); }
  send('pageview');
  const queued = pending;
  pending = [];
  for (const item of queued) if (Date.now() - item.at <= QUEUE_TTL) send('custom_event', item.event, item.props, item.path);
  // Astro uses full page navigation. Query/hash changes are filter/Tour states, not pageviews.
  document.addEventListener('click', onLink);
  document.addEventListener('auxclick', (e) => { if (e.button === 1) onLink(e); });
}

function onLink(e: MouseEvent) {
  if (e.defaultPrevented || !(e.target instanceof Element)) return;
  const a = e.target.closest<HTMLAnchorElement>('a[href]');
  if (!a) return;
  const u = new URL(a.href, location.href);
  if (!/^https?:$/.test(u.protocol)) return;
  if (a.dataset.learningId) {
    const path = publicPath();
    track('learning_link_opened', {
      entry_id: a.dataset.learningId, kind: a.dataset.learningKind ?? 'resource',
      surface: a.closest('[data-qt]') ? 'tour' : a.closest('#catalog-app') ? 'catalog'
        : path.startsWith('/tools/') ? 'tool_page' : path.split('/').filter(Boolean).length >= 4 ? 'skill' : 'capability',
      context_id: path,
    });
  }
  if (u.origin !== location.origin) send('outbound', undefined, { url: u.origin + u.pathname, target: a.target || '_self' });
}

export const queryLengthBucket = (query: string) => !query.length ? 'empty' : query.length < 6 ? '1-5' : query.length < 21 ? '6-20' : '21+';
