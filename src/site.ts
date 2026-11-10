export const SITE = {
  name: 'ProductEngineer.pro',
  url: 'https://productengineer.pro',
  description:
    'The Skill Atlas: an interactive map of product engineering, with a short description, curated resources and tools for every territory, capability and skill.',
  /** Privacy-friendly analytics. Leave empty to load nothing. */
  analytics: {
    /** Plausible-compatible script URL, e.g. https://plausible.io/js/script.js or a self-hosted one. */
    src: import.meta.env.PUBLIC_ANALYTICS_SRC ?? '',
    domain: import.meta.env.PUBLIC_ANALYTICS_DOMAIN ?? 'productengineer.pro',
  },
};
