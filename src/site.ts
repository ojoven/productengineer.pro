export const SITE = {
  name: 'ProductEngineer.pro',
  url: 'https://productengineer.pro',
  /** Follows the name in the home page title. */
  tagline: 'Product engineering, mapped and in practice',
  /** The home page passes its own, with the live skill count. */
  description:
    'A free map of the skills of product engineering. Mark what you know, see what to learn next and how real products use those skills, told by their makers.',
  /** Privacy-friendly analytics. Leave empty to load nothing. */
  analytics: {
    /** Plausible-compatible script URL, e.g. https://plausible.io/js/script.js or a self-hosted one. */
    src: import.meta.env.PUBLIC_ANALYTICS_SRC ?? '',
    domain: import.meta.env.PUBLIC_ANALYTICS_DOMAIN ?? 'productengineer.pro',
  },
};
