export const SITE = {
  name: 'ProductEngineer.pro',
  url: 'https://productengineer.pro',
  /** Follows the name in the home page title. */
  tagline: 'Product engineering, mapped and in practice',
  /** The home page passes its own, with the live skill count. */
  description:
    'A free map of the skills of product engineering. Mark what you know, see what to learn next and how real products use those skills, told by their makers.',
  /** Public Rybbit ingestion settings. Private read credentials never enter the frontend. */
  analytics: {
    enabled: import.meta.env.PUBLIC_RYBBIT_ENABLED !== 'false',
    host: 'https://analytics.mtorr.es',
    siteId: '0b9e1ee60f53',
  },
};
