import { describe, expect, it } from 'vitest';
import { addUtmToHtml, withUtm } from '../src/lib/utm.ts';

describe('withUtm', () => {
  it('adds utm_source to an external link', () => {
    expect(withUtm('https://posthog.com/docs')).toBe('https://posthog.com/docs?utm_source=productengineer.pro');
  });
  it('keeps the query and puts the parameter before the fragment', () => {
    expect(withUtm('https://www.youtube.com/watch?v=abc#t=10')).toBe('https://www.youtube.com/watch?v=abc&utm_source=productengineer.pro#t=10');
  });
  it('leaves internal, relative and non-http links alone', () => {
    for (const url of ['/skills-map/', '#guide', 'mailto:hi@example.com', 'https://productengineer.pro/about/', 'https://www.productengineer.pro/']) {
      expect(withUtm(url)).toBe(url);
    }
  });
  it('does not overwrite an existing utm_source', () => {
    expect(withUtm('https://example.com/?utm_source=x')).toBe('https://example.com/?utm_source=x');
  });
});

describe('addUtmToHtml', () => {
  it('rewrites anchors only, and keeps HTML escaping', () => {
    const html =
      '<link rel="canonical" href="https://example.com/"><a class="t" href="https://example.com/a?x=1&amp;y=2" rel="noopener">A</a>' +
      '<img src="https://example.com/i.png"><a href="/in-practice/">B</a>';
    expect(addUtmToHtml(html)).toBe(
      '<link rel="canonical" href="https://example.com/"><a class="t" href="https://example.com/a?x=1&amp;y=2&amp;utm_source=productengineer.pro" rel="noopener">A</a>' +
        '<img src="https://example.com/i.png"><a href="/in-practice/">B</a>',
    );
  });
});
