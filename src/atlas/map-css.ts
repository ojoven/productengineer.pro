// Map styling, shared by the site stylesheet and by standalone SVG exports.
// Colours are tokens so light and dark themes only swap values.

export type MapStyle = 'ink' | 'illustrated';
export type Theme = 'light' | 'dark';

type Tokens = Record<string, string>;

const TERRITORY_TINTS: Record<string, [string, string]> = {
  // [light, dark]
  discovery: ['#cfe0b4', '#33452c'],
  strategy: ['#e8d9bd', '#4a4030'],
  experience: ['#f2dccb', '#4d3a33'],
  engineering: ['#dcd5ca', '#3e3a35'],
  shipping: ['#cfe3e3', '#2d4244'],
  measurement: ['#ddd6ee', '#3b3650'],
  activation: ['#f4e3b5', '#4d4430'],
  retention: ['#dfeabf', '#3a4530'],
  distribution: ['#efd5c8', '#4b3933'],
  operations: ['#d3d9e2', '#363c47'],
};

export const TOKENS: Record<MapStyle, Record<Theme, Tokens>> = {
  ink: {
    light: {
      paper: '#fbfaf6', sea: '#fbfaf6', land: '#fbfaf6', ink: '#1f3a9c', 'ink-soft': '#5a6fbf',
      hl: '#ffd84a', 'hl-soft': '#fff0a8', lit: '#ff4f9a', 'lit-soft': '#ffc2dc', dim: '#fbfaf6',
    },
    dark: {
      paper: '#0f1730', sea: '#0f1730', land: '#121c3a', ink: '#a9bcff', 'ink-soft': '#7187d6',
      hl: '#ffd84a', 'hl-soft': '#6b5b1f', lit: '#ff6aa8', 'lit-soft': '#6b2a48', dim: '#0f1730',
    },
  },
  illustrated: {
    light: {
      paper: '#f6efdc', sea: '#cfe3e2', shallow: '#bcd8d5', land: '#f3e9cf', ink: '#4a3b2a', 'ink-soft': '#8a7558',
      hl: '#6b46c9', 'hl-soft': '#c9b8f0', lit: '#f0a020', 'lit-soft': '#fbd98a', dim: '#f6efdc',
      tree: '#86a96b', 'tree-k': '#4e6b3c', hillc: '#c9bf95', mtn: '#bfae93', 'mtn-s': '#9d8b70', snow: '#fbf7ee',
      wall: '#f4ead6', roof: '#c4704e', field: '#d9cf7a', 'field-l': '#a8a050', wave: '#8fb9b6', dome: '#8aa4c8', hull: '#8a6a48',
    },
    dark: {
      paper: '#1b2026', sea: '#14262c', shallow: '#1b333a', land: '#2a2a24', ink: '#e6dcc8', 'ink-soft': '#a89a80',
      hl: '#a98bff', 'hl-soft': '#4a3d7a', lit: '#f5b13d', 'lit-soft': '#6b5020', dim: '#1b2026',
      tree: '#5d7d4a', 'tree-k': '#2f4426', hillc: '#5c5640', mtn: '#6e6352', 'mtn-s': '#4f4638', snow: '#cfc8b8',
      wall: '#5a5446', roof: '#9a5638', field: '#6e6a3a', 'field-l': '#8e8a4a', wave: '#3e6a6a', dome: '#4f6a90', hull: '#6a523a',
    },
  },
};

function tokenBlock(style: MapStyle, theme: Theme): string {
  const t = TOKENS[style][theme];
  const vars = Object.entries(t).map(([k, v]) => `--m-${k}:${v}`);
  for (const [id, [light, dark]] of Object.entries(TERRITORY_TINTS)) vars.push(`--m-t-${id}:${theme === 'light' ? light : dark}`);
  return vars.join(';');
}

const FONTS: Record<MapStyle, string> = {
  ink: "'Kalam', 'Comic Neue', 'Segoe Print', cursive",
  illustrated: "'EB Garamond', Garamond, 'Times New Roman', serif",
};

