import { withUtm } from '../lib/utm.ts';

/** Provider text is rendered as text, never injected as HTML. */
export function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag); if (className) node.className = className; if (text) node.textContent = text; return node;
}
export function link(text: string, url: string, className = '') {
  const a = el('a', className, text); a.href = withUtm(url); a.target = '_blank'; a.rel = 'noopener noreferrer'; return a;
}
export function button(text: string, className: string, action: () => void) {
  const b = el('button', className, text); b.type = 'button'; b.addEventListener('click', action); return b;
}
export function icon(url: string, fallback: string) {
  const wrap = el('span', 'catalog-icon'); const img = el('img'); img.src = url; img.alt = ''; img.width = 32; img.height = 32; img.loading = 'lazy'; img.referrerPolicy = 'no-referrer';
  img.addEventListener('error', () => { if (img.src !== fallback) img.src = fallback; else { img.hidden = true; wrap.textContent = '↗'; } }); wrap.append(img); return wrap;
}
export async function api<T = any>(path: string, body?: unknown, method = 'POST'): Promise<T> {
  const r = await fetch(path, { method: body === undefined ? 'GET' : method, credentials: 'same-origin', cache: 'no-store', headers: body === undefined ? {} : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await r.json().catch(() => ({ error: 'The API is unavailable. Start the API server and try again.' }));
  if (!r.ok) throw Object.assign(new Error(data.error || `Request failed (HTTP ${r.status}).`), { status: r.status, code: data.code });
  return data;
}
export const priceLabel = (s: string) => ({ 'open-source': 'Open source', free: 'Free', freemium: 'Freemium', paid: 'Paid', unknown: 'Not assessed' })[s] ?? s;
export const formatLabel = (s: string) => ({ 'tool-guide': 'Tool guide', docs: 'Documentation', post: 'Post / thread' })[s] ?? (s[0]?.toUpperCase() ?? '') + s.slice(1);
