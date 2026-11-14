// Every figure, by the name an entry uses in MDX. EntryPage hands this map to the entry body, so
// `.mdx` entries can write <Funnel … /> without an import line.
import ABResult from './ABResult.astro';
import Anatomy from './Anatomy.astro';
import Bars from './Bars.astro';
import BeforeAfter from './BeforeAfter.astro';
import CheckGrid from './CheckGrid.astro';
import Claims from './Claims.astro';
import CohortGrid from './CohortGrid.astro';
import Compare from './Compare.astro';
import EventTable from './EventTable.astro';
import Figure from './Figure.astro';
import Flow from './Flow.astro';
import Funnel from './Funnel.astro';
import Hypothesis from './Hypothesis.astro';
import JobStory from './JobStory.astro';
import Journey from './Journey.astro';
import LineChart from './LineChart.astro';
import Loop from './Loop.astro';
import Matrix from './Matrix.astro';
import Meter from './Meter.astro';
import Quote from './Quote.astro';
import Rollout from './Rollout.astro';
import ScopeCut from './ScopeCut.astro';
import Scorecard from './Scorecard.astro';
import ScreenSteps from './ScreenSteps.astro';
import Sequence from './Sequence.astro';
import Shot from './Shot.astro';
import Skills from './Skills.astro';
import StatRow from './StatRow.astro';
import Territories from './Territories.astro';
import TerritoryMark from './TerritoryMark.astro';
import Timeline from './Timeline.astro';
import Tradeoffs from './Tradeoffs.astro';
import Verdict from './Verdict.astro';

export const figures = {
  ABResult,
  Anatomy,
  Bars,
  BeforeAfter,
  CheckGrid,
  Claims,
  CohortGrid,
  Compare,
  EventTable,
  Figure,
  Flow,
  Funnel,
  Hypothesis,
  JobStory,
  Journey,
  LineChart,
  Loop,
  Matrix,
  Meter,
  Quote,
  Rollout,
  ScopeCut,
  Scorecard,
  ScreenSteps,
  Sequence,
  Shot,
  Skills,
  StatRow,
  Territories,
  TerritoryMark,
  Timeline,
  Tradeoffs,
  Verdict,
};

export type FigureName = keyof typeof figures;
