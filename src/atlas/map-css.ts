// Map styling, shared by the site and by standalone exports (social images). The tokens are
// the site's own palette, so the map and the page read as one surface.

export type Theme = 'light' | 'dark';

export const TOKENS: Record<Theme, Record<string, string>> = {
  light: {
    bg: '#f2f0ea',
    ink: '#141412',
    muted: '#76736a',
    tile: '#dedad0',
    'tile-hover': '#cfcabd',
    learning: '#8f8b80',
    line: '#141412',
    accent: '#e0337f',
    'accent-deep': '#b8195f',
    highlight: '#f5d547',
    'on-highlight': '#141412',
    'on-ink': '#f2f0ea',
  },
  dark: {
    bg: '#121211',
    ink: '#ecebe5',
    muted: '#8f8c83',
    tile: '#2a2926',
    'tile-hover': '#3a3935',
    learning: '#6b6962',
    line: '#ecebe5',
    accent: '#ff5fa2',
    'accent-deep': '#ff8fbf',
    highlight: '#f5d547',
    'on-highlight': '#141412',
    'on-ink': '#121211',
  },
};

// On the site these follow the page's font set (A Plex, B Geist, C Dot; labels use --ui); standalone exports fall back to Plex.
const FONTS = {
  sans: "var(--ui, var(--sans, 'IBM Plex Sans', ui-sans-serif, system-ui, sans-serif))",
  cond: "var(--cond, 'IBM Plex Sans Condensed', 'IBM Plex Sans', ui-sans-serif, sans-serif)",
  mono: "var(--mono, 'IBM Plex Mono', ui-monospace, monospace)",
};

const tokens = (t: Theme) =>
  Object.entries(TOKENS[t])
    .map(([k, v]) => `--m-${k}:${v}`)
    .join(';');

const RULES = `
.pm{display:block;width:100%;height:auto;font-family:${FONTS.sans};-webkit-tap-highlight-color:transparent}
.pm .bg{fill:var(--m-bg)}
.pm .tile{fill:var(--m-tile);stroke:none}
.pm .hit{fill:transparent;stroke:none}
.pm .tile.st-learning{fill:var(--m-learning)}
.pm .tile.st-comfortable{fill:var(--m-ink)}
.pm .tile.st-not-interested{fill:var(--m-bg);stroke:var(--m-muted);stroke-width:1px;stroke-dasharray:2 2;vector-effect:non-scaling-stroke}
.pm .tile.is-filter-match,.pm .tile.is-lit{fill:var(--m-highlight)}
.pm .b-cap{fill:none;stroke:var(--m-line);stroke-width:1.8px;vector-effect:non-scaling-stroke;pointer-events:none;stroke-linejoin:round;stroke-linecap:round}
.pm-z-world .b-cap{stroke-width:1px}
.pm .b-faint{stroke-width:1px;opacity:.3}
.pm .b-ter{fill:none;stroke:var(--m-line);stroke-width:1.3px;vector-effect:non-scaling-stroke;pointer-events:none;stroke-linejoin:round}
.pm .b-lit{fill:none;stroke:var(--m-accent);stroke-width:2.4px;vector-effect:non-scaling-stroke;pointer-events:none;stroke-linejoin:round}
.pm .b-sel{fill:none;stroke:var(--m-accent);stroke-width:2.6px;vector-effect:non-scaling-stroke;pointer-events:none;stroke-linejoin:round}
.pm .route-halo{fill:none;stroke:var(--m-bg);stroke-width:5px;vector-effect:non-scaling-stroke;stroke-linejoin:round;stroke-linecap:round;pointer-events:none}
.pm .route{fill:none;stroke:var(--m-accent);stroke-width:2px;vector-effect:non-scaling-stroke;stroke-linejoin:round;stroke-linecap:round;pointer-events:none}
.pm .route-dot{fill:var(--m-accent);stroke:var(--m-bg);stroke-width:1.5px;vector-effect:non-scaling-stroke;pointer-events:none}
.pm text{fill:var(--m-ink);pointer-events:none}
.pm .halo{paint-order:stroke;stroke:var(--m-bg);stroke-linejoin:round}
.pm .tl{font-family:${FONTS.cond};font-weight:600;letter-spacing:.07em;text-transform:uppercase}
.pm .tl .tc{font-family:${FONTS.mono};font-weight:500;fill:var(--m-muted);letter-spacing:0}
.pm .tl.is-lit{fill:var(--m-accent)}
.pm .tl.is-dim{opacity:.45}
.pm .tla{cursor:pointer}
.pm .tla text{pointer-events:auto}
.pm .tla:hover text{fill:var(--m-accent)}
.pm .cl{font-weight:600}
.pm .cl.is-dim{opacity:.55;font-weight:500}
.pm .ch{font-family:${FONTS.cond};font-weight:600}
.pm .sl{font-weight:500}
.pm .mcode{font-family:${FONTS.mono};fill:var(--m-muted);font-weight:400}
.pm .sl-g.st-comfortable text{fill:var(--m-on-ink)}
.pm .sl-g.st-comfortable .mcode{fill:var(--m-on-ink);opacity:.7}
.pm .sl-g.is-filter-match text,.pm .sl-g.is-lit text{fill:var(--m-on-highlight)}
.pm .sl-g.is-filter-match .mcode,.pm .sl-g.is-lit .mcode{fill:var(--m-on-highlight);opacity:.7}
.pm .cl.is-filter-match{fill:var(--m-on-highlight);stroke:var(--m-highlight)}
.pm .cl.is-filter-match .mcode{fill:var(--m-on-highlight);opacity:.7}
.pm .n{cursor:pointer;outline:none}
.pm .n .tile{transition:fill .12s ease}
.pm .n:hover .tile:not(.st-comfortable):not(.is-lit):not(.is-filter-match),.pm .n.is-hover .tile:not(.st-comfortable):not(.is-lit):not(.is-filter-match){fill:var(--m-tile-hover)}
.pm .n:hover .tile.st-comfortable,.pm .n.is-hover .tile.st-comfortable{opacity:.85}
.pm .n:focus-visible .tile{stroke:var(--m-accent);stroke-width:2.5px;vector-effect:non-scaling-stroke}
.pm .n.is-dim{opacity:.4}
.pm .n.is-dim:hover{opacity:.7}
`;

/**
 * The map stylesheet. With no theme: light by default, dark under prefers-color-scheme unless
 * the page forces light, and forced dark with [data-theme="dark"]. With a theme: that theme only.
 */
export function mapCss(theme?: Theme): string {
  if (theme) return `.pm{${tokens(theme)}}${RULES}`;
  return [
    `.pm{${tokens('light')}}`,
    `@media (prefers-color-scheme: dark){:root:not([data-theme="light"]) .pm{${tokens('dark')}}}`,
    `:root[data-theme="dark"] .pm{${tokens('dark')}}`,
    RULES,
  ].join('\n');
}