/** Rules that do not depend on theme. */
const BASE = `
.pm{display:block;width:100%;height:auto;background:var(--m-sea);-webkit-tap-highlight-color:transparent}
.pm text{font-family:var(--m-font);fill:var(--m-ink);paint-order:stroke;stroke:var(--m-paper);stroke-linejoin:round}
.pm .sea{fill:var(--m-sea)}
.pm .land{fill:var(--m-land)}
.pm .coast{fill:none;stroke:var(--m-ink)}
.pm .ripple-o{fill:none;stroke:var(--m-ink-soft)}
.pm .ripple-i{fill:none;stroke:var(--m-sea)}
.pm .border{fill:none;stroke:var(--m-ink-soft);stroke-linecap:round}
.pm .island{fill:var(--m-land);stroke:var(--m-ink)}
.pm .shade{fill:var(--m-dim);opacity:.55;pointer-events:none}
.pm .gp{fill:var(--m-land);stroke:var(--m-ink);stroke-width:1.1;stroke-linejoin:round}
.pm .gs{fill:none;stroke:var(--m-ink);stroke-width:1.1;stroke-linecap:round;stroke-linejoin:round}
.pm .glyph-sea .gs{stroke:var(--m-ink-soft)}
.pm .tlabel{font-weight:700;letter-spacing:.06em;text-transform:uppercase}
.pm .terrain{pointer-events:none}
.pm .thit path{fill:transparent;stroke:none;cursor:pointer}
.pm .thit:hover path{fill:var(--m-ink);opacity:.035}
.pm .tl{cursor:pointer}
.pm .tl:hover .tlabel,.pm .tl:focus-visible .tlabel{fill:var(--m-lit)}
.pm .tl:focus{outline:none}
.pm-z-capability .terrain{opacity:.6}
.pm-z-territory .terrain{opacity:.85}
.pm .tlabel.is-dim{opacity:.45}
.pm .tq{font-style:italic;opacity:.8}
.pm .n{cursor:pointer}
.pm .n .hit{fill:transparent;stroke:none}
.pm .n .dot{fill:var(--m-paper);stroke:var(--m-ink)}
.pm .n .core{fill:var(--m-ink)}
.pm .n .roll{fill:none;stroke:var(--m-hl);stroke-linecap:butt}
.pm .n .roll-l{fill:none;stroke:var(--m-hl-soft);stroke-linecap:butt}
.pm .n .halo{fill:var(--m-lit-soft);opacity:0}
.pm .n.is-lit .halo{opacity:.9}
.pm .n.is-lit .dot{stroke:var(--m-lit)}
.pm .n.st-learning .dot{fill:var(--m-hl-soft)}
.pm .n.st-comfortable .dot{fill:var(--m-hl)}
.pm .n.is-dim{opacity:.4}
.pm .n.is-sel .dot{stroke-width:var(--m-sel-w)}
.pm .n.is-sel text{font-weight:700}
.pm .n:hover .dot,.pm .n:focus-visible .dot{stroke:var(--m-lit)}
.pm .n:focus{outline:none}
.pm .n:focus-visible .ring{stroke:var(--m-lit);opacity:1}
.pm .n .ring{fill:none;stroke:var(--m-ink);opacity:0}
.pm .route{fill:none;stroke:var(--m-lit);stroke-linecap:round;stroke-linejoin:round;opacity:.55}
.pm .route-ink{fill:none;stroke:var(--m-lit);stroke-linecap:round;stroke-dasharray:var(--m-dash)}
.pm .lit-terr{fill:var(--m-lit-soft);opacity:.5}
.pm .compass path{fill:none;stroke:var(--m-ink-soft)}
.pm .compass text{fill:var(--m-ink-soft)}
.pm--ink .route{mix-blend-mode:multiply}
.pm--ill .terr{stroke:none}
.pm--ill .coast{stroke:var(--m-ink-soft)}
.pm--ill .shallow{fill:none;stroke:var(--m-shallow)}
.pm--ill .border{stroke:var(--m-ink-soft);opacity:.75}
.pm--ill .gt{fill:var(--m-tree);stroke:var(--m-tree-k);stroke-width:.9}
.pm--ill .gk{fill:none;stroke:var(--m-tree-k);stroke-width:1.1;stroke-linecap:round}
.pm--ill .gh{fill:var(--m-hillc);stroke:var(--m-mtn-s);stroke-width:.7}
.pm--ill .gm{fill:var(--m-mtn);stroke:var(--m-mtn-s);stroke-width:.9;stroke-linejoin:round}
.pm--ill .gms{fill:var(--m-mtn-s);opacity:.55}
.pm--ill .gsn{fill:var(--m-snow)}
.pm--ill .gw{fill:var(--m-wall);stroke:var(--m-ink-soft);stroke-width:.8;stroke-linejoin:round}
.pm--ill .gr{fill:var(--m-roof);stroke:var(--m-ink-soft);stroke-width:.8;stroke-linejoin:round}
.pm--ill .gsm{fill:none;stroke:var(--m-ink-soft);stroke-width:.9;opacity:.7}
.pm--ill .gf{fill:var(--m-field);stroke:var(--m-field-l);stroke-width:.8}
.pm--ill .gfl{fill:none;stroke:var(--m-field-l);stroke-width:.8}
.pm--ill .gd{fill:var(--m-dome);stroke:var(--m-ink-soft);stroke-width:.8}
.pm--ill .gwv{fill:none;stroke:var(--m-wave);stroke-width:1.2;stroke-linecap:round}
.pm--ill .gbh{fill:var(--m-hull);stroke:var(--m-ink-soft);stroke-width:.8}
.pm--ill .pill{fill:var(--m-paper);opacity:.82;stroke:var(--m-ink-soft);stroke-opacity:.35}
.pm--ill .n .dot{fill:#fff;stroke:var(--m-ink-soft)}
.pm--ill .n .core{fill:var(--m-ink-soft)}
.pm--ill .n.st-learning .dot{fill:var(--m-hl-soft)}
.pm--ill .n.st-comfortable .dot{fill:var(--m-hl);stroke:var(--m-hl)}
.pm--ill .n.st-comfortable .core{fill:#fff}
.pm--ill .route{opacity:.9}
${Object.keys(TERRITORY_TINTS).map((id) => `.pm--ill .terr--${id}{fill:var(--m-t-${id})}`).join('\n')}
`;

