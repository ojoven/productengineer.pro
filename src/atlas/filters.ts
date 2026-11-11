import type { Status } from './status.ts';

export const FOCUS_OPTIONS = [
  { id: 'people', label: 'People & collaboration' },
  { id: 'product-business', label: 'Product & business' },
  { id: 'systems', label: 'Software & systems' },
  { id: 'evidence', label: 'Data & evidence' },
  { id: 'ai', label: 'AI & automation' },
] as const;
export type Focus = (typeof FOCUS_OPTIONS)[number]['id'];
export const FOCUS_IDS = ['people', 'product-business', 'systems', 'evidence', 'ai'] as const;

export const PROGRESS_FILTERS = [
  { id: '', label: 'All skills' },
  { id: 'none', label: 'Not started' },
  { id: 'learning', label: 'Learning' },
  { id: 'comfortable', label: 'Comfortable' },
  { id: 'not-interested', label: 'Not interested' },
  { id: 'interested', label: 'Exclude not interested' },
] as const;
export type ProgressFilter = (typeof PROGRESS_FILTERS)[number]['id'];
export interface SkillFilters { focus: Focus | ''; progress: ProgressFilter }

export function readFilters(query: URLSearchParams): SkillFilters {
  const focus = query.get('focus') ?? '';
  const progress = query.get('progress') ?? '';
  return {
    focus: FOCUS_OPTIONS.some((option) => option.id === focus) ? focus as Focus : '',
    progress: PROGRESS_FILTERS.some((option) => option.id === progress) ? progress as ProgressFilter : '',
  };
}

export function matchesSkill(
  skill: { id: string; focus: readonly Focus[] },
  filters: SkillFilters,
  progress: Record<string, Status>,
): boolean {
  if (filters.focus && !skill.focus.includes(filters.focus)) return false;
  const status = progress[skill.id] ?? 'none';
  return !filters.progress || (filters.progress === 'interested' ? status !== 'not-interested' : status === filters.progress);
}
