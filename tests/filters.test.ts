import { describe, expect, it } from 'vitest';
import { FOCUS_IDS, matchesSkill, readFilters } from '../src/atlas/filters.ts';
import { loadAtlas } from '../src/atlas/load.ts';

const atlas = loadAtlas();
const interviews = atlas.skills.find((s) => s.id === 'user-interviews')!;

describe('skill filters', () => {
  it('covers every skill with valid, overlapping focus areas', () => {
    for (const skill of atlas.skills) {
      expect(skill.focus.length, skill.id).toBeGreaterThan(0);
      expect(skill.focus.every((focus) => FOCUS_IDS.includes(focus)), skill.id).toBe(true);
      expect(new Set(skill.focus).size, skill.id).toBe(skill.focus.length);
    }
    expect(interviews.focus).toEqual(expect.arrayContaining(['people', 'evidence']));
  });

  it('distinguishes AI competencies from pages containing an AI workflow example', () => {
    const ai = { focus: 'ai', progress: '' } as const;
    expect(matchesSkill(interviews, ai, {})).toBe(false);
    for (const id of ['delegating-to-agents', 'llm-integration', 'ai-interaction-design', 'inference-costs']) {
      expect(matchesSkill(atlas.skills.find((s) => s.id === id)!, ai, {}), id).toBe(true);
    }
  });

  it('combines focus and progress, including opting out and reconsidering', () => {
    expect(matchesSkill(interviews, { focus: 'people', progress: 'none' }, {})).toBe(true);
    expect(matchesSkill(interviews, { focus: 'people', progress: 'learning' }, {})).toBe(false);
    const progress = { [interviews.id]: 'not-interested' } as const;
    expect(matchesSkill(interviews, { focus: 'people', progress: 'not-interested' }, progress)).toBe(true);
    expect(matchesSkill(interviews, { focus: 'people', progress: 'interested' }, progress)).toBe(false);
    expect(matchesSkill(interviews, { focus: 'people', progress: 'interested' }, {})).toBe(true);
    expect(matchesSkill(interviews, { focus: 'systems', progress: 'not-interested' }, progress)).toBe(false);
  });

  it('round-trips valid URL filters and ignores unknown choices', () => {
    expect(readFilters(new URLSearchParams('focus=ai&progress=not-interested'))).toEqual({ focus: 'ai', progress: 'not-interested' });
    expect(readFilters(new URLSearchParams('focus=unknown&progress=expert&lens=foundations'))).toEqual({ focus: '', progress: '' });
  });
});
