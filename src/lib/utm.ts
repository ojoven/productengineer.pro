// Outgoing links say where the visit came from: every external http(s) link gets
// utm_source=productengineer.pro. Server-rendered pages get it in src/middleware.ts; links the
// browser builds (the library) get it through withUtm() in src/catalog/dom.ts.

export const UTM_SOURCE = 'productengineer.pro';

const OWN_HOSTS = new Set(['productengineer.pro', 'www.productengineer.pro']);

/** True for an absolute http(s) URL on another site. */
export function isExternal(url: string): boolean {
  const m = /^https?:\/\/([^/?#:]+)/i.exec(url);
  return !!m && !OWN_HOSTS.has(m[1].toLowerCase());
}

/**
 * The URL with utm_source added before the fragment. Internal, relative and non-http URLs, and
 * URLs that already carry a utm_source, come back unchanged. The rest of the URL is not
 * re-encoded, so a link keeps its exact spelling.
 */
export function withUtm(url: string): string {
  if (!isExternal(url) || /[?&]utm_source=/i.test(url)) return url;
  const hash = url.indexOf('#');
  const base = hash === -1 ? url : url.slice(0, hash);
  const frag = hash === -1 ? '' : url.slice(hash);
  const sep = base.includes('?') ? (/[?&]$/.test(base) ? '' : '&') : '?';
  return `${base}${sep}utm_source=${UTM_SOURCE}${frag}`;
}

/**
 * Adds utm_source to the href of every <a> in an HTML document that points to another site.
 * Attribute values in HTML escape & as &amp;, so the value is unescaped before the change and
 * escaped again after it. Other tags (<link>, <img>, <script>) and scripts are not touched.
 */
export function addUtmToHtml(html: string): string {
  return html.replace(/<a\b[^>]*>/gi, (tag) =>
    tag.replace(/(\shref\s*=\s*)("([^"]*)"|'([^']*)')/i, (all, pre: string, _q: string, dq?: string, sq?: string) => {
      const raw = dq ?? sq ?? '';
      const url = raw.replace(/&amp;/g, '&');
      const next = withUtm(url);
      if (next === url) return all;
      const escaped = next.replace(/&/g, '&amp;');
      return dq !== undefined ? `${pre}"${escaped}"` : `${pre}'${escaped}'`;
    }),
  );
}
