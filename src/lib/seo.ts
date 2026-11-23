// Search and AI-answer helpers: meta description length and the schema.org nodes shared by
// every page. Pages build their own nodes and link to these by `@id`.
import { SITE } from '../site.ts';
import { loadAuthor } from '../editorial/load.ts';

/** Search results show about 155 to 160 characters of a description. */
export const DESCRIPTION_MAX = 160;

/**
 * Shortens text for a meta description. Keeps whole sentences when the first ones fit, otherwise
 * cuts at a word and adds an ellipsis.
 */
export function clip(text: string, max = DESCRIPTION_MAX): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const sentences = t.match(/[^.!?]+[.!?]+(?=\s|$)/g) ?? [];
  let out = '';
  for (const s of sentences) {
    const next = (out + s).trim();
    if (next.length > max) break;
    out = next;
  }
  if (out.length >= 70) return out;
  const cut = t.slice(0, max - 1);
  return `${cut.slice(0, cut.lastIndexOf(' ')).replace(/[\s,;:.–-]+$/, '')}…`;
}

export const abs = (p: string) => new URL(p, SITE.url).href;

export const ID = {
  website: `${SITE.url}/#website`,
  organization: `${SITE.url}/#organization`,
  person: `${SITE.url}/about/#mikel`,
};

export function organization() {
  return {
    '@type': 'Organization',
    '@id': ID.organization,
    name: SITE.name,
    url: `${SITE.url}/`,
    logo: { '@type': 'ImageObject', url: abs('/logo.png'), width: 512, height: 512 },
    founder: { '@id': ID.person },
    sameAs: ['https://github.com/ojoven/product-engineering-skills'],
  };
}

export function website() {
  return {
    '@type': 'WebSite',
    '@id': ID.website,
    name: SITE.name,
    alternateName: 'Product Engineer Skills Map',
    url: `${SITE.url}/`,
    description: SITE.description,
    inLanguage: 'en',
    publisher: { '@id': ID.organization },
  };
}

export function person() {
  const me = loadAuthor();
  return {
    '@type': 'Person',
    '@id': ID.person,
    name: me.name,
    url: abs('/about/'),
    ...(me.photo && { image: abs(me.photo) }),
    ...(me.role && { jobTitle: me.role }),
    ...(me.location && { homeLocation: { '@type': 'Place', name: me.location } }),
    sameAs: me.links.map((l) => l.href),
  };
}

/** One JSON-LD document with several nodes. */
export const graph = (...nodes: Record<string, unknown>[]) => ({ '@context': 'https://schema.org', '@graph': nodes });

/** Breadcrumbs as schema.org items. The last item without a link is the current page. */
export function breadcrumbs(items: { href?: string; label: string }[], current: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: (items[0]?.href === '/' ? items : [{ label: 'Home', href: '/' }, ...items]).map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.label,
      item: abs(item.href ?? current),
    })),
  };
}
