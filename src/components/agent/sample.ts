// Sample data for the Agent Product Engineer concept page. "Acme" is a made-up product.
// The page labels every figure that uses this data as sample data.
import { atlas, code, path } from '../../lib/atlas.ts';

export type Band = 'strong' | 'fair' | 'low';
export const band = (score: number): Band => (score >= 80 ? 'strong' : score >= 65 ? 'fair' : 'low');

const SCORES: Record<string, { score: number; short: string; finding: string }> = {
  discovery: { score: 64, short: 'DIS', finding: 'No user interview in 45 days. Three support themes have no owner.' },
  strategy: { score: 72, short: 'STR', finding: 'The quarter goal is clear. Two of the five open projects do not move it.' },
  experience: { score: 78, short: 'EXP', finding: 'On mobile, two signup fields break with autofill.' },
  engineering: { score: 86, short: 'ENG', finding: 'Checkout has no end-to-end test.' },
  shipping: { score: 91, short: 'SHP', finding: 'Small batches: 14 deploys a week and one rollback.' },
  measurement: { score: 52, short: 'MEA', finding: 'Plan upgrades are not tracked. Two events fire twice.' },
  activation: { score: 61, short: 'ACT', finding: 'Signup to first project fell from 41% to 29% after Tuesday’s deploy.' },
  retention: { score: 74, short: 'RET', finding: 'Week-4 retention is steady at 31% for six cohorts.' },
  distribution: { score: 68, short: 'DST', finding: 'Two Google Ads campaigns bring visits but no activated users.' },
  operations: { score: 81, short: 'OPS', finding: 'One alert fires every day and nobody acts on it.' },
  ai: { score: 65, short: 'AI', finding: 'The summary feature has no evals. 12% of answers get a thumbs down.' },
};

/** The land territories of the Skills Map, in map order, with a sample score each. */
export function territoryScores() {
  return atlas()
    .territories.filter((t) => !t.crossCutting)
    .map((t) => {
      const s = SCORES[t.id];
      if (!s) throw new Error(`no sample score for territory ${t.id}`);
      return { id: t.id, name: t.name, code: code(t.id), href: path(t), ...s, band: band(s.score) };
    });
}

export function overallScore() {
  const all = territoryScores();
  return Math.round(all.reduce((sum, t) => sum + t.score, 0) / all.length);
}

/** Weekly overall scores, oldest first, ending with this week. */
export const WEEKS = [
  { week: 'W40', score: 61 },
  { week: 'W41', score: 63 },
  { week: 'W42', score: 62 },
  { week: 'W43', score: 66 },
  { week: 'W44', score: 64 },
  { week: 'W45', score: 68 },
  { week: 'W46', score: 68 },
];

/** Pointy-top hexagon around (cx, cy), the shape of a Skills Map tile. */
export function hexPath(cx: number, cy: number, w: number) {
  const h = w * 1.1547;
  const p = [
    [cx, cy - h / 2],
    [cx + w / 2, cy - h / 4],
    [cx + w / 2, cy + h / 4],
    [cx, cy + h / 2],
    [cx - w / 2, cy + h / 4],
    [cx - w / 2, cy - h / 4],
  ];
  return `M${p.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join('L')}Z`;
}

/** Centres for 11 hexagons in rows of 4, 3 and 4, so the cluster is symmetric. */
export function honeycomb(x0: number, y0: number, w: number) {
  const h = w * 1.1547;
  const rows = [4, 3, 4];
  const out: { cx: number; cy: number }[] = [];
  rows.forEach((n, r) => {
    for (let c = 0; c < n; c++) out.push({ cx: x0 + w / 2 + c * w + (r === 1 ? w / 2 : 0), cy: y0 + h / 2 + r * 0.75 * h });
  });
  return { cells: out, width: 4 * w, height: 2.5 * h };
}
