export const SITE = {
  name: 'ProductEngineer.pro',
  url: 'https://productengineer.pro',
  description:
    'A free map of product engineering for software engineers. Explore every skill with checked resources and tools, mark what you know and see what to learn next.',
  /** Privacy-friendly analytics. Leave empty to load nothing. */
  analytics: {
    /** Plausible-compatible script URL, e.g. https://plausible.io/js/script.js or a self-hosted one. */
    src: import.meta.env.PUBLIC_ANALYTICS_SRC ?? '',
    domain: import.meta.env.PUBLIC_ANALYTICS_DOMAIN ?? 'productengineer.pro',
  },
};
