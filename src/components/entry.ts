// Components an .mdx entry can use besides the figures. Unlike figures they read the entry being
// rendered (EntryPage sets Astro.locals.coverage), so they take no data and do not work outside it.
//
//   <MapSummary />   at the end of a profile: each territory and skill, with its coverage note.
import MapSummary from './MapSummary.astro';

export const entryComponents = { MapSummary };