/**
 * Full stylesheet. For the site: light by default, dark under prefers-color-scheme unless the
 * page forces light, and forced dark with [data-theme="dark"]. For a standalone export pass a
 * fixed theme.
 */
export function mapCss(theme?: Theme): string {
  const styles: MapStyle[] = ['ink', 'illustrated'];
  const cls = (s: MapStyle) => (s === 'ink' ? '.pm--ink' : '.pm--ill');
  const font = (s: MapStyle) => `${cls(s)}{--m-font:${FONTS[s]}}`;
  if (theme) return styles.map((s) => `${cls(s)}{${tokenBlock(s, theme)}}${font(s)}`).join('\n') + BASE;
  return [
    ...styles.map((s) => `${cls(s)}{${tokenBlock(s, 'light')}}${font(s)}`),
    `@media (prefers-color-scheme: dark){${styles.map((s) => `:root:not([data-theme="light"]) ${cls(s)}{${tokenBlock(s, 'dark')}}`).join('')}}`,
    ...styles.map((s) => `:root[data-theme="dark"] ${cls(s)}{${tokenBlock(s, 'dark')}}`),
    `.pm--ink.pm{} :root[data-theme="dark"] .pm--ink .route{mix-blend-mode:screen}`,
    `@media (prefers-color-scheme: dark){:root:not([data-theme="light"]) .pm--ink .route{mix-blend-mode:screen}}`,
    BASE,
  ].join('\n');
}

/** Forces one theme inside a container, regardless of the page theme (used to compare). */
export function themeScope(selector: string, theme: Theme): string {
  const styles: MapStyle[] = ['ink', 'illustrated'];
  return styles
    .map((s) => `${selector} ${s === 'ink' ? '.pm--ink' : '.pm--ill'}{${tokenBlock(s, theme)}}`)
    .join('\n');
}
